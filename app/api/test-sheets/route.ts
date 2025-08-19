import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Проверяем credentials
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Missing Google credentials'
      })
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
      ],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    
    // Тестовая таблица
    const TEST_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'
    
    // Читаем данные из August листа
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: TEST_SPREADSHEET_ID,
      range: 'August!A1:D50', // Первые 50 строк
    })
    
    const rows = response.data.values || []
    
    // Обрабатываем данные
    const transactions = []
    for (let i = 1; i < rows.length; i++) { // Пропускаем заголовок
      const row = rows[i]
      if (row[0]) {
        transactions.push({
          casino: row[0],
          deposit: row[1] || '0',
          withdrawal: row[2] || '0',
          card: row[3] || '',
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      spreadsheetId: TEST_SPREADSHEET_ID,
      range: 'August!A1:D50',
      rowCount: rows.length,
      transactionCount: transactions.length,
      firstRows: transactions.slice(0, 10), // Первые 10 транзакций
      rawData: rows.slice(0, 5), // Первые 5 сырых строк для отладки
    })
    
  } catch (error: any) {
    console.error('Test sheets error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.response?.data || error
    })
  }
}
