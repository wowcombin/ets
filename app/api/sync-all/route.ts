// app/api/sync-all/route.ts
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
const THEMES_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'
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
      salariesCalculated: 0,
      firedEmployees: 0,
      activeEmployees: 0
    },
    details: [] as any[],
    errors: [] as string[],
    employeesList: [] as any[],
    transactionsByEmployee: {} as Record<string, number>,
    cardThemes: {} as Record<string, string[]>,
    workSessionsAnalyzed: 0
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
    
    // НЕ удаляем транзакции! Только обновляем/добавляем новые
    console.log(`Updating data for ${monthCode} (not deleting existing)...`)
    
    // Очищаем только расходы и зарплаты для пересчета
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
      } else {
        await supabase
          .from('employees')
          .update({
            is_manager: true,
            is_active: true,
            profit_percentage: data.percentage,
            manager_type: data.isTest ? 'test_manager' : 'profit_manager',
            updated_at: new Date().toISOString()
          })
          .eq('username', username)
      }
    }
    
    // Получаем папки сотрудников из Google Drive
    console.log('Fetching employee folders from Google Drive...')
    const foldersResponse = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name)',
      pageSize: 1000,
    })
    
    const folders = foldersResponse.data.files || []
    console.log(`Found ${folders.length} employee folders`)
    
    // Обрабатываем папки сотрудников
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      // ВАЖНО: Проверяем наличие слова "УВОЛЕН" в названии папки
      const isFired = folder.name.includes('УВОЛЕН')
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      
      console.log(`Processing folder: ${folder.name}`)
      console.log(`  Username: ${cleanUsername}`)
      console.log(`  Is fired: ${isFired}`)
      
      if (!employeeMap.has(cleanUsername)) {
        // Создаем нового сотрудника
        const { data: newEmp, error: createError } = await supabase
          .from('employees')
          .insert([{
            username: cleanUsername,
            folder_id: folder.id,
            is_manager: MANAGERS.hasOwnProperty(cleanUsername),
            is_active: !isFired, // Устанавливаем is_active = false если есть слово УВОЛЕН
            profit_percentage: MANAGERS[cleanUsername]?.percentage || 10.00,
            manager_type: MANAGERS[cleanUsername]?.isTest ? 'test_manager' : 
                         MANAGERS[cleanUsername] ? 'profit_manager' : null
          }])
          .select()
          .single()
        
        if (createError) {
          console.error(`Error creating employee ${cleanUsername}:`, createError)
          results.errors.push(`Failed to create ${cleanUsername}: ${createError.message}`)
        } else if (newEmp) {
          employeeMap.set(cleanUsername, newEmp.id)
          console.log(`Created new employee: ${cleanUsername}, active: ${!isFired}`)
        }
      } else {
        // Обновляем существующего сотрудника
        const { error: updateError } = await supabase
          .from('employees')
          .update({ 
            is_active: !isFired,
            folder_id: folder.id,
            updated_at: new Date().toISOString()
          })
          .eq('username', cleanUsername)
        
        if (updateError) {
          console.error(`Error updating ${cleanUsername}:`, updateError)
          results.errors.push(`Failed to update ${cleanUsername}: ${updateError.message}`)
        } else {
          console.log(`Updated ${cleanUsername}: is_active=${!isFired}`)
        }
      }
      
      // Добавляем в список обработанных
      results.employeesList.push({
        username: cleanUsername,
        isFired: isFired,
        folderId: folder.id
      })
      
      // Считаем статистику
      if (isFired) {
        results.stats.firedEmployees++
      } else {
        results.stats.activeEmployees++
      }
      
      results.stats.employeesProcessed++
    }
    
    console.log(`Total employees processed: ${results.stats.employeesProcessed}`)
    console.log(`Active: ${results.stats.activeEmployees}, Fired: ${results.stats.firedEmployees}`)
    
    // Массив для всех транзакций
    const allTransactions = []
    let calculatedTotalGross = 0
    let processedEmployees = 0
    
    // Обрабатываем транзакции каждого сотрудника
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
          await delay(500)
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
                  last_updated: new Date().toISOString(),
                  sync_timestamp: new Date().toISOString()
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
              last_updated: new Date().toISOString(),
              sync_timestamp: new Date().toISOString()
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
    
    // Читаем темы карт
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
      
      // Обновляем статусы карт
      for (const cardNumber of usedCardsInThemes) {
        let assignedCasino = ''
        for (const [casino, cards] of Object.entries(results.cardThemes)) {
          if (cards.includes(cardNumber)) {
            assignedCasino = casino
            break
          }
        }
        
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
    
    // Сохраняем только новые транзакции (не перезаписываем существующие)
    if (allTransactions.length > 0) {
      const batchSize = 500
      let insertedCount = 0
      
      for (let i = 0; i < allTransactions.length; i += batchSize) {
        const batch = allTransactions.slice(i, i + batchSize)
        
        // Проверяем какие транзакции уже существуют
        const existingCheck = await supabase
          .from('transactions')
          .select('id, employee_id, casino_name, deposit_usd, withdrawal_usd, card_number')
          .eq('month', monthCode)
        
        const existingTransactions = new Set()
        existingCheck.data?.forEach(t => {
          const key = `${t.employee_id}_${t.casino_name}_${t.deposit_usd}_${t.withdrawal_usd}_${t.card_number || ''}`
          existingTransactions.add(key)
        })
        
        // Фильтруем только новые транзакции
        const newTransactions = batch.filter(t => {
          const key = `${t.employee_id}_${t.casino_name}_${t.deposit_usd}_${t.withdrawal_usd}_${t.card_number || ''}`
          return !existingTransactions.has(key)
        })
        
        if (newTransactions.length > 0) {
          const { error, data } = await supabase
            .from('transactions')
            .insert(newTransactions)
            .select()
          
          if (error) {
            console.error(`Batch insert error:`, error)
            results.errors.push(`Batch error: ${error.message}`)
          } else {
            insertedCount += data?.length || 0
            console.log(`Inserted ${data?.length} new transactions (skipped ${batch.length - newTransactions.length} existing)`)
          }
        } else {
          console.log(`Skipped batch - all ${batch.length} transactions already exist`)
        }
        
        await delay(100)
      }
      
      console.log(`Total new transactions inserted: ${insertedCount}`)
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
    
    // Проверяем финальные данные в БД - получаем ВСЕ транзакции для правильного подсчета
    console.log('Calculating final totals from ALL transactions in database...')
    let allDbTransactions: any[] = []
    let from = 0
    const limit = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('transactions')
        .select('gross_profit_usd')
        .eq('month', monthCode)
        .range(from, from + limit - 1)
      
      if (batchError) {
        console.error(`Error fetching final batch from ${from}:`, batchError)
        break
      }
      
      if (batch && batch.length > 0) {
        allDbTransactions = [...allDbTransactions, ...batch]
        from += limit
        hasMore = batch.length === limit
      } else {
        hasMore = false
      }
    }
    
    const dbTotalGross = allDbTransactions.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0)
    
    console.log(`\n=== FINAL VERIFICATION ===`)
    console.log(`New transactions from sheets: ${allTransactions.length}`)
    console.log(`Calculated gross from sheets: $${calculatedTotalGross.toFixed(2)}`)
    console.log(`Total transactions in DB: ${allDbTransactions.length}`)
    console.log(`Total gross in DB: $${dbTotalGross.toFixed(2)}`)
    console.log(`Active employees: ${results.stats.activeEmployees}`)
    console.log(`Fired employees: ${results.stats.firedEmployees}`)
    
    const { count: finalEmpCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
    
    results.stats.totalGross = dbTotalGross
    results.stats.totalNet = dbTotalGross - results.stats.totalExpenses
    
    // Автоматически анализируем рабочие сессии после синхронизации
    try {
      console.log('Starting automatic work sessions analysis...')
      const workSessionsResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/work-sessions/auto-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (workSessionsResponse.ok) {
        const workSessionsResult = await workSessionsResponse.json()
        console.log('Work sessions analysis completed:', workSessionsResult.message)
        // Добавляем информацию о рабочих сессиях в результат (но не в stats)
        results.workSessionsAnalyzed = workSessionsResult.data?.createdSessions || 0
      } else {
        console.error('Work sessions analysis failed:', await workSessionsResponse.text())
      }
    } catch (workSessionError) {
      console.error('Work sessions analysis error:', workSessionError)
      // Не прерываем основную синхронизацию из-за ошибки анализа сессий
    }
    
    return NextResponse.json({
      success: true,
      stats: {
        ...results.stats,
        timeElapsed: `${Date.now() - startTime}ms`,
        transactionsInDb: allDbTransactions.length,
        totalEmployeesInDb: finalEmpCount || 0
      },
      month: monthName,
      monthCode,
      details: results.transactionsByEmployee,
      cardThemes: results.cardThemes,
      errors: results.errors,
      employeesList: results.employeesList,
      workSessionsAnalyzed: results.workSessionsAnalyzed || 0,
      message: `Обработано ${results.stats.employeesProcessed} сотрудников (активных: ${results.stats.activeEmployees}, уволенных: ${results.stats.firedEmployees}), ${results.stats.transactionsCreated} транзакций. Создано ${results.workSessionsAnalyzed || 0} рабочих сессий.`
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
