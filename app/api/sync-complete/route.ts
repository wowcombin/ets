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

// Менеджеры
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
  const cleaned = String(value).replace(/[^0-9.-]/g, '')
  const parsed = parseFloat(cleaned)
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
    
    // ОЧИЩАЕМ СТАРЫЕ ДАННЫЕ
    console.log('Clearing old data...')
    await supabase.from('transactions').delete().eq('month', monthCode)
    await supabase.from('expenses').delete().eq('month', monthCode)
    await supabase.from('salaries').delete().eq('month', monthCode)
    
    // 1. СОТРУДНИКИ
    console.log('Processing employees...')
    const foldersResponse = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name)',
      pageSize: 100,
    })
    
    const folders = foldersResponse.data.files || []
    const { data: existingEmployees } = await supabase
      .from('employees')
      .select('id, username')
    
    const employeeMap = new Map()
    let employeesProcessed = 0
    
    // Создаем/обновляем сотрудников
    for (const folder of folders) {
      if (folder.id && folder.name) {
        const username = folder.name
        
        // Проверяем, уволен ли сотрудник
        const isFired = username.includes('УВОЛЕН')
        const cleanUsername = username.replace(' УВОЛЕН', '').trim()
        
        const existing = existingEmployees?.find(e => 
          e.username === cleanUsername || e.username === username
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
        
        if (existing) {
          await supabase
            .from('employees')
            .update(employeeData)
            .eq('id', existing.id)
          
          employeeMap.set(cleanUsername, existing.id)
        } else {
          const { data: newEmp } = await supabase
            .from('employees')
            .insert([employeeData])
            .select()
            .single()
          
          if (newEmp) {
            employeeMap.set(cleanUsername, newEmp.id)
          }
        }
        employeesProcessed++
      }
    }
    
    // Добавляем @sobroffice если его нет
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
            is_active: true,
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
    let totalTransactions = 0
    const allCardNumbers = new Set<string>()
    const casinoCards = new Map<string, Set<string>>()
    
    // Обрабатываем каждого сотрудника
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      const employeeId = employeeMap.get(cleanUsername)
      if (!employeeId) continue
      
      try {
        // Ищем файл WORK в папке сотрудника
        const workFiles = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'WORK'`,
          fields: 'files(id, name)',
          pageSize: 5,
        })
        
        const workFile = workFiles.data.files?.[0]
        if (!workFile?.id) {
          console.log(`No WORK file for ${cleanUsername}`)
          continue
        }
        
        // Читаем данные за текущий месяц
        const range = `${monthName}!A2:D500`
        
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
            console.log(`Added ${transactions.length} transactions for ${cleanUsername}`)
          }
        } catch (error) {
          console.log(`Could not read sheet for ${cleanUsername}`)
        }
      } catch (error) {
        console.error(`Error processing ${cleanUsername}:`, error)
      }
    }
    
    // Обрабатываем тестовую таблицу
    try {
      const testRange = `${monthName}!A2:D500`
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
    let totalExpenses = 0
    try {
      const expenseRange = `${monthName} Spending!B2:B100`
      const expenseResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: EXPENSES_SPREADSHEET_ID,
        range: expenseRange,
      })
      
      const rows = expenseResponse.data.values || []
      
      for (const row of rows) {
        if (row[0]) {
          const amount = parseNumberValue(row[0])
          if (amount > 0) {
            totalExpenses += amount
          }
        }
      }
      
      if (totalExpenses > 0) {
        await supabase.from('expenses').insert([{
          month: monthCode,
          amount_usd: totalExpenses,
          description: `${monthName} total expenses`,
        }])
        console.log(`Total expenses: ${totalExpenses}`)
      }
    } catch (error) {
      console.error('Error reading expenses:', error)
    }
    
    // 4. КАРТЫ
    console.log('Processing cards...')
    try {
      const cardsRange = 'REVO UK!A2:A500'
      const cardsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: CARDS_SPREADSHEET_ID,
        range: cardsRange,
      })
      
      const rows = cardsResponse.data.values || []
      
      for (const row of rows) {
        if (row[0]) {
          const cardNumber = extractCardNumber(row[0])
          if (cardNumber && cardNumber.length >= 10) {
            allCardNumbers.add(cardNumber)
          }
        }
      }
      console.log(`Found ${allCardNumbers.size} unique cards`)
    } catch (error) {
      console.error('Error reading cards list:', error)
    }
    
    // Сохраняем карты в базу
    await supabase.from('cards').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    const cardsToInsert = []
    for (const cardNumber of allCardNumbers) {
      let usedInCasino = ''
      let status: 'available' | 'assigned' | 'used' = 'available'
      let assignedTo = null
      
      // Проверяем использование карты
      const { data: cardUsage } = await supabase
        .from('transactions')
        .select('employee_id, casino_name, deposit_gbp')
        .eq('month', monthCode)
        .eq('card_number', cardNumber)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (cardUsage && cardUsage.length > 0) {
        usedInCasino = cardUsage[0].casino_name
        assignedTo = cardUsage[0].employee_id
        status = cardUsage[0].deposit_gbp > 0 ? 'used' : 'assigned'
      }
      
      cardsToInsert.push({
        card_number: cardNumber,
        status,
        casino_name: usedInCasino || null,
        assigned_to: assignedTo,
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
    
    if (allTransactions && allTransactions.length > 0) {
      const totalGross = allTransactions.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0)
      const expenseRatio = totalGross > 0 ? Math.min(totalExpenses / totalGross, 0.2) : 0
      
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
        employeesProcessed,
        transactionsTotal: finalTransCount || 0,
        cardsTotal: cardCount || 0,
        expensesTotal: totalExpenses,
        timeElapsed: `${elapsed}ms`,
      },
      details: {
        month: monthName,
        monthCode,
        processedEmployees: Array.from(employeeMap.keys()),
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
