// app/api/sync-all/route.ts
import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
export const runtime = 'nodejs'

// Constants
const JUNIOR_FOLDER_ID = '1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu'
const TEST_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'
const EXPENSES_SPREADSHEET_ID = '19LmZTOzZoX8eMhGPazMl9g_VPmOZ3YwMURWqcrvKkAU'
const CARDS_SPREADSHEET_ID = '1qmT_Yg09BFpD6UKZz7LFs1SXGPtQYjzNlZ-tytsr3is'
const THEMES_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'
const GBP_TO_USD_RATE = parseFloat(process.env.GBP_TO_USD_RATE || '1.3')

const MANAGERS: Record<string, { percentage: number; isTest: boolean }> = {
  '@sobroffice': { percentage: 10, isTest: true },
  '@vladsohr': { percentage: 5, isTest: false },
  '@n1mbo': { percentage: 10, isTest: false },
  '@i88jU': { percentage: 5, isTest: false }
}

// Helper functions
function getCurrentMonthName(): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  return months[new Date().getMonth()]
}

function getCurrentMonthCode(): string {
  const now = new Date()
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
}

function parseNumberValue(value: any): number {
  if (!value && value !== 0) return 0
  if (typeof value === 'number') return value
  
  let str = String(value).trim()
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')
  
  const parsed = parseFloat(str)
  return isNaN(parsed) ? 0 : parsed
}

