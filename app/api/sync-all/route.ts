import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Константы
const JUNIOR_FOLDER_ID = '1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu'
const TEST_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'
const EXPENSES_SPREADSHEET_ID = '19LmZTOzZoX8eMhGPazMl9g_VPmOZ3YwMURWqcrvKkAU'
const CARDS_SPREADSHEET_ID = '1qmT_Yg09BFpD6UKZz7LFs1SXGPtQYjzNlZ-tytsr3is'
const GBP_TO_USD_RATE = 1.3

// Менеджеры и их проценты
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
  
  let str = String(value).trim()
  
  if (typeof value === 'number') {
    return value
  }
  
  // Обрабатываем европейский формат с пробелами: "5 311,00" -> "5311.00"
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
    console.log('=== STARTING COMPLETE SYNC ===')
    
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
      throw new Error('Missing Google credentials')
    }

    const monthName = getCurrentMonthName()
    const monthCode = getCurrentMonthCode()
    console.log(`Syncing data for ${monthName} (${monthCode})`)
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
      ],
    })

    const drive = google.drive({ version: 'v3', auth })
    const sheets = google.sheets({ version: 'v4', auth })
    const supabase = getServiceSupabase()
    
    // ВАЖНО: Полностью очищаем ВСЕ старые данные за текущий месяц
    console.log('Clearing ALL old data for current month...')
    
    // Удаляем транзакции
    const { error: delTransError } = await supabase
      .from('transactions')
      .delete()
      .eq('month', monthCode)
    
    if (delTransError) {
      console.error('Error deleting transactions:', delTransError)
    }
    
    // Удаляем расходы
    const { error: delExpError } = await supabase
      .from('expenses')
      .delete()
      .eq('month', monthCode)
    
    if (delExpError) {
      console.error('Error deleting expenses:', delExpError)
    }
    
    // Удаляем зарплаты
    const { error: delSalError } = await supabase
      .from('salaries')
      .delete()
      .eq('month', monthCode)
    
    if (delSalError) {
      console.error('Error deleting salaries:', delSalError)
    }
    
    console.log('Old data cleared successfully')
    
    // STEP 1: Создаем/обновляем всех менеджеров ПЕРВЫМИ
    console.log('Processing managers first...')
    const { data: existingEmployees } = await supabase
      .from('employees')
      .select('*')
    
    const employeeMap = new Map()
    
    // Сначала обрабатываем менеджеров
    for (const [managerUsername, managerData] of Object.entries(MANAGERS)) {
      let manager = existingEmployees?.find(e => e.username === managerUsername)
      
      const employeeData = {
        username: managerUsername,
        folder_id: managerUsername === '@sobroffice' ? 'test' : 'manager',
        is_manager: true,
        is_active: true,
        profit_percentage: managerData.percentage,
        manager_type: managerData.isTest ? 'test_manager' : 'profit_manager'
      }
      
      if (manager) {
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', manager.id)
        
        if (!error) {
          employeeMap.set(managerUsername, manager.id)
          console.log(`Updated manager: ${managerUsername}`)
        }
      } else {
        const { data: newEmp, error } = await supabase
          .from('employees')
          .insert([employeeData])
          .select()
          .single()
        
        if (newEmp && !error) {
          manager = newEmp
          employeeMap.set(managerUsername, newEmp.id)
          console.log(`Created manager: ${managerUsername}`)
        }
      }
      
      if (manager) {
        results.stats.employeesProcessed++
        results.employeesList.push(managerUsername)
      }
    }
    
    // STEP 2: Получаем папки сотрудников
    console.log('Getting employee folders...')
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
      
      const isFired = folder.name.includes('УВОЛЕН')
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      
      // Пропускаем менеджеров - мы их уже обработали
      if (MANAGERS.hasOwnProperty(cleanUsername)) {
        console.log(`Skipping manager folder: ${cleanUsername}`)
        continue
      }
      
      let employee = existingEmployees?.find(e => 
        e.username === cleanUsername || e.username === folder.name
      )
      
      const employeeData = {
        username: cleanUsername,
        folder_id: folder.id,
        is_manager: false,
        is_active: !isFired,
        profit_percentage: 10.00,
        manager_type: null
      }
      
      if (employee) {
        await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', employee.id)
        
        employeeMap.set(cleanUsername, employee.id)
      } else {
        const { data: newEmp, error } = await supabase
          .from('employees')
          .insert([employeeData])
          .select()
          .single()
        
        if (newEmp && !error) {
          employee = newEmp
          employeeMap.set(cleanUsername, newEmp.id)
        }
      }
      
      if (employee) {
        results.stats.employeesProcessed++
        results.employeesList.push(cleanUsername)
      }
    }
    
    console.log(`Total employees in system: ${employeeMap.size}`)
    
    // STEP 3: Читаем транзакции из папок сотрудников
    console.log('Reading employee transactions...')
    let allTransactions = []
    
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      const employeeId = employeeMap.get(cleanUsername)
      
      if (!employeeId) {
        console.log(`No employee ID for ${cleanUsername}`)
        continue
      }
      
      try {
        const workFiles = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'WORK'`,
          fields: 'files(id, name)',
          pageSize: 10,
        })
        
        const workFile = workFiles.data.files?.[0]
        if (!workFile?.id) {
          console.log(`No WORK file for ${cleanUsername}`)
          continue
        }
        
        // Проверяем наличие листа
        try {
          const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: workFile.id,
            fields: 'sheets.properties.title'
          })
          
          const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title) || []
          
          if (!sheetNames.includes(monthName)) {
            console.log(`No ${monthName} sheet for ${cleanUsername}`)
            continue
          }
        } catch (e) {
          console.log(`Cannot read sheets for ${cleanUsername}`)
          continue
        }
        
        // Читаем транзакции
        const range = `${monthName}!A2:D5000`
        
        try {
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
              
              const depositUsd = depositGbp * GBP_TO_USD_RATE
              const withdrawalUsd = withdrawalGbp * GBP_TO_USD_RATE
              const grossProfit = withdrawalUsd - depositUsd
              
              allTransactions.push({
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
              
              results.stats.totalGross += grossProfit
            }
          }
          
          console.log(`Found ${rows.filter(r => r[0]).length} transactions for ${cleanUsername}`)
        } catch (sheetError: any) {
          console.log(`Error reading sheet for ${cleanUsername}:`, sheetError.message)
        }
      } catch (error: any) {
        console.error(`Error processing ${cleanUsername}:`, error.message)
      }
    }
    
    // STEP 4: Читаем тестовые транзакции @sobroffice
    console.log('Reading test transactions...')
    
    try {
      const sobrofficeId = employeeMap.get('@sobroffice')
      
      if (sobrofficeId) {
        const testSpreadsheet = await sheets.spreadsheets.get({
          spreadsheetId: TEST_SPREADSHEET_ID,
          fields: 'sheets.properties.title'
        })
        
        const sheetNames = testSpreadsheet.data.sheets?.map(s => s.properties?.title) || []
        
        if (sheetNames.includes(monthName)) {
          const testRange = `${monthName}!A2:D5000`
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
              
              const depositUsd = depositGbp * GBP_TO_USD_RATE
              const withdrawalUsd = withdrawalGbp * GBP_TO_USD_RATE
              const grossProfit = withdrawalUsd - depositUsd
              
              allTransactions.push({
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
              
              results.stats.totalGross += grossProfit
            }
          }
          
          console.log(`Found ${rows.filter(r => r[0]).length} test transactions`)
        }
      }
    } catch (error: any) {
      console.error('Error processing test spreadsheet:', error)
    }
    
    // Сохраняем ВСЕ транзакции одним запросом
    if (allTransactions.length > 0) {
      const { error } = await supabase
        .from('transactions')
        .insert(allTransactions)
      
      if (!error) {
        results.stats.transactionsCreated = allTransactions.length
        console.log(`Successfully inserted ${allTransactions.length} transactions`)
      } else {
        console.error('Error inserting transactions:', error)
        results.errors.push(`Transaction insert error: ${error.message}`)
      }
    }
    
    // STEP 5: Читаем расходы
    console.log('Reading expenses...')
    
    try {
      const expenseSheetName = `${monthName} Spending`
      const expenseRange = `${expenseSheetName}!B2:B1000`
      
      const expenseResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: EXPENSES_SPREADSHEET_ID,
        range: expenseRange,
      })
      
      const rows = expenseResponse.data.values || []
      let totalExpenses = 0
      
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
        
        results.stats.totalExpenses = totalExpenses
        console.log(`Total expenses for ${monthName}: $${totalExpenses}`)
      }
    } catch (error: any) {
      console.log('Could not read expenses:', error.message)
    }
    
    // STEP 6: Пересчитываем net profit
    results.stats.totalNet = results.stats.totalGross - results.stats.totalExpenses
    
    // Обновляем net profit если расходы > 20%
    if (results.stats.totalExpenses > results.stats.totalGross * 0.2) {
      const expenseRatio = results.stats.totalExpenses / results.stats.totalGross
      
      const { data: allTrans } = await supabase
        .from('transactions')
        .select('*')
        .eq('month', monthCode)
      
      if (allTrans) {
        for (const transaction of allTrans) {
          const netProfit = transaction.gross_profit_usd * (1 - expenseRatio)
          await supabase
            .from('transactions')
            .update({ net_profit_usd: netProfit })
            .eq('id', transaction.id)
        }
      }
    }
    
    // STEP 7: Обрабатываем карты
    console.log('Processing cards...')
    
    try {
      // Очищаем старые карты
      await supabase.from('cards').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      
      const cardsRange = 'REVO UK!A2:E1000'
      const cardsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: CARDS_SPREADSHEET_ID,
        range: cardsRange,
      })
      
      const rows = cardsResponse.data.values || []
      const cardsToInsert = []
      
      // Получаем использованные карты
      const { data: monthTransactions } = await supabase
        .from('transactions')
        .select('card_number, employee_id, casino_name')
        .eq('month', monthCode)
      
      const usedCards = new Map()
      monthTransactions?.forEach(t => {
        if (t.card_number) {
          usedCards.set(t.card_number, {
            employee_id: t.employee_id,
            casino_name: t.casino_name
          })
        }
      })
      
      for (const row of rows) {
        if (row[0]) {
          const cardNumber = extractCardNumber(row[0])
          if (cardNumber && cardNumber.length >= 15) {
            const usage = usedCards.get(cardNumber)
            
            cardsToInsert.push({
              card_number: cardNumber,
              expiry_date: row[1] || null,
              cvv: row[2] || null,
              bank_name: row[3] || null,
              holder_name: row[4] || null,
              status: usage ? 'used' : 'available',
              assigned_to: usage?.employee_id || null,
              casino_name: usage?.casino_name || null,
              sheet: 'REVO UK',
              month: usage ? monthCode : null,
            })
          }
        }
      }
      
      if (cardsToInsert.length > 0) {
        await supabase.from('cards').insert(cardsToInsert)
        results.stats.cardsProcessed = cardsToInsert.length
        console.log(`Processed ${cardsToInsert.length} cards`)
      }
    } catch (error: any) {
      console.log('Could not process cards:', error.message)
    }
    
    // STEP 8: НЕ рассчитываем зарплаты здесь - это отдельный процесс
    console.log('Salaries will be calculated separately')
    
    const elapsed = Date.now() - startTime
    
    // Финальная проверка
    const { count: finalTransCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('month', monthCode)
    
    const { count: finalEmpCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
    
    console.log('=== SYNC COMPLETED ===')
    console.log(`Time: ${elapsed}ms`)
    console.log(`Total Employees: ${finalEmpCount}`)
    console.log(`Employees Processed: ${results.stats.employeesProcessed}`)
    console.log(`Transactions: ${finalTransCount}`)
    console.log(`Total Gross: $${results.stats.totalGross.toFixed(2)}`)
    console.log(`Total Net: $${results.stats.totalNet.toFixed(2)}`)
    console.log(`Expenses: $${results.stats.totalExpenses.toFixed(2)}`)
    
    return NextResponse.json({
      success: true,
      stats: {
        ...results.stats,
        timeElapsed: `${elapsed}ms`,
        transactionsInDb: finalTransCount || 0,
        totalEmployeesInDb: finalEmpCount || 0
      },
      month: monthName,
      monthCode,
      details: results.details,
      errors: results.errors,
      employeesList: results.employeesList,
      message: `Синхронизация завершена! Обработано ${results.stats.employeesProcessed} сотрудников, ${results.stats.transactionsCreated} транзакций`
    })
    
  } catch (error: any) {
    console.error('=== SYNC ERROR ===', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error,
      results
    }, { status: 500 })
  }
}
