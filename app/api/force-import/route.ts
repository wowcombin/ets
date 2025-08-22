import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

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

export async function POST() {
  try {
    console.log('=== FORCE IMPORT STARTING ===')
    
    const monthName = getCurrentMonthName()
    const monthCode = getCurrentMonthCode()
    
    console.log(`Importing for month: ${monthName} (${monthCode})`)
    
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
    
    // ОЧИЩАЕМ ДАННЫЕ
    console.log('Clearing old data...')
    await supabase.from('transactions').delete().eq('month', monthCode)
    
    // Получаем сотрудников
    const { data: employees } = await supabase
      .from('employees')
      .select('id, username, folder_id')
    
    const employeeMap = new Map()
    employees?.forEach(emp => {
      employeeMap.set(emp.username, emp.id)
    })
    
    console.log(`Found ${employees?.length} employees in database`)
    
    // Получаем папки
    const foldersResponse = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name)',
      pageSize: 100,
    })
    
    const folders = foldersResponse.data.files || []
    console.log(`Found ${folders.length} folders in Google Drive`)
    
    const allTransactions = []
    let processedFolders = 0
    
    // Обрабатываем каждую папку
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      const employeeId = employeeMap.get(cleanUsername)
      
      if (!employeeId) {
        console.log(`Skipping ${cleanUsername} - no employee ID`)
        continue
      }
      
      console.log(`Processing ${cleanUsername}...`)
      
      try {
        // Ищем WORK файл
        const workFiles = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'WORK'`,
          fields: 'files(id, name)',
        })
        
        const workFile = workFiles.data.files?.[0]
        if (!workFile?.id) {
          console.log(`No WORK file for ${cleanUsername}`)
          continue
        }
        
        // Читаем данные
        const range = `${monthName}!A2:D1000`
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: workFile.id,
          range,
          majorDimension: 'ROWS',
          valueRenderOption: 'UNFORMATTED_VALUE'
        })
        
        const rows = response.data.values || []
        console.log(`${cleanUsername}: Found ${rows.length} rows`)
        
        let employeeTransactions = 0
        
        for (const row of rows) {
          const casinoName = row[0] ? String(row[0]).trim() : ''
          if (casinoName) {
            const depositGbp = parseNumberValue(row[1])
            const withdrawalGbp = parseNumberValue(row[2])
            const cardNumber = extractCardNumber(row[3])
            
            const depositUsd = Math.round(depositGbp * GBP_TO_USD_RATE * 100) / 100
            const withdrawalUsd = Math.round(withdrawalGbp * GBP_TO_USD_RATE * 100) / 100
            const grossProfit = withdrawalUsd - depositUsd
            
            allTransactions.push({
              employee_id: employeeId,
              month: monthCode,
              casino_name: casinoName,
              deposit_gbp: depositGbp,
              withdrawal_gbp: withdrawalGbp,
              deposit_usd: depositUsd,
              withdrawal_usd: withdrawalUsd,
              card_number: cardNumber,
              gross_profit_usd: grossProfit,
              net_profit_usd: grossProfit
            })
            
            employeeTransactions++
          }
        }
        
        console.log(`${cleanUsername}: Processed ${employeeTransactions} transactions`)
        processedFolders++
        
      } catch (error: any) {
        console.error(`Error processing ${cleanUsername}:`, error.message)
      }
    }
    
    console.log(`\nTotal collected: ${allTransactions.length} transactions from ${processedFolders} folders`)
    
    // Вставляем все транзакции
    if (allTransactions.length > 0) {
      const batchSize = 500
      let totalInserted = 0
      
      for (let i = 0; i < allTransactions.length; i += batchSize) {
        const batch = allTransactions.slice(i, i + batchSize)
        const { error, data } = await supabase
          .from('transactions')
          .insert(batch)
          .select()
        
        if (error) {
          console.error(`Insert error:`, error)
        } else {
          totalInserted += data?.length || 0
          console.log(`Inserted batch: ${data?.length}`)
        }
      }
      
      console.log(`TOTAL INSERTED: ${totalInserted} transactions`)
      
      return NextResponse.json({
        success: true,
        message: `Force import completed: ${totalInserted} transactions imported`,
        stats: {
          foldersProcessed: processedFolders,
          transactionsCollected: allTransactions.length,
          transactionsInserted: totalInserted
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'No transactions found in Google Sheets',
        stats: {
          foldersProcessed: processedFolders,
          transactionsCollected: 0
        }
      })
    }
    
  } catch (error: any) {
    console.error('Force import error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
