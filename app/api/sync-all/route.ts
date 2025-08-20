import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
export const runtime = 'nodejs'
export const revalidate = 0

// Константы
const JUNIOR_FOLDER_ID = '1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu'
const TEST_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'
const EXPENSES_SPREADSHEET_ID = '19LmZTOzZoX8eMhGPazMl9g_VPmOZ3YwMURWqcrvKkAU'
const CARDS_SPREADSHEET_ID = '1qmT_Yg09BFpD6UKZz7LFs1SXGPtQYjzNlZ-tytsr3is'
const THEMES_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA' // Та же таблица что и TEST
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
  if (!value && value !== 0) return 0
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
      themesProcessed: 0,
      totalGross: 0,
      totalNet: 0,
      totalExpenses: 0,
      salariesCalculated: 0
    },
    details: [] as any[],
    errors: [] as string[],
    employeesList: [] as string[],
    transactionsByEmployee: {} as Record<string, number>,
    cardThemes: {} as Record<string, string[]>
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
    
    // ВАЖНО: Очищаем ВСЕ старые данные за текущий месяц
    console.log(`Clearing ALL old data for ${monthCode}...`)
    
    const { error: delTransError } = await supabase
      .from('transactions')
      .delete()
      .eq('month', monthCode)
    
    if (delTransError) {
      console.error('Error deleting transactions:', delTransError)
    }
    
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
        // Создаем нового сотрудника
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
          console.log(`Created new employee: ${cleanUsername}, active: ${!isFired}`)
        }
      } else {
        // ВАЖНО: Обновляем статус существующего сотрудника при каждой синхронизации
        const { error: updateError } = await supabase
          .from('employees')
          .update({ 
            is_active: !isFired,
            folder_id: folder.id,
            updated_at: new Date().toISOString()
          })
          .eq('username', cleanUsername)
        
        if (!updateError) {
          console.log(`Updated ${cleanUsername} status: active=${!isFired}`)
        } else {
          console.error(`Error updating ${cleanUsername}:`, updateError)
        }
      }
      
      results.employeesList.push(cleanUsername)
      results.stats.employeesProcessed++
    }
    
    console.log(`Total employees in map: ${employeeMap.size}`)
    
    // Массив для всех транзакций
    const allTransactions = []
    let calculatedTotalGross = 0
    let processedEmployees = 0
    
    // Обрабатываем папки сотрудников последовательно
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i]
      if (!folder.id || !folder.name) continue
      
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      const employeeId = employeeMap.get(cleanUsername)
      
      if (!employeeId) {
        console.log(`WARNING: No ID for ${cleanUsername}`)
        continue
      }
      
      try {
        // Небольшая задержка между запросами
        if (i > 0 && i % 5 === 0) {
          await delay(500) // Задержка каждые 5 сотрудников
        }
        
        // Ищем файл WORK
        const workFiles = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'WORK'`,
          fields: 'files(id, name)',
        })
        
        const workFile = workFiles.data.files?.[0]
        if (!workFile?.id) {
          console.log(`No WORK file for ${cleanUsername}`)
          continue
        }
        
        const range = `${monthName}!A2:D10000`
        
        try {
          await delay(100)
          
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: workFile.id,
            range,
            majorDimension: 'ROWS',
            valueRenderOption: 'UNFORMATTED_VALUE'
          })
          
          const rows = response.data.values || []
          
          if (rows.length > 0) {
            let employeeGross = 0
            let employeeTransactionCount = 0
            
            for (const row of rows) {
              // Проверяем что есть хотя бы казино
              if (row[0]) {
                const depositGbp = parseNumberValue(row[1])
                const withdrawalGbp = parseNumberValue(row[2])
                const cardNumber = extractCardNumber(row[3])
                
                const depositUsd = Math.round(depositGbp * GBP_TO_USD_RATE * 100) / 100
                const withdrawalUsd = Math.round(withdrawalGbp * GBP_TO_USD_RATE * 100) / 100
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
                
                employeeGross += grossProfit
                calculatedTotalGross += grossProfit
                employeeTransactionCount++
              }
            }
            
            if (employeeTransactionCount > 0) {
              console.log(`${cleanUsername}: ${employeeTransactionCount} transactions, gross: $${employeeGross.toFixed(2)}`)
              results.transactionsByEmployee[cleanUsername] = employeeGross
              processedEmployees++
            }
          }
        } catch (e: any) {
          console.log(`Error reading ${monthName} sheet for ${cleanUsername}: ${e.message}`)
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
        await delay(200)
        
        const testRange = `${monthName}!A2:D10000`
        const testResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: TEST_SPREADSHEET_ID,
          range: testRange,
          majorDimension: 'ROWS',
          valueRenderOption: 'UNFORMATTED_VALUE'
        })
        
        const rows = testResponse.data.values || []
        let testGross = 0
        let testTransactionCount = 0
        
        for (const row of rows) {
          if (row[0]) {
            const depositGbp = parseNumberValue(row[1])
            const withdrawalGbp = parseNumberValue(row[2])
            const cardNumber = extractCardNumber(row[3])
            
            const depositUsd = Math.round(depositGbp * GBP_TO_USD_RATE * 100) / 100
            const withdrawalUsd = Math.round(withdrawalGbp * GBP_TO_USD_RATE * 100) / 100
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
            
            testGross += grossProfit
            calculatedTotalGross += grossProfit
            testTransactionCount++
          }
        }
        
        if (testTransactionCount > 0) {
          console.log(`@sobroffice TEST: ${testTransactionCount} transactions, gross: $${testGross.toFixed(2)}`)
          results.transactionsByEmployee['@sobroffice'] = (results.transactionsByEmployee['@sobroffice'] || 0) + testGross
        }
      } catch (e: any) {
        console.log(`Error reading test sheet: ${e.message}`)
      }
    }
    
    // НОВОЕ: Читаем August themes для статусов карт
    try {
      console.log(`Reading ${monthName} themes...`)
      const themesRange = `${monthName} themes!A2:Z1000`
      const themesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: THEMES_SPREADSHEET_ID,
        range: themesRange,
        majorDimension: 'ROWS',
        valueRenderOption: 'UNFORMATTED_VALUE'
      })
      
      const themesRows = themesResponse.data.values || []
      const usedCardsInThemes = new Set<string>()
      
      for (const row of themesRows) {
        if (row[0]) {
          const casino = String(row[0]).trim()
          const cardsForCasino: string[] = []
          
          // Собираем все карты для этого казино (начиная с колонки B)
          for (let i = 1; i < row.length; i++) {
            if (row[i]) {
              const cardNumber = extractCardNumber(row[i])
              if (cardNumber) {
                cardsForCasino.push(cardNumber)
                usedCardsInThemes.add(cardNumber)
              }
            }
          }
          
          if (cardsForCasino.length > 0) {
            results.cardThemes[casino] = cardsForCasino
            console.log(`${casino}: ${cardsForCasino.length} cards`)
          }
        }
      }
      
      results.stats.themesProcessed = usedCardsInThemes.size
      console.log(`Total unique cards in themes: ${usedCardsInThemes.size}`)
      
      // Обновляем статусы карт на основе themes
      for (const cardNumber of usedCardsInThemes) {
        // Находим в каком казино используется эта карта
        let assignedCasino = ''
        for (const [casino, cards] of Object.entries(results.cardThemes)) {
          if (cards.includes(cardNumber)) {
            assignedCasino = casino
            break
          }
        }
        
        // Обновляем статус карты в базе данных
        await supabase
          .from('cards')
          .update({ 
            status: 'used',
            casino_name: assignedCasino,
            updated_at: new Date().toISOString()
          })
          .eq('card_number', cardNumber)
      }
      
    } catch (e: any) {
      console.log(`Error reading themes: ${e.message}`)
      results.errors.push(`Themes: ${e.message}`)
    }
    
    console.log(`\n=== SYNC SUMMARY ===`)
    console.log(`Total transactions collected: ${allTransactions.length}`)
    console.log(`Total gross calculated: $${calculatedTotalGross.toFixed(2)}`)
    console.log(`Employees with transactions: ${processedEmployees}`)
    
    // Сохраняем транзакции батчами
    if (allTransactions.length > 0) {
      const batchSize = 500
      let insertedCount = 0
      
      for (let i = 0; i < allTransactions.length; i += batchSize) {
        const batch = allTransactions.slice(i, i + batchSize)
        const { error, data } = await supabase
          .from('transactions')
          .insert(batch)
          .select()
        
        if (error) {
          console.error(`Batch insert error:`, error)
          results.errors.push(`Batch error: ${error.message}`)
        } else {
          insertedCount += data?.length || 0
          console.log(`Inserted batch: ${data?.length} records`)
        }
        
        await delay(100)
      }
      
      console.log(`Total inserted to DB: ${insertedCount} transactions`)
      results.stats.transactionsCreated = insertedCount
    }
    
    // Читаем расходы
    try {
      const expenseRange = `${monthName} Spending!B2:B1000`
      const expenseResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: EXPENSES_SPREADSHEET_ID,
        range: expenseRange,
        valueRenderOption: 'UNFORMATTED_VALUE'
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
      }
    } catch (e: any) {
      console.log(`No expenses found: ${e.message}`)
    }
    
    // Карты
    try {
      await supabase.from('cards').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      
      const cardsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: CARDS_SPREADSHEET_ID,
        range: 'REVO UK!A2:E1000',
        valueRenderOption: 'UNFORMATTED_VALUE'
      })
      
      const cards: any[] = []
      const rows = cardsResponse.data.values || []
      
      rows.forEach(row => {
        if (row[0]) {
          const cardNumber = extractCardNumber(row[0])
          if (cardNumber && cardNumber.length >= 15) {
            // Проверяем, использована ли карта в themes
            const isUsed = results.cardThemes && Object.values(results.cardThemes).some(
              (casinoCards: any) => casinoCards.includes(cardNumber)
            )
            
            cards.push({
              card_number: cardNumber,
              status: isUsed ? 'used' : 'available',
              sheet: 'REVO UK',
              casino_name: isUsed ? Object.keys(results.cardThemes).find(
                casino => results.cardThemes[casino].includes(cardNumber)
              ) : null
            })
          }
        }
      })
      
      if (cards.length > 0) {
        await supabase.from('cards').insert(cards)
        results.stats.cardsProcessed = cards.length
      }
    } catch (e: any) {
      console.log(`Cards error: ${e.message}`)
    }
    
    // ВАЖНО: Проверяем финальные данные в БД
    const { data: finalTransactions, error: finalError } = await supabase
      .from('transactions')
      .select('gross_profit_usd')
      .eq('month', monthCode)
    
    if (finalError) {
      console.error('Error fetching final transactions:', finalError)
    }
    
    const dbTotalGross = finalTransactions?.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) || 0
    
    console.log(`\n=== FINAL VERIFICATION ===`)
    console.log(`Calculated gross: $${calculatedTotalGross.toFixed(2)}`)
    console.log(`Database gross: $${dbTotalGross.toFixed(2)}`)
    console.log(`Difference: $${(calculatedTotalGross - dbTotalGross).toFixed(2)}`)
    console.log(`Cards with themes: ${results.stats.themesProcessed}`)
    
    const { count: finalTransCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('month', monthCode)
    
    const { count: finalEmpCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
    
    // Используем значение из БД как финальное
    results.stats.totalGross = dbTotalGross
    results.stats.totalNet = dbTotalGross - results.stats.totalExpenses
    
    return NextResponse.json({
      success: true,
      stats: {
        ...results.stats,
        timeElapsed: `${Date.now() - startTime}ms`,
        transactionsInDb: finalTransCount || 0,
        totalEmployeesInDb: finalEmpCount || 0
      },
      month: monthName,
      monthCode,
      details: results.transactionsByEmployee,
      cardThemes: results.cardThemes,
      errors: results.errors,
      employeesList: results.employeesList,
      message: `Обработано ${results.stats.employeesProcessed} сотрудников, ${results.stats.transactionsCreated} транзакций, ${results.stats.themesProcessed} карт с темами`
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
