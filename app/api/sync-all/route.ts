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
    
    // STEP 1: Очищаем старые данные за текущий месяц
    console.log('Clearing old data...')
    await supabase.from('transactions').delete().eq('month', monthCode)
    await supabase.from('expenses').delete().eq('month', monthCode)
    await supabase.from('salaries').delete().eq('month', monthCode)
    
    // STEP 2: Сначала добавляем всех менеджеров
    console.log('Processing managers...')
    const { data: existingEmployees } = await supabase
      .from('employees')
      .select('*')
    
    const employeeMap = new Map()
    
    // Добавляем менеджеров первыми
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
        await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', manager.id)
        
        employeeMap.set(managerUsername, manager.id)
        console.log(`Updated manager: ${managerUsername}`)
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
    
    // STEP 3: Обрабатываем сотрудников из папок
    console.log('Processing employee folders...')
    
    // Получаем ВСЕ папки, увеличиваем лимит до 1000
    const foldersResponse = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name)',
      pageSize: 1000, // Увеличиваем лимит
    })
    
    const folders = foldersResponse.data.files || []
    console.log(`Found ${folders.length} employee folders`)
    
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      const isFired = folder.name.includes('УВОЛЕН')
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      
      // Пропускаем менеджеров, мы их уже обработали
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
        console.log(`Updated employee: ${cleanUsername}`)
      } else {
        const { data: newEmp, error } = await supabase
          .from('employees')
          .insert([employeeData])
          .select()
          .single()
        
        if (newEmp && !error) {
          employee = newEmp
          employeeMap.set(cleanUsername, newEmp.id)
          console.log(`Created employee: ${cleanUsername}`)
        } else {
          results.errors.push(`Failed to create employee ${cleanUsername}: ${error?.message}`)
          continue
        }
      }
      
      results.stats.employeesProcessed++
      results.employeesList.push(cleanUsername)
    }
    
    console.log(`Total employees in map: ${employeeMap.size}`)
    console.log('Employees:', Array.from(employeeMap.keys()))
    
    // STEP 4: Читаем транзакции сотрудников
    console.log('Reading employee transactions...')
    
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      const employeeId = employeeMap.get(cleanUsername)
      
      if (!employeeId) {
        console.log(`No employee ID for ${cleanUsername}`)
        continue
      }
      
      try {
        // Ищем файл WORK в папке сотрудника
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
        
        // Сначала проверяем какие листы есть в таблице
        try {
          const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: workFile.id,
            fields: 'sheets.properties.title'
          })
          
          const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title) || []
          console.log(`Sheets in ${cleanUsername}'s workbook:`, sheetNames)
          
          // Проверяем есть ли лист с нужным месяцем
          if (!sheetNames.includes(monthName)) {
            console.log(`No ${monthName} sheet for ${cleanUsername}`)
            continue
          }
        } catch (e) {
          console.log(`Cannot read sheets for ${cleanUsername}`)
          continue
        }
        
        // Читаем данные с листа текущего месяца
        const range = `${monthName}!A2:D5000` // Увеличиваем до 5000 строк
        
        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: workFile.id,
            range,
          })
          
          const rows = response.data.values || []
          const transactions = []
          
          for (const row of rows) {
            if (row[0]) { // Если есть название казино
              const casino = String(row[0]).trim()
              const depositGbp = parseNumberValue(row[1])
              const withdrawalGbp = parseNumberValue(row[2])
              const cardNumber = extractCardNumber(row[3])
              
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
              
              results.stats.totalGross += grossProfit
            }
          }
          
          if (transactions.length > 0) {
            const { error } = await supabase
              .from('transactions')
              .insert(transactions)
            
            if (!error) {
              results.stats.transactionsCreated += transactions.length
              console.log(`Added ${transactions.length} transactions for ${cleanUsername}`)
              results.details.push({
                employee: cleanUsername,
                transactions: transactions.length,
                totalGross: transactions.reduce((sum, t) => sum + t.gross_profit_usd, 0)
              })
            } else {
              results.errors.push(`Error inserting transactions for ${cleanUsername}: ${error.message}`)
            }
          } else {
            console.log(`No transactions found for ${cleanUsername} in ${monthName}`)
          }
        } catch (sheetError: any) {
          console.log(`Error reading sheet for ${cleanUsername}:`, sheetError.message)
        }
      } catch (error: any) {
        console.error(`Error processing ${cleanUsername}:`, error.message)
        results.errors.push(`Error for ${cleanUsername}: ${error.message}`)
      }
    }
    
    // STEP 5: Читаем тестовые транзакции @sobroffice
    console.log('Reading test transactions...')
    
    try {
      const sobrofficeId = employeeMap.get('@sobroffice')
      
      if (sobrofficeId) {
        // Проверяем листы в тестовой таблице
        const testSpreadsheet = await sheets.spreadsheets.get({
          spreadsheetId: TEST_SPREADSHEET_ID,
          fields: 'sheets.properties.title'
        })
        
        const sheetNames = testSpreadsheet.data.sheets?.map(s => s.properties?.title) || []
        console.log('Test spreadsheet sheets:', sheetNames)
        
        if (sheetNames.includes(monthName)) {
          const testRange = `${monthName}!A2:D5000`
          const testResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: TEST_SPREADSHEET_ID,
            range: testRange,
          })
          
          const rows = testResponse.data.values || []
          const transactions = []
          
          for (const row of rows) {
            if (row[0]) {
              const casino = String(row[0]).trim()
              const depositGbp = parseNumberValue(row[1])
              const withdrawalGbp = parseNumberValue(row[2])
              const cardNumber = extractCardNumber(row[3])
              
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
              
              results.stats.totalGross += grossProfit
            }
          }
          
          if (transactions.length > 0) {
            const { error } = await supabase
              .from('transactions')
              .insert(transactions)
            
            if (!error) {
              results.stats.transactionsCreated += transactions.length
              console.log(`Added ${transactions.length} test transactions`)
              results.details.push({
                employee: '@sobroffice (test)',
                transactions: transactions.length,
                totalGross: transactions.reduce((sum, t) => sum + t.gross_profit_usd, 0)
              })
            } else {
              results.errors.push(`Error inserting test transactions: ${error.message}`)
            }
          }
        } else {
          console.log(`No ${monthName} sheet in test spreadsheet`)
        }
      }
    } catch (error: any) {
      console.error('Error processing test spreadsheet:', error)
      results.errors.push(`Test sheet error: ${error.message}`)
    }
    
    // STEP 6: Читаем расходы
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
    
    // STEP 7: Пересчитываем net profit с учетом расходов
    if (results.stats.totalGross > 0 && results.stats.totalExpenses > 0) {
      const expenseRatio = results.stats.totalExpenses / results.stats.totalGross
      
      if (expenseRatio > 0.2) {
        const { data: allTransactions } = await supabase
          .from('transactions')
          .select('*')
          .eq('month', monthCode)
        
        if (allTransactions) {
          for (const transaction of allTransactions) {
            const netProfit = transaction.gross_profit_usd - (transaction.gross_profit_usd * expenseRatio)
            await supabase
              .from('transactions')
              .update({ net_profit_usd: netProfit })
              .eq('id', transaction.id)
          }
          
          results.stats.totalNet = results.stats.totalGross - results.stats.totalExpenses
        }
      } else {
        results.stats.totalNet = results.stats.totalGross
      }
    } else {
      results.stats.totalNet = results.stats.totalGross
    }
    
    // STEP 8: Читаем и сохраняем карты
    console.log('Processing cards...')
    
    try {
      await supabase.from('cards').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      
      const cardsRange = 'REVO UK!A2:E1000'
      const cardsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: CARDS_SPREADSHEET_ID,
        range: cardsRange,
      })
      
      const rows = cardsResponse.data.values || []
      const cardsToInsert = []
      
      // Получаем все транзакции для проверки использования карт
      const { data: monthTransactions } = await supabase
        .from('transactions')
        .select('card_number, employee_id, casino_name')
        .eq('month', monthCode)
      
      // Создаем map использованных карт
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
      results.errors.push(`Cards error: ${error.message}`)
    }
    
    // STEP 9: Рассчитываем зарплаты
    console.log('Calculating salaries...')
    
    try {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('month', monthCode)
      
      if (transactions && transactions.length > 0) {
        const { data: employees } = await supabase
          .from('employees')
          .select('*')
          .eq('is_active', true) // Только активные сотрудники
        
        // Группируем транзакции по сотрудникам
        const employeeTransactions = new Map()
        for (const transaction of transactions) {
          if (!employeeTransactions.has(transaction.employee_id)) {
            employeeTransactions.set(transaction.employee_id, [])
          }
          employeeTransactions.get(transaction.employee_id).push(transaction)
        }
        
        // Находим лидера месяца
        let maxGrossProfit = 0
        let maxTransaction = null
        for (const transaction of transactions) {
          if (transaction.gross_profit_usd > maxGrossProfit) {
            maxGrossProfit = transaction.gross_profit_usd
            maxTransaction = transaction
          }
        }
        
        // Рассчитываем зарплаты
        const salariesToInsert = []
        
        for (const employee of employees || []) {
          const empTransactions = employeeTransactions.get(employee.id) || []
          const empGross = empTransactions.reduce((sum: number, t: any) => sum + (t.gross_profit_usd || 0), 0)
          
          let baseSalary = 0
          let bonus = 0
          let leaderBonus = 0
          
          if (employee.username === '@sobroffice') {
            // Тест менеджер: 10% от всего брутто работников + 10% от своих тестов
            const workersGross = transactions.filter((t: any) => {
              const emp = employees?.find(e => e.id === t.employee_id)
              return emp && !emp.is_manager
            }).reduce((sum: number, t: any) => sum + (t.gross_profit_usd || 0), 0)
            
            baseSalary = workersGross * 0.1 + empGross * 0.1
          } else if (employee.is_manager) {
            // Менеджеры получают процент от общего нетто или брутто
            const percentage = (employee.profit_percentage || 10) / 100
            
            if (results.stats.totalExpenses > results.stats.totalGross * 0.2) {
              baseSalary = (results.stats.totalGross - results.stats.totalExpenses) * percentage
            } else {
              baseSalary = results.stats.totalGross * percentage
            }
          } else if (empGross > 0) {
            // Обычные работники
            if (empGross > 200) {
              baseSalary = empGross * 0.1
              bonus = 200
            } else {
              baseSalary = empGross * 0.1
            }
            
            // Бонус лидеру месяца
            if (maxTransaction && maxTransaction.employee_id === employee.id) {
              leaderBonus = maxGrossProfit * 0.1
            }
          }
          
          const totalSalary = baseSalary + bonus + leaderBonus
          
          // Сохраняем зарплату для всех, у кого она больше 0
          if (totalSalary > 0 || employee.is_manager) {
            salariesToInsert.push({
              employee_id: employee.id,
              month: monthCode,
              base_salary: baseSalary,
              bonus,
              leader_bonus: leaderBonus,
              total_salary: totalSalary,
              is_paid: false,
            })
          }
        }
        
        if (salariesToInsert.length > 0) {
          await supabase.from('salaries').insert(salariesToInsert)
          results.stats.salariesCalculated = salariesToInsert.length
          console.log(`Calculated ${salariesToInsert.length} salaries`)
        }
      }
    } catch (error: any) {
      console.log('Could not calculate salaries:', error.message)
      results.errors.push(`Salaries error: ${error.message}`)
    }
    
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
    console.log(`Total Employees in DB: ${finalEmpCount}`)
    console.log(`Processed Employees: ${results.stats.employeesProcessed}`)
    console.log(`Employees List: ${results.employeesList.join(', ')}`)
    console.log(`Transactions: ${results.stats.transactionsCreated}`)
    console.log(`Cards: ${results.stats.cardsProcessed}`)
    console.log(`Total Gross: $${results.stats.totalGross.toFixed(2)}`)
    console.log(`Total Net: $${results.stats.totalNet.toFixed(2)}`)
    console.log(`Expenses: $${results.stats.totalExpenses.toFixed(2)}`)
    console.log(`Salaries: ${results.stats.salariesCalculated}`)
    
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
      message: `Sync completed! Processed ${results.stats.employeesProcessed} employees for ${monthName} ${new Date().getFullYear()}`
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
