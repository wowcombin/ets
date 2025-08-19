import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const JUNIOR_FOLDER_ID = '1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu'
const TEST_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'
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
  // Заменяем запятую на точку для европейского формата
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
  const results = {
    employees: [] as any[],
    transactions: [] as any[],
    errors: [] as string[],
    stats: {
      employeesProcessed: 0,
      transactionsCreated: 0,
      totalGross: 0,
      totalNet: 0
    }
  }
  
  try {
    console.log('=== STARTING FULL SYNC ===')
    
    // Проверяем credentials
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
    
    // STEP 1: Очищаем старые данные за текущий месяц
    console.log(`Clearing data for ${monthCode}...`)
    await supabase.from('transactions').delete().eq('month', monthCode)
    await supabase.from('expenses').delete().eq('month', monthCode)
    await supabase.from('salaries').delete().eq('month', monthCode)
    
    // STEP 2: Получаем папки сотрудников
    console.log('Getting employee folders...')
    const foldersResponse = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name)',
      pageSize: 100,
    })
    
    const folders = foldersResponse.data.files || []
    console.log(`Found ${folders.length} employee folders`)
    
    // STEP 3: Обрабатываем сотрудников
    const { data: existingEmployees } = await supabase
      .from('employees')
      .select('*')
    
    const employeeMap = new Map()
    
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      // Убираем "УВОЛЕН" из имени
      const isFired = folder.name.includes('УВОЛЕН')
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      
      // Проверяем существующего сотрудника
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
        // Обновляем существующего
        await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', employee.id)
        
        employeeMap.set(cleanUsername, employee.id)
      } else {
        // Создаем нового
        const { data: newEmp, error } = await supabase
          .from('employees')
          .insert([employeeData])
          .select()
          .single()
        
        if (newEmp && !error) {
          employee = newEmp
          employeeMap.set(cleanUsername, newEmp.id)
        } else {
          results.errors.push(`Failed to create employee ${cleanUsername}: ${error?.message}`)
          continue
        }
      }
      
      results.employees.push({
        username: cleanUsername,
        id: employee.id,
        isFired,
        isManager
      })
    }
    
    // Добавляем @sobroffice если его нет
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
        
        if (newEmp) {
          sobroffice = newEmp
        }
      }
      
      if (sobroffice) {
        employeeMap.set('@sobroffice', sobroffice.id)
        results.employees.push({
          username: '@sobroffice',
          id: sobroffice.id,
          isManager: true
        })
      }
    }
    
    console.log(`Processed ${employeeMap.size} employees`)
    results.stats.employeesProcessed = employeeMap.size
    
    // STEP 4: Читаем транзакции из папок сотрудников
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
        // Ищем файл WORK
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
        
        // Читаем данные за месяц
        const range = `${monthName}!A2:D500`
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: workFile.id,
          range,
        })
        
        const rows = response.data.values || []
        let employeeTransactions = 0
        
        for (const row of rows) {
          if (row[0]) { // Если есть название казино
            const casino = String(row[0]).trim()
            const depositGbp = parseNumberValue(row[1])
            const withdrawalGbp = parseNumberValue(row[2])
            const cardNumber = extractCardNumber(row[3])
            
            const depositUsd = depositGbp * GBP_TO_USD_RATE
            const withdrawalUsd = withdrawalGbp * GBP_TO_USD_RATE
            const grossProfit = withdrawalUsd - depositUsd
            
            const transaction = {
              employee_id: employeeId,
              month: monthCode,
              casino_name: casino,
              deposit_gbp: depositGbp,
              withdrawal_gbp: withdrawalGbp,
              deposit_usd: depositUsd,
              withdrawal_usd: withdrawalUsd,
              card_number: cardNumber,
              gross_profit_usd: grossProfit,
              net_profit_usd: grossProfit, // Пересчитаем позже с учетом расходов
            }
            
            // Сохраняем транзакцию
            const { error } = await supabase
              .from('transactions')
              .insert([transaction])
            
            if (!error) {
              employeeTransactions++
              results.stats.transactionsCreated++
              results.stats.totalGross += grossProfit
              results.transactions.push({
                employee: cleanUsername,
                casino,
                gross: grossProfit
              })
            }
          }
        }
        
        if (employeeTransactions > 0) {
          console.log(`Added ${employeeTransactions} transactions for ${cleanUsername}`)
        }
        
      } catch (error: any) {
        console.error(`Error processing ${cleanUsername}:`, error.message)
        results.errors.push(`Error for ${cleanUsername}: ${error.message}`)
      }
    }
    
    // STEP 5: Читаем тестовые транзакции
    console.log('Reading test transactions...')
    
    try {
      const sobrofficeId = employeeMap.get('@sobroffice')
      
      if (sobrofficeId) {
        const testRange = `${monthName}!A2:D500`
        const testResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: TEST_SPREADSHEET_ID,
          range: testRange,
        })
        
        const rows = testResponse.data.values || []
        let testTransactions = 0
        
        for (const row of rows) {
          if (row[0]) {
            const casino = String(row[0]).trim()
            const depositGbp = parseNumberValue(row[1])
            const withdrawalGbp = parseNumberValue(row[2])
            const cardNumber = extractCardNumber(row[3])
            
            const depositUsd = depositGbp * GBP_TO_USD_RATE
            const withdrawalUsd = withdrawalGbp * GBP_TO_USD_RATE
            const grossProfit = withdrawalUsd - depositUsd
            
            const transaction = {
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
            }
            
            const { error } = await supabase
              .from('transactions')
              .insert([transaction])
            
            if (!error) {
              testTransactions++
              results.stats.transactionsCreated++
              results.stats.totalGross += grossProfit
              results.transactions.push({
                employee: '@sobroffice',
                casino,
                gross: grossProfit
              })
            }
          }
        }
        
        console.log(`Added ${testTransactions} test transactions`)
      }
    } catch (error: any) {
      console.error('Error processing test spreadsheet:', error)
      results.errors.push(`Test sheet error: ${error.message}`)
    }
    
    // STEP 6: Пересчитываем net profit (пока без расходов)
    results.stats.totalNet = results.stats.totalGross
    
    const elapsed = Date.now() - startTime
    
    // Финальная проверка
    const { count: finalTransCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('month', monthCode)
    
    console.log('=== SYNC COMPLETED ===')
    console.log(`Time: ${elapsed}ms`)
    console.log(`Employees: ${results.stats.employeesProcessed}`)
    console.log(`Transactions: ${results.stats.transactionsCreated}`)
    console.log(`Total Gross: $${results.stats.totalGross.toFixed(2)}`)
    
    return NextResponse.json({
      success: true,
      stats: {
        ...results.stats,
        timeElapsed: `${elapsed}ms`,
        transactionsInDb: finalTransCount || 0
      },
      month: monthName,
      monthCode,
      employees: results.employees,
      sampleTransactions: results.transactions.slice(0, 10),
      errors: results.errors,
      message: `Sync completed: ${results.stats.transactionsCreated} transactions from ${results.stats.employeesProcessed} employees`
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
