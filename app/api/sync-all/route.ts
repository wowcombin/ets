'use client'

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
  if (typeof value === 'number') return value
  
  let str = String(value).trim()
  // Удаляем все пробелы
  str = str.replace(/\s/g, '')
  // Заменяем запятую на точку для десятичных
  str = str.replace(',', '.')
  // Удаляем все символы кроме цифр, точки и минуса
  str = str.replace(/[^0-9.-]/g, '')
  
  const parsed = parseFloat(str)
  return isNaN(parsed) ? 0 : parsed
}

function extractCardNumber(value: any): string {
  if (!value) return ''
  return String(value).replace(/[^0-9]/g, '')
}

export async function GET(request: Request) {
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
    
    // Очищаем старые данные за текущий месяц
    await supabase.from('transactions').delete().eq('month', monthCode)
    await supabase.from('expenses').delete().eq('month', monthCode)
    await supabase.from('salaries').delete().eq('month', monthCode)
    
    // Получаем существующих сотрудников
    const { data: existingEmployees } = await supabase
      .from('employees')
      .select('*')
    
    const employeeMap = new Map()
    
    // Добавляем существующих в map
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
      }
    }
    
    // Получаем папки сотрудников
    const foldersResponse = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name)',
      pageSize: 1000,
    })
    
    const folders = foldersResponse.data.files || []
    console.log(`Found ${folders.length} employee folders`)
    
    // Создаем ВСЕХ сотрудников СНАЧАЛА
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
            profit_percentage: MANAGERS[cleanUsername as keyof typeof MANAGERS]?.percentage || 10.00,
            manager_type: null
          }])
          .select()
          .single()
        
        if (newEmp) {
          employeeMap.set(cleanUsername, newEmp.id)
          console.log(`Created employee: ${cleanUsername}`)
        }
      }
      
      results.employeesList.push(cleanUsername)
      results.stats.employeesProcessed++
    }
    
    console.log(`Total employees in map: ${employeeMap.size}`)
    
    // Теперь читаем транзакции
    const allTransactions = []
    let calculatedTotalGross = 0
    
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue
      
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      const employeeId = employeeMap.get(cleanUsername)
      
      if (!employeeId) {
        console.log(`WARNING: No ID for ${cleanUsername}`)
        continue
      }
      
      try {
        const workFiles = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'WORK'`,
          fields: 'files(id, name)',
        })
        
        const workFile = workFiles.data.files?.[0]
        if (!workFile?.id) continue
        
        const range = `${monthName}!A2:D5000`
        
        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: workFile.id,
            range,
          })
          
          const rows = response.data.values || []
          console.log(`Processing ${rows.length} rows for ${cleanUsername}`)
          
          for (const row of rows) {
            if (row[0]) {
              const depositGbp = parseNumberValue(row[1])
              const withdrawalGbp = parseNumberValue(row[2])
              const cardNumber = extractCardNumber(row[3])
              
              const depositUsd = depositGbp * GBP_TO_USD_RATE
              const withdrawalUsd = withdrawalGbp * GBP_TO_USD_RATE
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
              
              calculatedTotalGross += grossProfit
            }
          }
        } catch (e) {
          console.log(`No ${monthName} sheet for ${cleanUsername}`)
        }
      } catch (error: any) {
        console.error(`Error for ${cleanUsername}:`, error.message)
      }
    }
    
    // Читаем тестовые транзакции @sobroffice
    const sobrofficeId = employeeMap.get('@sobroffice')
    if (sobrofficeId) {
      try {
        const testRange = `${monthName}!A2:D5000`
        const testResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: TEST_SPREADSHEET_ID,
          range: testRange,
        })
        
        const rows = testResponse.data.values || []
        console.log(`Processing ${rows.length} test transactions for @sobroffice`)
        
        for (const row of rows) {
          if (row[0]) {
            const depositGbp = parseNumberValue(row[1])
            const withdrawalGbp = parseNumberValue(row[2])
            const cardNumber = extractCardNumber(row[3])
            
            const depositUsd = depositGbp * GBP_TO_USD_RATE
            const withdrawalUsd = withdrawalGbp * GBP_TO_USD_RATE
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
            
            calculatedTotalGross += grossProfit
          }
        }
      } catch (e) {
        console.log('No test sheet')
      }
    }
    
    console.log(`Total transactions to insert: ${allTransactions.length}`)
    console.log(`Calculated total gross: $${calculatedTotalGross.toFixed(2)}`)
    
    // Сохраняем транзакции
    if (allTransactions.length > 0) {
      const { error } = await supabase
        .from('transactions')
        .insert(allTransactions)
      
      if (!error) {
        results.stats.transactionsCreated = allTransactions.length
        results.stats.totalGross = calculatedTotalGross
      } else {
        results.errors.push(`Transaction error: ${error.message}`)
      }
    }
    
    // Читаем расходы
    try {
      const expenseRange = `${monthName} Spending!B2:B1000`
      const expenseResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: EXPENSES_SPREADSHEET_ID,
        range: expenseRange,
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
    } catch (e) {
      console.log('No expenses found')
    }
    
    results.stats.totalNet = results.stats.totalGross - results.stats.totalExpenses
    
    // Карты
    try {
      await supabase.from('cards').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      
      const cardsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: CARDS_SPREADSHEET_ID,
        range: 'REVO UK!A2:E1000',
      })
      
      const cards: any[] = []
      const rows = cardsResponse.data.values || []
      
      rows.forEach(row => {
        if (row[0]) {
          const cardNumber = extractCardNumber(row[0])
          if (cardNumber && cardNumber.length >= 15) {
            cards.push({
              card_number: cardNumber,
              status: 'available',
              sheet: 'REVO UK',
            })
          }
        }
      })
      
      if (cards.length > 0) {
        await supabase.from('cards').insert(cards)
        results.stats.cardsProcessed = cards.length
      }
    } catch (e) {
      console.log('Cards error:', e)
    }
    
    // Проверяем финальные данные в БД
    const { data: finalTransactions } = await supabase
      .from('transactions')
      .select('gross_profit_usd')
      .eq('month', monthCode)
    
    const dbTotalGross = finalTransactions?.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) || 0
    
    console.log(`Final DB total gross: $${dbTotalGross.toFixed(2)}`)
    
    const { count: finalTransCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('month', monthCode)
    
    const { count: finalEmpCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
    
    return NextResponse.json({
      success: true,
      stats: {
        ...results.stats,
        totalGross: dbTotalGross, // Используем актуальное значение из БД
        timeElapsed: `${Date.now() - startTime}ms`,
        transactionsInDb: finalTransCount || 0,
        totalEmployeesInDb: finalEmpCount || 0
      },
      month: monthName,
      monthCode,
      details: results.details,
      errors: results.errors,
      employeesList: results.employeesList,
      message: `Обработано ${results.stats.employeesProcessed} сотрудников, ${results.stats.transactionsCreated} транзакций`
    })
    
  } catch (error: any) {
    console.error('SYNC ERROR:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      results
    }, { status: 500 })
  }
}
