import { NextResponse, NextRequest } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const JUNIOR_FOLDER_ID = '1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu'
const TEST_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'
const EXPENSES_SPREADSHEET_ID = '19LmZTOzZoX8eMhGPazMl9g_VPmOZ3YwMURWqcrvKkAU'
const CARDS_SPREADSHEET_ID = '1qmT_Yg09BFpD6UKZz7LFs1SXGPtQYjzNlZ-tytsr3is'
const GBP_TO_USD_RATE = 1.3

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
  const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

function extractCardNumber(value: any): string {
  if (!value) return ''
  return String(value).replace(/[^0-9]/g, '')
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('Starting complete sync...')
    
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing Google credentials' 
      }, { status: 500 })
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
    
    // 1. СОТРУДНИКИ
    console.log('Processing employees...')
    const foldersResponse = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name)',
      pageSize: 50,
    })
    
    const folders = foldersResponse.data.files || []
    const { data: existingEmployees } = await supabase
      .from('employees')
      .select('id, username')
    
    const employeeMap = new Map()
    
    // Создаем/обновляем сотрудников
    for (const folder of folders) {
      if (folder.id && folder.name) {
        const existing = existingEmployees?.find(e => e.username === folder.name)
        
        if (existing) {
          employeeMap.set(folder.name, existing.id)
        } else {
          const { data: newEmp } = await supabase
            .from('employees')
            .insert([{
              username: folder.name,
              folder_id: folder.id,
              is_manager: ['@sobroffice', '@vladsohr', '@n1mbo', '@i88jU'].includes(folder.name),
              profit_percentage: folder.name === '@vladsohr' || folder.name === '@i88jU' ? 5.00 : 10.00,
            }])
            .select()
            .single()
          
          if (newEmp) {
            employeeMap.set(folder.name, newEmp.id)
          }
        }
      }
    }
    
    // Добавляем @sobroffice
    if (!employeeMap.has('@sobroffice')) {
      const existing = existingEmployees?.find(e => e.username === '@sobroffice')
      if (existing) {
        employeeMap.set('@sobroffice', existing.id)
      } else {
        const { data: newEmp } = await supabase
          .from('employees')
          .insert([{
            username: '@sobroffice',
            folder_id: 'test',
            is_manager: true,
            profit_percentage: 10.00,
          }])
          .select()
          .single()
        
        if (newEmp) {
          employeeMap.set('@sobroffice', newEmp.id)
        }
      }
    }
    
    // 2. ТРАНЗАКЦИИ
    console.log('Processing transactions...')
    await supabase.from('transactions').delete().eq('month', monthCode)
    
    let totalTransactions = 0
    const allCardNumbers = new Set<string>()
    const casinoCards = new Map<string, Set<string>>() // казино -> набор карт
    
    // Обрабатываем каждого сотрудника
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      const employeeId = employeeMap.get(folder.name)
      if (!employeeId) continue
      
      try {
        const workFiles = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'WORK'`,
          fields: 'files(id, name)',
          pageSize: 5,
        })
        
        const workFile = workFiles.data.files?.[0]
        if (!workFile?.id) continue
        
        const range = `${monthName}!A2:D200`
        
        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: workFile.id,
            range,
          })
          
          const rows = response.data.values || []
          const transactions = []
          
          for (const row of rows) {
            if (row[0]) {
              const casino = String(row[0]).trim()
              const depositGbp = parseNumberValue(row[1])
              const withdrawalGbp = parseNumberValue(row[2])
              const cardNumber = extractCardNumber(row[3])
              
              if (cardNumber) {
                allCardNumbers.add(cardNumber)
                if (!casinoCards.has(casino)) {
                  casinoCards.set(casino, new Set())
                }
                casinoCards.get(casino)?.add(cardNumber)
              }
              
              const depositUsd = depositGbp * GBP_TO_USD_RATE
              const withdrawalUsd = withdrawalGbp * GBP_TO_USD_RATE
              const grossProfit = withdrawalUsd - depositUsd
              
              transactions.push({
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
              })
            }
          }
          
          if (transactions.length > 0) {
            await supabase.from('transactions').insert(transactions)
            totalTransactions += transactions.length
            console.log(`Added ${transactions.length} transactions for ${folder.name}`)
          }
        } catch (error) {
          console.log(`Could not read sheet for ${folder.name}`)
        }
      } catch (error) {
        console.error(`Error processing ${folder.name}:`, error)
      }
    }
    
    // Обрабатываем тестовую таблицу
    try {
      const testRange = `${monthName}!A2:D200`
      const testResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: testRange,
      })
      
      const rows = testResponse.data.values || []
      const transactions = []
      const sobrofficeId = employeeMap.get('@sobroffice')
      
      if (sobrofficeId) {
        for (const row of rows) {
          if (row[0]) {
            const casino = String(row[0]).trim()
            const depositGbp = parseNumberValue(row[1])
            const withdrawalGbp = parseNumberValue(row[2])
            const cardNumber = extractCardNumber(row[3])
            
            if (cardNumber) {
              allCardNumbers.add(cardNumber)
              if (!casinoCards.has(casino)) {
                casinoCards.set(casino, new Set())
              }
              casinoCards.get(casino)?.add(cardNumber)
            }
            
            const depositUsd = depositGbp * GBP_TO_USD_RATE
            const withdrawalUsd = withdrawalGbp * GBP_TO_USD_RATE
            const grossProfit = withdrawalUsd - depositUsd
            
            transactions.push({
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
            })
          }
        }
        
        if (transactions.length > 0) {
          await supabase.from('transactions').insert(transactions)
          totalTransactions += transactions.length
          console.log(`Added ${transactions.length} test transactions`)
        }
      }
    } catch (error) {
      console.error('Error processing test spreadsheet:', error)
    }
    
    // 3. РАСХОДЫ
    console.log('Processing expenses...')
    try {
      const expenseRange = `${monthName} Spending!B2:B100`
      const expenseResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: EXPENSES_SPREADSHEET_ID,
        range: expenseRange,
      })
      
      const rows = expenseResponse.data.values || []
      let totalExpenses = 0
      
      for (const row of rows) {
        if (row[0]) {
          totalExpenses += parseNumberValue(row[0])
        }
      }
      
      if (totalExpenses > 0) {
        await supabase.from('expenses').delete().eq('month', monthCode)
        await supabase.from('expenses').insert([{
          month: monthCode,
          amount_usd: totalExpenses,
          description: `${monthName} total expenses`,
        }])
        console.log(`Total expenses: $${totalExpenses}`)
      }
    } catch (error) {
      console.error('Error reading expenses:', error)
    }
    
    // 4. КАРТЫ
    console.log('Processing cards...')
    
    // Читаем все карты из REVO UK
    try {
      const cardsRange = 'REVO UK!A2:A200'
      const cardsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: CARDS_SPREADSHEET_ID,
        range: cardsRange,
      })
      
      const rows = cardsResponse.data.values || []
      
      for (const row of rows) {
        if (row[0]) {
          const cardNumber = extractCardNumber(row[0])
          if (cardNumber) {
            allCardNumbers.add(cardNumber)
          }
        }
      }
      console.log(`Found ${allCardNumbers.size} unique cards`)
    } catch (error) {
      console.error('Error reading cards list:', error)
    }
    
    // Читаем список казино из August themes
    const allCasinos = new Set<string>()
    try {
      const themesRange = `${monthName} themes!A2:A100`
      const themesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: themesRange,
      })
      
      const rows = themesResponse.data.values || []
      for (const row of rows) {
        if (row[0]) {
          allCasinos.add(String(row[0]).trim())
        }
      }
      console.log(`Found ${allCasinos.size} casinos in themes`)
    } catch (error) {
      console.error('Error reading themes:', error)
    }
    
    // Сохраняем карты в базу
    await supabase.from('cards').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    const cardsToInsert = []
    for (const cardNumber of allCardNumbers) {
      // Находим казино где использовалась карта
      let usedInCasino = ''
      let status: 'available' | 'assigned' | 'used' = 'available'
      
      for (const [casino, cards] of casinoCards) {
        if (cards.has(cardNumber)) {
          usedInCasino = casino
          // Проверяем была ли карта использована (есть депозит)
          const { data: transaction } = await supabase
            .from('transactions')
            .select('id')
            .eq('month', monthCode)
            .eq('card_number', cardNumber)
            .eq('casino_name', casino)
            .gt('deposit_gbp', 0)
            .single()
          
          status = transaction ? 'used' : 'assigned'
          break
        }
      }
      
      cardsToInsert.push({
        card_number: cardNumber,
        status,
        casino_name: usedInCasino || null,
        month: status !== 'available' ? monthCode : null,
      })
    }
    
    if (cardsToInsert.length > 0) {
      await supabase.from('cards').insert(cardsToInsert)
      console.log(`Saved ${cardsToInsert.length} cards`)
    }
    
    // 5. ПЕРЕСЧЕТ НЕТТО С УЧЕТОМ РАСХОДОВ
    console.log('Recalculating net profit...')
    const { data: allTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('month', monthCode)
    
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount_usd')
      .eq('month', monthCode)
      .single()
    
    if (allTransactions && allTransactions.length > 0) {
      const totalGross = allTransactions.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0)
      const totalExpenses = expenses?.amount_usd || 0
      const expenseRatio = totalGross > 0 ? Math.min(totalExpenses / totalGross, 0.2) : 0
      
      // Обновляем net_profit для всех транзакций
      for (const transaction of allTransactions) {
        const netProfit = transaction.gross_profit_usd * (1 - expenseRatio)
        await supabase
          .from('transactions')
          .update({ net_profit_usd: netProfit })
          .eq('id', transaction.id)
      }
      
      console.log(`Updated net profit with expense ratio: ${(expenseRatio * 100).toFixed(2)}%`)
    }
    
    const elapsed = Date.now() - startTime
    
    // Финальная статистика
    const { count: finalTransCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('month', monthCode)
    
    const { count: cardCount } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
    
    return NextResponse.json({
      success: true,
      stats: {
        employeesTotal: employeeMap.size,
        transactionsTotal: finalTransCount || 0,
        cardsTotal: cardCount || 0,
        casinosTotal: allCasinos.size,
        timeElapsed: `${elapsed}ms`,
      },
      details: {
        month: monthName,
        monthCode,
        usedCards: Array.from(casinoCards.entries()).map(([casino, cards]) => ({
          casino,
          cards: cards.size
        }))
      },
      message: `Complete sync finished in ${elapsed}ms`
    })
    
  } catch (error: any) {
    console.error('Complete sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error
    }, { status: 500 })
  }
}
