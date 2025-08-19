import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const JUNIOR_FOLDER_ID = '1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu'
const TEST_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'
const CARDS_SPREADSHEET_ID = '1qmT_Yg09BFpD6UKZz7LFs1SXGPtQYjzNlZ-tytsr3is'
const GBP_TO_USD_RATE = 1.3

const MANAGERS = {
  '@sobroffice': { percentage: 10, isTest: true },
  '@vladsohr': { percentage: 5, isTest: false },
  '@n1mbo': { percentage: 10, isTest: false },
  '@i88jU': { percentage: 5, isTest: false }
}

function getCurrentMonthName(): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  return months[new Date().getMonth()]
}

function getCurrentMonthCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  return `${year}-${month}`
}

function parseNumberValue(value: any): number {
  if (!value) return 0
  const cleaned = String(value).replace(',', '.').replace(/[^0-9.-]/g, '')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

function extractCardNumber(value: any): string {
  if (!value) return ''
  return String(value).replace(/[^0-9]/g, '')
}

export async function GET() {
  const startTime = Date.now()
  
  try {
    console.log('=== STARTING CORRECT SYNC ===')
    
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
      throw new Error('Missing Google credentials')
    }

    const monthName = getCurrentMonthName()
    const monthCode = getCurrentMonthCode()
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
      ],
    })

    const drive = google.drive({ version: 'v3', auth })
    const sheets = google.sheets({ version: 'v4', auth })
    const supabase = getServiceSupabase()
    
    // Очищаем старые данные
    console.log(`Clearing data for ${monthCode}...`)
    await supabase.from('transactions').delete().eq('month', monthCode)
    await supabase.from('cards').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    // STEP 1: КАРТЫ - читаем ВСЕ карты из Bank of Banks
    console.log('Reading cards from Bank of Banks...')
    const cardsData = []
    
    try {
      // Читаем лист REVO UK
      const cardsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: CARDS_SPREADSHEET_ID,
        range: 'REVO UK!A2:E500', // Читаем колонки A-E для полной информации
      })
      
      const rows = cardsResponse.data.values || []
      console.log(`Found ${rows.length} cards in REVO UK sheet`)
      
      for (const row of rows) {
        if (row[0]) {
          const cardNumber = extractCardNumber(row[0])
          if (cardNumber && cardNumber.length >= 15) {
            cardsData.push({
              card_number: cardNumber,
              expiry_date: row[1] || '',
              cvv: row[2] || '',
              bank_name: row[3] || '',
              holder_name: row[4] || '',
              status: 'available',
              sheet: 'REVO UK'
            })
          }
        }
      }
    } catch (error) {
      console.error('Error reading REVO UK cards:', error)
    }
    
    // Можно добавить другие листы (PAYZ, REVO IE и т.д.)
    const otherSheets = ['PAYZ', 'REVO IE', 'REVO ES', 'REVO NZ', 'REVO PL']
    for (const sheetName of otherSheets) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: CARDS_SPREADSHEET_ID,
          range: `${sheetName}!A2:E500`,
        })
        
        const rows = response.data.values || []
        console.log(`Found ${rows.length} cards in ${sheetName} sheet`)
        
        for (const row of rows) {
          if (row[0]) {
            const cardNumber = extractCardNumber(row[0])
            if (cardNumber && cardNumber.length >= 15) {
              cardsData.push({
                card_number: cardNumber,
                expiry_date: row[1] || '',
                cvv: row[2] || '',
                bank_name: row[3] || '',
                holder_name: row[4] || '',
                status: 'available',
                sheet: sheetName
              })
            }
          }
        }
      } catch (error) {
        console.log(`Sheet ${sheetName} not found or error reading`)
      }
    }
    
    console.log(`Total cards found: ${cardsData.length}`)
    
    // STEP 2: КАЗИНО - читаем список казино из August themes
    console.log('Reading casinos from August themes...')
    const casinosSet = new Set<string>()
    const casinoCardsMap = new Map<string, Set<string>>()
    
    try {
      const themesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: `${monthName} themes!A2:Z500`, // Читаем все данные
      })
      
      const rows = themesResponse.data.values || []
      console.log(`Found ${rows.length} rows in themes sheet`)
      
      for (const row of rows) {
        if (row[0]) {
          const casino = String(row[0]).trim()
          casinosSet.add(casino)
          
          // Собираем карты, назначенные этому казино (из остальных колонок)
          const cards = new Set<string>()
          for (let i = 1; i < row.length; i++) {
            if (row[i]) {
              const cardNum = extractCardNumber(row[i])
              if (cardNum) {
                cards.add(cardNum)
              }
            }
          }
          
          if (cards.size > 0) {
            casinoCardsMap.set(casino, cards)
          }
        }
      }
      
      console.log(`Found ${casinosSet.size} casinos`)
    } catch (error) {
      console.error('Error reading themes:', error)
    }
    
    // STEP 3: СОТРУДНИКИ
    console.log('Processing employees...')
    const foldersResponse = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name)',
      pageSize: 100,
    })
    
    const folders = foldersResponse.data.files || []
    const { data: existingEmployees } = await supabase.from('employees').select('*')
    const employeeMap = new Map()
    
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      const isFired = folder.name.includes('УВОЛЕН')
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      
      let employee = existingEmployees?.find(e => 
        e.username === cleanUsername || e.username === folder.name
      )
      
      const isManager = MANAGERS.hasOwnProperty(cleanUsername)
      const managerData = MANAGERS[cleanUsername as keyof typeof MANAGERS]
      
      const employeeData = {
        username: cleanUsername,
        folder_id: folder.id,
        is_manager: isManager,
        is_active: !isFired,
        profit_percentage: managerData?.percentage || 10.00,
      }
      
      if (employee) {
        await supabase.from('employees').update(employeeData).eq('id', employee.id)
        employeeMap.set(cleanUsername, employee.id)
      } else {
        const { data: newEmp } = await supabase
          .from('employees')
          .insert([employeeData])
          .select()
          .single()
        
        if (newEmp) {
          employee = newEmp
          employeeMap.set(cleanUsername, newEmp.id)
        }
      }
    }
    
    // Добавляем @sobroffice
    if (!employeeMap.has('@sobroffice')) {
      let sobroffice = existingEmployees?.find(e => e.username === '@sobroffice')
      
      if (!sobroffice) {
        const { data: newEmp } = await supabase
          .from('employees')
          .insert([{
            username: '@sobroffice',
            folder_id: 'test',
            is_manager: true,
            is_active: true,
            profit_percentage: 10.00,
          }])
          .select()
          .single()
        
        if (newEmp) sobroffice = newEmp
      }
      
      if (sobroffice) {
        employeeMap.set('@sobroffice', sobroffice.id)
      }
    }
    
    // STEP 4: ТРАНЗАКЦИИ - читаем ТОЛЬКО из листа с названием месяца
    console.log(`Reading transactions from ${monthName} sheet ONLY...`)
    let totalTransactions = 0
    const usedCards = new Set<string>()
    
    // Читаем транзакции сотрудников
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      const employeeId = employeeMap.get(cleanUsername)
      
      if (!employeeId) continue
      
      try {
        const workFiles = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'WORK'`,
          fields: 'files(id, name)',
          pageSize: 5,
        })
        
        const workFile = workFiles.data.files?.[0]
        if (!workFile?.id) continue
        
        // ВАЖНО: читаем ТОЛЬКО лист с названием месяца
        const range = `${monthName}!A2:D500`
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: workFile.id,
          range,
        })
        
        const rows = response.data.values || []
        
        for (const row of rows) {
          if (row[0]) {
            const casino = String(row[0]).trim()
            const depositGbp = parseNumberValue(row[1])
            const withdrawalGbp = parseNumberValue(row[2])
            const cardNumber = extractCardNumber(row[3])
            
            if (cardNumber) {
              usedCards.add(cardNumber)
            }
            
            const depositUsd = depositGbp * GBP_TO_USD_RATE
            const withdrawalUsd = withdrawalGbp * GBP_TO_USD_RATE
            const grossProfit = withdrawalUsd - depositUsd
            
            await supabase.from('transactions').insert([{
              employee_id: employeeId,
              month: monthCode,
              casino_name: casino,
              deposit_gbp: depositGbp,
              withdrawal_gbp: withdrawalGbp,
              deposit_usd: depositUsd,
              withdrawal_usd: withdrawalUsd,
              card_number: cardNumber,
              gross_profit_usd: grossProfit,
              net_profit_usd: grossProfit,
            }])
            
            totalTransactions++
          }
        }
      } catch (error) {
        console.error(`Error processing ${cleanUsername}:`, error)
      }
    }
    
    // Читаем тестовые транзакции (тоже ТОЛЬКО из листа месяца)
    try {
      const sobrofficeId = employeeMap.get('@sobroffice')
      
      if (sobrofficeId) {
        const testRange = `${monthName}!A2:D500`
        const testResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: TEST_SPREADSHEET_ID,
          range: testRange,
        })
        
        const rows = testResponse.data.values || []
        
        for (const row of rows) {
          if (row[0]) {
            const casino = String(row[0]).trim()
            const depositGbp = parseNumberValue(row[1])
            const withdrawalGbp = parseNumberValue(row[2])
            const cardNumber = extractCardNumber(row[3])
            
            if (cardNumber) {
              usedCards.add(cardNumber)
            }
            
            const depositUsd = depositGbp * GBP_TO_USD_RATE
            const withdrawalUsd = withdrawalGbp * GBP_TO_USD_RATE
            const grossProfit = withdrawalUsd - depositUsd
            
            await supabase.from('transactions').insert([{
              employee_id: sobrofficeId,
              month: monthCode,
              casino_name: casino,
              deposit_gbp: depositGbp,
              withdrawal_gbp: withdrawalGbp,
              deposit_usd: depositUsd,
              withdrawal_usd: withdrawalUsd,
              card_number: cardNumber,
              gross_profit_usd: grossProfit,
              net_profit_usd: grossProfit,
            }])
            
            totalTransactions++
          }
        }
      }
    } catch (error) {
      console.error('Error processing test spreadsheet:', error)
    }
    
    // STEP 5: Сохраняем карты с правильными статусами
    console.log('Saving cards to database...')
    
    for (const card of cardsData) {
      let status: 'available' | 'assigned' | 'used' = 'available'
      let assignedCasino = ''
      
      // Проверяем использование карты
      if (usedCards.has(card.card_number)) {
        status = 'used'
      } else {
        // Проверяем назначение карты казино
        for (const [casino, cards] of casinoCardsMap) {
          if (cards.has(card.card_number)) {
            status = 'assigned'
            assignedCasino = casino
            break
          }
        }
      }
      
      await supabase.from('cards').insert([{
        card_number: card.card_number,
        expiry_date: card.expiry_date,
        cvv: card.cvv,
        bank_name: card.bank_name,
        holder_name: card.holder_name,
        status,
        casino_name: assignedCasino || null,
        sheet: card.sheet,
        month: status !== 'available' ? monthCode : null,
      }])
    }
    
    const elapsed = Date.now() - startTime
    
    console.log('=== SYNC COMPLETED ===')
    
    return NextResponse.json({
      success: true,
      stats: {
        employeesProcessed: employeeMap.size,
        transactionsCreated: totalTransactions,
        cardsTotal: cardsData.length,
        cardsUsed: usedCards.size,
        casinosFound: casinosSet.size,
        timeElapsed: `${elapsed}ms`
      },
      message: `Sync completed successfully`
    })
    
  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
