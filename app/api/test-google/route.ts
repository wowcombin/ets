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
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name, mimeType)',
      pageSize: 20
    })

    // Для каждой папки сотрудника ищем файл WORK
    const employeeFolders = response.data.files || []
    const employeeData = []

    for (const folder of employeeFolders) {
      if (folder.id) {
        // Ищем файл WORK в папке сотрудника
        const workFilesResponse = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'WORK'`,
          fields: 'files(id, name)',
          pageSize: 5
        })
        
        employeeData.push({
          folder: folder.name,
          folderId: folder.id,
          workFiles: workFilesResponse.data.files || []
        })
      }
    }

    // Также проверим тестовую таблицу
    const sheets = google.sheets({ version: 'v4', auth })
    let testSheetData = null
    
    try {
      const TEST_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'
      const testResponse = await sheets.spreadsheets.get({
        spreadsheetId: TEST_SPREADSHEET_ID,
        fields: 'properties.title,sheets.properties.title'
      })
      
      testSheetData = {
        title: testResponse.data.properties?.title,
        sheets: testResponse.data.sheets?.map(s => s.properties?.title)
      }
    } catch (error: any) {
      testSheetData = { error: error.message }
    }

    return NextResponse.json({
      success: true,
      message: 'Google API работает!',
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      employeeFoldersCount: employeeFolders.length,
      employeeData,
      testSheet: testSheetData
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
