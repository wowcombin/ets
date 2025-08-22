import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

const JUNIOR_FOLDER_ID = '1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu'

function getCurrentMonthName(): string {
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                 'july', 'august', 'september', 'october', 'november', 'december']
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
  const numStr = String(value).replace(/[^0-9.-]/g, '')
  const num = parseFloat(numStr)
  return isNaN(num) ? 0 : num
}

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET() {
  try {
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
    
    const monthName = getCurrentMonthName()
    const monthCode = getCurrentMonthCode()
    
    console.log(`Checking for deleted transactions in ${monthCode}...`)
    
    // Получаем все существующие транзакции из базы
    const { data: existingTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, employee_id, casino_name, deposit_usd, withdrawal_usd')
      .eq('month', monthCode)
    
    if (fetchError) {
      throw fetchError
    }
    
    if (!existingTransactions || existingTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No transactions found in database',
        stats: {
          checked: 0,
          deleted: 0
        }
      })
    }
    
    // Создаем Set для отслеживания транзакций найденных в Google Sheets
    const foundTransactions = new Set<string>()
    
    // Получаем все сотрудники
    const { data: employees } = await supabase
      .from('employees')
      .select('id, username, folder_id')
      .eq('is_active', true)
    
    if (!employees) {
      throw new Error('Failed to fetch employees')
    }
    
    // Обходим все папки сотрудников
    for (const employee of employees) {
      if (!employee.folder_id) continue
      
      try {
        // Ищем файл WORK
        const workFiles = await drive.files.list({
          q: `'${employee.folder_id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'WORK'`,
          fields: 'files(id, name)',
        })
        
        const workFile = workFiles.data.files?.[0]
        if (!workFile?.id) continue
        
        const range = `${monthName}!A2:D10000`
        
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: workFile.id,
          range,
          majorDimension: 'ROWS',
          valueRenderOption: 'UNFORMATTED_VALUE'
        })
        
        const rows = response.data.values || []
        
        for (const row of rows) {
          if (row[0] && String(row[0]).trim()) {
            const depositUsd = Math.round(parseNumberValue(row[1]) * 1.3 * 100) / 100
            const withdrawalUsd = Math.round(parseNumberValue(row[2]) * 1.3 * 100) / 100
            
            // Пропускаем пустые транзакции
            if (depositUsd === 0 && withdrawalUsd === 0) continue
            
            // Создаем ключ для транзакции
            const key = `${employee.id}_${String(row[0]).trim()}_${depositUsd}_${withdrawalUsd}`
            foundTransactions.add(key)
          }
        }
      } catch (error) {
        console.error(`Error processing employee ${employee.username}:`, error)
      }
    }
    
    // Находим транзакции для удаления
    const toDelete = []
    for (const transaction of existingTransactions) {
      const key = `${transaction.employee_id}_${transaction.casino_name}_${transaction.deposit_usd}_${transaction.withdrawal_usd}`
      if (!foundTransactions.has(key)) {
        toDelete.push(transaction.id)
      }
    }
    
    // Удаляем транзакции
    let deletedCount = 0
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .in('id', toDelete)
      
      if (deleteError) {
        throw deleteError
      }
      
      deletedCount = toDelete.length
    }
    
    return NextResponse.json({
      success: true,
      message: `Проверено ${existingTransactions.length} транзакций, удалено ${deletedCount}`,
      stats: {
        monthCode,
        checked: existingTransactions.length,
        foundInSheets: foundTransactions.size,
        deleted: deletedCount
      }
    })
    
  } catch (error: any) {
    console.error('Clean deleted transactions error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
