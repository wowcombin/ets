import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Максимальное время выполнения 5 минут
export const runtime = 'nodejs'
export const revalidate = 0 // Отключаем кэширование

// Константы
const JUNIOR_FOLDER_ID = '1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu'
const TEST_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'
const EXPENSES_SPREADSHEET_ID = '19LmZTOzZoX8eMhGPazMl9g_VPmOZ3YwMURWqcrvKkAU'
const CARDS_SPREADSHEET_ID = '1qmT_Yg09BFpD6UKZz7LFs1SXGPtQYjzNlZ-tytsr3is'
const GBP_TO_USD_RATE = 1.3

// Менеджеры
const MANAGERS: Record<string, { percentage: number; isTest: boolean }> = {
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
  if (typeof value === 'number') return value
  
  let str = String(value).trim()
  str = str.replace(/\s/g, '')
  str = str.replace(',', '.')
  str = str.replace(/[^0-9.-]/g, '')
  
  const parsed = parseFloat(str)
  return isNaN(parsed) ? 0 : parsed
}

function extractCardNumber(value: any): string {
  if (!value) return ''
  return String(value).replace(/[^0-9]/g, '')
}

// Функция для добавления задержки
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function GET() {
  const startTime = Date.now()
  const results = {
    stats: {
      employeesProcessed: 0,
      transactionsCreated: 0,
      cardsProcessed: 0,
      totalGross: 0,
      totalNet: 0,
      totalExpenses: 0,
      salariesCalculated: 0
    },
    details: [] as any[],
    errors: [] as string[],
    employeesList: [] as string[]
  }

  try {
    console.log('=== STARTING SYNC ===')
    
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
    
    // Очищаем старые данные за текущий месяц
    console.log(`Clearing old data for ${monthCode}...`)
    await supabase.from('transactions').delete().eq('month', monthCode)
    await supabase.from('expenses').delete().eq('month', monthCode)
    await supabase.from('salaries').delete().eq('month', monthCode)
    
    // Получаем существующих сотрудников
    const { data: existingEmployees } = await supabase
      .from('employees')
      .select('*')
    
    const employeeMap = new Map()
    existingEmployees?.forEach(emp => {
      employeeMap.set(emp.username, emp.id)
    })
    
    // Создаем/обновляем менеджеров
    for (const [username, data] of Object.entries(MANAGERS)) {
      if (!employeeMap.has(username)) {
        const { data: newEmp } = await supabase
          .from('employees')
          .insert([{
            username,
            folder_id: username === '@sobroffice' ? 'test' : 'manager',
            is_manager: true,
            is_active: true,
            profit_percentage: data.percentage,
            manager_type: data.isTest ? 'test_manager' : 'profit_manager'
          }])
          .select()
          .single()
        
        if (newEmp) {
          employeeMap.set(username, newEmp.id)
          console.log(`Created manager: ${username}`)
        }
      }
    }
    
    // Получаем папки сотрудников
    console.log('Fetching employee folders...')
    const foldersResponse = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name)',
      pageSize: 1000,
    })
    
    const folders = foldersResponse.data.files || []
    console.log(`Found ${folders.length} employee folders`)
    
    // Создаем всех сотрудников
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      const isFired = folder.name.includes('УВОЛЕН')
      
      if (!employeeMap.has(cleanUsername)) {
        const { data: newEmp } = await supabase
          .from('employees')
          .insert([{
            username: cleanUsername,
            folder_id: folder.id,
            is_manager: MANAGERS.hasOwnProperty(cleanUsername),
            is_active: !isFired,
            profit_percentage: MANAGERS[cleanUsername as keyof typeof MANAGERS]?.percentage || 10.00,
            manager_type: null
          }])
          .select()
          .single()
        
        if (newEmp) {
          employeeMap.set(cleanUsername, newEmp.id)
          console.log(`Created employee: ${cleanUsername}`)
        }
      }
      
      results.employeesList.push(cleanUsername)
      results.stats.employeesProcessed++
    }
    
    console.log(`Total employees in map: ${employeeMap.size}`)
    
    // Читаем транзакции
    const allTransactions = []
    let calculatedTotalGross = 0
    
    // Обрабатываем папки сотрудников с задержкой
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      const employeeId = employeeMap.get(cleanUsername)
      
      if (!employeeId) {
        console.log(`WARNING: No ID for ${cleanUsername}`)
        continue
      }
      
      try {
        // Добавляем задержку между запросами
        await delay(100)
        
        // Ищем файл WORK в папке сотрудника
        const workFiles = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'WORK'`,
          fields: 'files(id, name)',
        })
        
        const workFile = workFiles.data.files?.[0]
        if (!workFile?.id) {
          console.log(`No WORK file for ${cleanUsername}`)
          continue
        }
        
        // Увеличиваем диапазон до 10000 строк
        const range = `${monthName}!A2:D10000`
        
        try {
          // Добавляем задержку перед чтением таблицы
          await delay(200)
          
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: workFile.id,
            range,
            majorDimension: 'ROWS',
            valueRenderOption: 'UNFORMATTED_VALUE' // Получаем числа без форматирования
          })
          
          const rows = response.data.values || []
          console.log(`Processing ${rows.length} rows for ${cleanUsername}`)
          
          let employeeTransactionCount = 0
          for (const row of rows) {
            if (row[0]) {
              const depositGbp = parseNumberValue(row[1])
              const withdrawalGbp = parseNumberValue(row[2])
              const cardNumber = extractCardNumber(row[3])
              
              const depositUsd = depositGbp * GBP_TO_USD_RATE
              const withdrawalUsd = withdrawalGbp * GBP_TO_USD_RATE
              const grossProfit = withdrawalUsd - depositUsd
              
              allTransactions.push({
                employee_id: employeeId,
                month: monthCode,
                casino_name: String(row[0]).trim(),
                deposit_gbp: depositGbp,
                withdrawal_gbp: withdrawalGbp,
                deposit_usd: depositUsd,
                withdrawal_usd: withdrawalUsd,
                card_number: cardNumber,
                gross_profit_usd: grossProfit,
                net_profit_usd: grossProfit,
              })
              
              calculatedTotalGross += grossProfit
              employeeTransactionCount++
            }
          }
          
          if (employeeTransactionCount > 0) {
            console.log(`Added ${employeeTransactionCount} transactions for ${cleanUsername}`)
          }
        } catch (e: any) {
          console.log(`No ${monthName} sheet for ${cleanUsername}: ${e.message}`)
        }
      } catch (error: any) {
        console.error(`Error processing ${cleanUsername}:`, error.message)
        results.errors.push(`${cleanUsername}: ${error.message}`)
      }
    }
    
    // Читаем тестовые транзакции @sobroffice
    const sobrofficeId = employeeMap.get('@sobroffice')
    if (sobrofficeId) {
      try {
        await delay(200) // Задержка перед чтением тестовой таблицы
        
        const testRange = `${monthName}!A2:D10000` // Увеличиваем диапазон
        const testResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: TEST_SPREADSHEET_ID,
          range: testRange,
          majorDimension: 'ROWS',
          valueRenderOption: 'UNFORMATTED_VALUE'
        })
        
        const rows = testResponse.data.values || []
        console.log(`Processing ${rows.length} test transactions for @sobroffice`)
        
        let testTransactionCount = 0
        for (const row of rows) {
          if (row[0]) {
            const depositGbp = parseNumberValue(row[1])
            const withdrawalGbp = parseNumberValue(row[2])
            const cardNumber = extractCardNumber(row[3])
            
            const depositUsd = depositGbp * GBP_TO_USD_RATE
            const withdrawalUsd = withdrawalGbp * GBP_TO_USD_RATE
            const grossProfit = withdrawalUsd - depositUsd
            
            allTransactions.push({
              employee_id: sobrofficeId,
              month: monthCode,
              casino_name: String(row[0]).trim(),
              deposit_gbp: depositGbp,
              withdrawal_gbp: withdrawalGbp,
              deposit_usd: depositUsd,
              withdrawal_usd: withdrawalUsd,
              card_number: cardNumber,
              gross_profit_usd: grossProfit,
              net_profit_usd: grossProfit,
            })
            
            calculatedTotalGross += grossProfit
            testTransactionCount++
          }
        }
        
        if (testTransactionCount > 0) {
          console.log(`Added ${testTransactionCount} test transactions`)
        }
      } catch (e: any) {
        console.log(`No test sheet: ${e.message}`)
      }
    }
    
    console.log(`Total transactions to insert: ${allTransactions.length}`)
    console.log(`Calculated total gross: $${calculatedTotalGross.toFixed(2)}`)
    
    // Сохраняем транзакции батчами
    if (allTransactions.length > 0) {
      console.log(`Inserting ${allTransactions.length} transactions in batches...`)
      
      // Разбиваем на батчи по 500 записей
      const batchSize = 500
      for (let i = 0; i < allTransactions.length; i += batchSize) {
        const batch = allTransactions.slice(i, i + batchSize)
        const { error } = await supabase
          .from('transactions')
          .insert(batch)
        
        if (error) {
          console.error(`Batch ${i / batchSize + 1} insert error:`, error)
          results.errors.push(`Batch error: ${error.message}`)
        } else {
          console.log(`Inserted batch ${i / batchSize + 1} (${batch.length} records)`)
        }
        
        // Небольшая задержка между батчами
        await delay(100)
      }
      
      results.stats.transactionsCreated = allTransactions.length
      results.stats.totalGross = calculatedTotalGross
      console.log(`Total inserted: ${allTransactions.length} transactions`)
    }
    
    // Читаем расходы
    try {
      const expenseRange = `${monthName} Spending!B2:B1000`
      const expenseResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: EXPENSES_SPREADSHEET_ID,
        range: expenseRange,
      })
      
      const rows = expenseResponse.data.values || []
      let totalExpenses = 0
      
      rows.forEach(row => {
        if (row[0]) {
          const amount = parseNumberValue(row[0])
          totalExpenses += amount
        }
      })
      
      if (totalExpenses > 0) {
        await supabase.from('expenses').insert([{
          month: monthCode,
          amount_usd: totalExpenses,
        }])
        results.stats.totalExpenses = totalExpenses
        console.log(`Total expenses: $${totalExpenses}`)
      }
    } catch (e: any) {
      console.log(`No expenses found: ${e.message}`)
    }
    
    results.stats.totalNet = results.stats.totalGross - results.stats.totalExpenses
    
    // Карты
    try {
      await supabase.from('cards').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      
      const cardsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: CARDS_SPREADSHEET_ID,
        range: 'REVO UK!A2:E1000',
      })
      
      const cards: any[] = []
      const rows = cardsResponse.data.values || []
      
      rows.forEach(row => {
        if (row[0]) {
          const cardNumber = extractCardNumber(row[0])
          if (cardNumber && cardNumber.length >= 15) {
            cards.push({
              card_number: cardNumber,
              status: 'available',
              sheet: 'REVO UK',
            })
          }
        }
      })
      
      if (cards.length > 0) {
        await supabase.from('cards').insert(cards)
        results.stats.cardsProcessed = cards.length
        console.log(`Inserted ${cards.length} cards`)
      }
    } catch (e: any) {
      console.log(`Cards error: ${e.message}`)
    }
    
    // Проверяем финальные данные в БД
    const { data: finalTransactions } = await supabase
      .from('transactions')
      .select('gross_profit_usd')
      .eq('month', monthCode)
    
    const dbTotalGross = finalTransactions?.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) || 0
    
    console.log(`Final DB total gross: $${dbTotalGross.toFixed(2)}`)
    
    const { count: finalTransCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('month', monthCode)
    
    const { count: finalEmpCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
    
    return NextResponse.json({
      success: true,
      stats: {
        ...results.stats,
        totalGross: dbTotalGross,
        timeElapsed: `${Date.now() - startTime}ms`,
        transactionsInDb: finalTransCount || 0,
        totalEmployeesInDb: finalEmpCount || 0
      },
      month: monthName,
      monthCode,
      details: results.details,
      errors: results.errors,
      employeesList: results.employeesList,
      message: `Обработано ${results.stats.employeesProcessed} сотрудников, ${results.stats.transactionsCreated} транзакций`
    })
    
  } catch (error: any) {
    console.error('SYNC ERROR:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error.stack,
      results
    }, { status: 500 })
  }
}
