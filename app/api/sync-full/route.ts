import { NextResponse, NextRequest } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 минут максимум

const JUNIOR_FOLDER_ID = '1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu'
const TEST_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'
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
    console.log('Starting full sync...')
    
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing Google credentials' 
      }, { status: 500 })
    }

    const monthName = getCurrentMonthName()
    const monthCode = getCurrentMonthCode()
    
    // Инициализируем Google API
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
    
    // Получаем папки сотрудников
    console.log('Getting employee folders...')
    const foldersResponse = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name)',
      pageSize: 50,
    })
    
    const folders = foldersResponse.data.files || []
    console.log(`Found ${folders.length} employee folders`)
    
    // Получаем существующих сотрудников
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
            profit_percentage: 10.00,
          }])
          .select()
          .single()
        
        if (newEmp) {
          employeeMap.set('@sobroffice', newEmp.id)
        }
      }
    }
    
    console.log(`Processing ${employeeMap.size} employees`)
    
    // Удаляем все старые транзакции за месяц
    await supabase
      .from('transactions')
      .delete()
      .eq('month', monthCode)
    
    let totalTransactions = 0
    const processedEmployees = []
    
    // Обрабатываем каждого сотрудника
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      const employeeId = employeeMap.get(folder.name)
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
          console.log(`No WORK file found for ${folder.name}`)
          continue
        }
        
        // Читаем данные из таблицы
        const range = `${monthName}!A2:D100`
        
        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: workFile.id,
            range,
          })
          
          const rows = response.data.values || []
          const transactions = []
          
          for (const row of rows) {
            if (row[0]) { // Если есть название казино
              const depositGbp = parseNumberValue(row[1])
              const withdrawalGbp = parseNumberValue(row[2])
              const cardNumber = extractCardNumber(row[3])
              
              const depositUsd = depositGbp * GBP_TO_USD_RATE
              const withdrawalUsd = withdrawalGbp * GBP_TO_USD_RATE
              const grossProfit = withdrawalUsd - depositUsd
              
              transactions.push({
                employee_id: employeeId,
                month: monthCode,
                casino_name: String(row[0]),
                deposit_gbp: depositGbp,
                withdrawal_gbp: withdrawalGbp,
                deposit_usd: depositUsd,
                withdrawal_usd: withdrawalUsd,
                card_number: cardNumber,
                gross_profit_usd: grossProfit,
                net_profit_usd: grossProfit, // Позже пересчитаем с учетом расходов
              })
            }
          }
          
          if (transactions.length > 0) {
            const { error } = await supabase
              .from('transactions')
              .insert(transactions)
            
            if (!error) {
              totalTransactions += transactions.length
              processedEmployees.push({
                username: folder.name,
                transactions: transactions.length
              })
              console.log(`Added ${transactions.length} transactions for ${folder.name}`)
            } else {
              console.error(`Error inserting transactions for ${folder.name}:`, error)
            }
          }
        } catch (sheetError: any) {
          console.log(`Could not read sheet for ${folder.name}:`, sheetError.message)
        }
      } catch (error) {
        console.error(`Error processing ${folder.name}:`, error)
      }
    }
    
    // Обрабатываем тестовую таблицу @sobroffice
    try {
      const testRange = `${monthName}!A2:D100`
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
            const depositGbp = parseNumberValue(row[1])
            const withdrawalGbp = parseNumberValue(row[2])
            const cardNumber = extractCardNumber(row[3])
            
            const depositUsd = depositGbp * GBP_TO_USD_RATE
            const withdrawalUsd = withdrawalGbp * GBP_TO_USD_RATE
            const grossProfit = withdrawalUsd - depositUsd
            
            transactions.push({
              employee_id: sobrofficeId,
              month: monthCode,
              casino_name: String(row[0]),
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
          const { error } = await supabase
            .from('transactions')
            .insert(transactions)
          
          if (!error) {
            totalTransactions += transactions.length
            processedEmployees.push({
              username: '@sobroffice (test)',
              transactions: transactions.length
            })
            console.log(`Added ${transactions.length} test transactions for @sobroffice`)
          }
        }
      }
    } catch (error) {
      console.error('Error processing test spreadsheet:', error)
    }
    
    const elapsed = Date.now() - startTime
    
    // Получаем финальные подсчеты
    const { count: finalTransCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('month', monthCode)
    
    return NextResponse.json({
      success: true,
      stats: {
        employeesTotal: employeeMap.size,
        transactionsCreated: totalTransactions,
        transactionsTotal: finalTransCount || 0,
        processedEmployees: processedEmployees.length,
        timeElapsed: `${elapsed}ms`,
      },
      details: {
        processedEmployees,
        month: monthName,
        monthCode
      },
      message: `Full sync completed in ${elapsed}ms`
    })
    
  } catch (error: any) {
    console.error('Full sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error
    }, { status: 500 })
  }
}
