import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('Testing Google API connection...')
    
    // Проверяем переменные окружения
    const hasEmail = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const hasKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    
    if (!hasEmail || !hasKey) {
      return NextResponse.json({
        error: 'Missing credentials',
        hasEmail,
        hasKey,
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'NOT SET'
      })
    }

    // Пробуем создать авторизацию
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

    // Пробуем получить доступ к Drive API
    const drive = google.drive({ version: 'v3', auth })
    
    // Пробуем получить список файлов в папке JUNIOR
    const JUNIOR_FOLDER_ID = '1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu'
    
    const response = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents`,
      fields: 'files(id, name, mimeType)',
      pageSize: 10
    })

    return NextResponse.json({
      success: true,
      message: 'Google API работает!',
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      filesFound: response.data.files?.length || 0,
      files: response.data.files || []
    })

  } catch (error: any) {
    console.error('Test error:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error.response?.data || error,
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    })
  }
}
