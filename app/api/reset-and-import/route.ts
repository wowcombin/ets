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
    console.log('=== RESET AND IMPORT ===')
    
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
    
    // 1. ПОЛНОСТЬЮ ОЧИЩАЕМ ВСЕ ТРАНЗАКЦИИ
    console.log('Step 1: Clearing ALL transactions...')
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Удаляем все
    
    if (deleteError) {
      console.error('Delete error:', deleteError)
      return NextResponse.json({
        success: false,
        error: 'Failed to clear transactions: ' + deleteError.message
      }, { status: 500 })
    }
    
    console.log('All transactions cleared successfully')
    
    // 2. ПОЛУЧАЕМ СОТРУДНИКОВ
    const { data: employees } = await supabase
      .from('employees')
      .select('id, username, folder_id')
    
    const employeeMap = new Map()
    employees?.forEach(emp => {
      employeeMap.set(emp.username, emp.id)
    })
    
    // 3. ЧИТАЕМ GOOGLE SHEETS
    const foldersResponse = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name)',
      pageSize: 100,
    })
    
    const folders = foldersResponse.data.files || []
    const allTransactions = []
    
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      const employeeId = employeeMap.get(cleanUsername)
      
      if (!employeeId) continue
      
      try {
        const workFiles = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'WORK'`,
          fields: 'files(id, name)',
        })
        
        const workFile = workFiles.data.files?.[0]
        if (!workFile?.id) continue
        
        const range = `${monthName}!A2:D1000`
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: workFile.id,
          range,
          majorDimension: 'ROWS',
          valueRenderOption: 'UNFORMATTED_VALUE'
        })
        
        const rows = response.data.values || []
        
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
          }
        }
        
      } catch (error: any) {
        console.error(`Error processing ${cleanUsername}:`, error.message)
      }
    }
    
    console.log(`Collected ${allTransactions.length} clean transactions`)
    
    // 4. ВСТАВЛЯЕМ ЧИСТЫЕ ДАННЫЕ
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
          return NextResponse.json({
            success: false,
            error: 'Failed to insert clean data: ' + error.message
          }, { status: 500 })
        } else {
          totalInserted += data?.length || 0
          console.log(`Inserted clean batch: ${data?.length}`)
        }
      }
      
      // Проверяем финальный результат
      const { count: finalCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
      
      const { data: finalStats } = await supabase
        .from('transactions')
        .select('gross_profit_usd')
        .eq('month', monthCode)
      
      const finalGross = finalStats?.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) || 0
      
      return NextResponse.json({
        success: true,
        message: `Database reset and clean import completed!`,
        stats: {
          transactionsInserted: totalInserted,
          finalTransactionCount: finalCount || 0,
          finalTotalGross: Math.round(finalGross * 100) / 100
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'No transactions found in Google Sheets'
      })
    }
    
  } catch (error: any) {
    console.error('Reset and import error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