function extractCardNumber(value: any): string {
  if (!value) return ''
  return String(value).replace(/[^0-9]/g, '')
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Main sync function
export async function GET() {
  const startTime = Date.now()
  const syncLog: string[] = []
  const errors: string[] = []
  
  try {
    // Add authentication check
    // TODO: Implement proper authentication
    // const session = await getSession()
    // if (!session?.user?.role === 'admin') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }
    
    syncLog.push('Starting sync process...')
    
    const monthName = getCurrentMonthName()
    const monthCode = getCurrentMonthCode()
    
    // Initialize Google API
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
    
    // Step 1: Clear existing data for current month
    syncLog.push(`Clearing data for ${monthCode}...`)
    
    await supabase.from('transactions').delete().eq('month', monthCode)
    await supabase.from('expenses').delete().eq('month', monthCode)
    await supabase.from('salaries').delete().eq('month', monthCode)
    
    // Step 2: Get employee folders
    syncLog.push('Fetching employee folders from Google Drive...')
    
    const foldersResponse = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name)',
      pageSize: 1000,
    })
    
    const folders = foldersResponse.data.files || []
    syncLog.push(`Found ${folders.length} employee folders`)
    
    // Step 3: Update/create employees
    const employeeMap = new Map<string, string>()
    const { data: existingEmployees } = await supabase.from('employees').select('*')
    
    existingEmployees?.forEach(emp => {
      employeeMap.set(emp.username, emp.id)
    })
    
    // Create/update managers first
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
    
    // Process employee folders
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      const isFired = folder.name.includes('УВОЛЕН')
      
      if (!employeeMap.has(cleanUsername)) {
        const { data: newEmp } = await supabase
          .from('employees')
          .insert([{
            username: cleanUsername,
            folder_id: folder.id,
            is_manager: MANAGERS.hasOwnProperty(cleanUsername),
            is_active: !isFired,
            profit_percentage: MANAGERS[cleanUsername]?.percentage || 10.00,
          }])
          .select()
          .single()
        
        if (newEmp) {
          employeeMap.set(cleanUsername, newEmp.id)
        }
      } else {
        // Update existing employee status
        await supabase
          .from('employees')
          .update({ 
            is_active: !isFired,
            folder_id: folder.id,
            updated_at: new Date().toISOString()
          })
          .eq('username', cleanUsername)
      }
    }
    
    // Step 4: Process transactions
    syncLog.push('Processing employee transactions...')
    const allTransactions: any[] = []
    let totalGross = 0
    let processedCount = 0
    
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i]
      if (!folder.id || !folder.name) continue
      
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      const employeeId = employeeMap.get(cleanUsername)
      
      if (!employeeId) continue
      
      // Rate limiting
      if (i > 0 && i % 5 === 0) {
        await delay(500)
      }
      
      try {
        // Find WORK spreadsheet
        const workFiles = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'WORK'`,
          fields: 'files(id, name)',
        })
        
        const workFile = workFiles.data.files?.[0]
        if (!workFile?.id) continue
        
        // Read transactions
        const range = `${monthName}!A2:D10000`
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: workFile.id,
          range,
          majorDimension: 'ROWS',
          valueRenderOption: 'UNFORMATTED_VALUE'
        })
        
        const rows = response.data.values || []
        let empGross = 0
        
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
            })
            
            empGross += grossProfit
            totalGross += grossProfit
          }
        }
        
        if (empGross !== 0) {
          syncLog.push(`${cleanUsername}: ${rows.length} transactions, $${empGross.toFixed(2)}`)
          processedCount++
        }
        
      } catch (error: any) {
        errors.push(`Error processing ${cleanUsername}: ${error.message}`)
      }
    }
    
    // Step 5: Process test transactions
    const sobrofficeId = employeeMap.get('@sobroffice')
    if (sobrofficeId) {
      try {
        const testRange = `${monthName}!A2:D10000`
        const testResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: TEST_SPREADSHEET_ID,
          range: testRange,
          valueRenderOption: 'UNFORMATTED_VALUE'
        })
        
        const rows = testResponse.data.values || []
        let testGross = 0
        
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
            totalGross += grossProfit
          }
        }
        
        if (testGross !== 0) {
          syncLog.push(`@sobroffice (test): ${rows.length} transactions, $${testGross.toFixed(2)}`)
        }
        
      } catch (error: any) {
        errors.push(`Error processing test sheet: ${error.message}`)
      }
    }
    
    // Step 6: Save transactions in batches
    if (allTransactions.length > 0) {
      syncLog.push(`Saving ${allTransactions.length} transactions...`)
      
      const batchSize = 500
      for (let i = 0; i < allTransactions.length; i += batchSize) {
        const batch = allTransactions.slice(i, i + batchSize)
        const { error } = await supabase.from('transactions').insert(batch)
        
        if (error) {
          errors.push(`Batch insert error: ${error.message}`)
        }
        
        await delay(100)
      }
    }
    
    // Step 7: Process expenses
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
          totalExpenses += parseNumberValue(row[0])
        }
      })
      
      if (totalExpenses > 0) {
        await supabase.from('expenses').insert([{
          month: monthCode,
          amount_usd: totalExpenses,
        }])
        syncLog.push(`Expenses: $${totalExpenses.toFixed(2)}`)
      }
    } catch (error: any) {
      errors.push(`Error processing expenses: ${error.message}`)
    }
    
    // Step 8: Process cards and themes
    try {
      // Clear existing cards
      await supabase.from('cards').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      
      // Read cards
      const cardsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: CARDS_SPREADSHEET_ID,
        range: 'REVO UK!A2:E1000',
        valueRenderOption: 'UNFORMATTED_VALUE'
      })
      
      const cardRows = cardsResponse.data.values || []
      const cards: any[] = []
      
      // Read themes to determine card status
      const themesRange = `${monthName} themes!A2:Z1000`
      const themesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: THEMES_SPREADSHEET_ID,
        range: themesRange,
        valueRenderOption: 'UNFORMATTED_VALUE'
      })
      
      const themesRows = themesResponse.data.values || []
      const usedCards = new Map<string, string>()
      
      // Process themes
      for (const row of themesRows) {
        if (row[0]) {
          const casino = String(row[0]).trim()
          for (let i = 1; i < row.length; i++) {
            if (row[i]) {
              const cardNumber = extractCardNumber(row[i])
              if (cardNumber) {
                usedCards.set(cardNumber, casino)
              }
            }
          }
        }
      }
      
      // Process cards
      for (const row of cardRows) {
        if (row[0]) {
          const cardNumber = extractCardNumber(row[0])
          if (cardNumber && cardNumber.length >= 15) {
            const casino = usedCards.get(cardNumber)
            cards.push({
              card_number: cardNumber,
              status: casino ? 'used' : 'available',
              casino_name: casino || null,
              sheet: 'REVO UK'
            })
          }
        }
      }
      
      if (cards.length > 0) {
        await supabase.from('cards').insert(cards)
        syncLog.push(`Processed ${cards.length} cards, ${usedCards.size} used`)
      }
      
    } catch (error: any) {
      errors.push(`Error processing cards: ${error.message}`)
    }
    
    // Final summary
    const elapsed = Date.now() - startTime
    
    return NextResponse.json({
      success: true,
      stats: {
        employeesProcessed: processedCount,
        transactionsCreated: allTransactions.length,
        totalGross: Math.round(totalGross * 100) / 100,
        totalNet: Math.round(totalGross * 100) / 100,
        timeElapsed: `${elapsed}ms`,
        cardsProcessed: 0
      },
      syncLog,
      errors,
      message: `Sync completed in ${elapsed}ms`
    })
    
  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      syncLog,
      errors
    }, { status: 500 })
  }
}
