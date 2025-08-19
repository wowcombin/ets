import { NextResponse, NextRequest } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const JUNIOR_FOLDER_ID = '1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu'
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

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('Starting fast sync...')
    
    // Проверяем credentials
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
    
    // Сначала создаем всех сотрудников
    const employeeMap = new Map()
    const employeesToCreate = []
    
    for (const folder of folders) {
      if (folder.id && folder.name) {
        employeesToCreate.push({
          username: folder.name,
          folder_id: folder.id,
          is_manager: ['@sobroffice', '@vladsohr', '@n1mbo', '@i88jU'].includes(folder.name),
          profit_percentage: folder.name === '@vladsohr' || folder.name === '@i88jU' ? 5.00 : 10.00,
        })
      }
    }
    
    // Добавляем @sobroffice если его нет
    if (!employeesToCreate.find(e => e.username === '@sobroffice')) {
      employeesToCreate.push({
        username: '@sobroffice',
        folder_id: 'test',
        is_manager: true,
        profit_percentage: 10.00,
      })
    }
    
    console.log(`Creating/updating ${employeesToCreate.length} employees...`)
    
    // Удаляем старых сотрудников и создаем новых
    await supabase.from('employees').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    const { data: createdEmployees, error: empError } = await supabase
      .from('employees')
      .insert(employeesToCreate)
      .select()
    
    if (empError) {
      console.error('Error creating employees:', empError)
      return NextResponse.json({ 
        success: false, 
        error: `Failed to create employees: ${empError.message}` 
      })
    }
    
    // Создаем map для быстрого поиска
    for (const emp of createdEmployees || []) {
      employeeMap.set(emp.username, emp.id)
    }
    
    console.log(`Created ${createdEmployees?.length || 0} employees`)
    
    // Простая проверка - читаем одну таблицу для теста
    const sheets = google.sheets({ version: 'v4', auth })
    let testTransactionCount = 0
    
    try {
      const TEST_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'
      const testRange = `${monthName}!A2:D100`
      
      const testResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: testRange,
      })
      
      const rows = testResponse.data.values || []
      const transactions = []
      
      for (const row of rows) {
        if (row[0]) {
          const depositGbp = parseFloat(String(row[1] || 0).replace(/[^0-9.-]/g, '')) || 0
          const withdrawalGbp = parseFloat(String(row[2] || 0).replace(/[^0-9.-]/g, '')) || 0
          const grossProfit = (withdrawalGbp - depositGbp) * GBP_TO_USD_RATE
          
          if (employeeMap.has('@sobroffice')) {
            transactions.push({
              employee_id: employeeMap.get('@sobroffice'),
              month: monthCode,
              casino_name: String(row[0]),
              deposit_gbp: depositGbp,
              withdrawal_gbp: withdrawalGbp,
              deposit_usd: depositGbp * GBP_TO_USD_RATE,
              withdrawal_usd: withdrawalGbp * GBP_TO_USD_RATE,
              card_number: String(row[3] || '').replace(/[^0-9]/g, ''),
              gross_profit_usd: grossProfit,
              net_profit_usd: grossProfit,
            })
          }
        }
      }
      
      if (transactions.length > 0) {
        // Удаляем старые транзакции @sobroffice
        await supabase
          .from('transactions')
          .delete()
          .eq('employee_id', employeeMap.get('@sobroffice'))
          .eq('month', monthCode)
        
        // Вставляем новые
        const { error: transError } = await supabase
          .from('transactions')
          .insert(transactions)
        
        if (transError) {
          console.error('Error inserting test transactions:', transError)
        } else {
          testTransactionCount = transactions.length
        }
      }
    } catch (error) {
      console.error('Error reading test spreadsheet:', error)
    }
    
    const elapsed = Date.now() - startTime
    
    return NextResponse.json({
      success: true,
      stats: {
        employeesCreated: createdEmployees?.length || 0,
        testTransactions: testTransactionCount,
        timeElapsed: `${elapsed}ms`,
      },
      message: `Fast sync completed in ${elapsed}ms`
    })
    
  } catch (error: any) {
    console.error('Fast sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error
    }, { status: 500 })
  }
}
