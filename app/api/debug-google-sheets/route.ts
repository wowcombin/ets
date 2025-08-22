import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const JUNIOR_FOLDER_ID = '1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu'

function getCurrentMonthName(): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  return months[new Date().getMonth()]
}

export async function GET() {
  try {
    const monthName = getCurrentMonthName()
    console.log('Debugging Google Sheets for month:', monthName)
    
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
    
    // Получаем папки сотрудников
    const foldersResponse = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name)',
      pageSize: 10, // Только первые 10 для тестирования
    })
    
    const folders = foldersResponse.data.files || []
    console.log(`Found ${folders.length} employee folders`)
    
    const results = {
      monthName,
      foldersFound: folders.length,
      folderDetails: [] as any[],
      sheetData: [] as any[]
    }
    
    // Проверяем первые 3 папки
    for (let i = 0; i < Math.min(3, folders.length); i++) {
      const folder = folders[i]
      if (!folder.id || !folder.name) continue
      
      const cleanUsername = folder.name.replace(' УВОЛЕН', '').trim()
      
      try {
        // Ищем файл WORK
        const workFiles = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'WORK'`,
          fields: 'files(id, name)',
        })
        
        const workFile = workFiles.data.files?.[0]
        
        const folderInfo: any = {
          username: cleanUsername,
          folderId: folder.id,
          hasWorkFile: !!workFile,
          workFileId: workFile?.id,
          workFileName: workFile?.name
        }
        
        if (workFile?.id) {
          try {
            const range = `${monthName}!A2:D10`
            const response = await sheets.spreadsheets.values.get({
              spreadsheetId: workFile.id,
              range,
              majorDimension: 'ROWS',
              valueRenderOption: 'UNFORMATTED_VALUE'
            })
            
            const rows = response.data.values || []
            folderInfo.sheetExists = true
            folderInfo.rowsFound = rows.length
            folderInfo.sampleRows = rows.slice(0, 3) // Первые 3 строки для примера
            
            results.sheetData.push({
              username: cleanUsername,
              rows: rows.length,
              sampleData: rows.slice(0, 2)
            })
            
          } catch (sheetError: any) {
            folderInfo.sheetExists = false
            folderInfo.sheetError = sheetError.message
          }
        }
        
        results.folderDetails.push(folderInfo)
        
      } catch (error: any) {
        results.folderDetails.push({
          username: cleanUsername,
          error: error.message
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      debug: results
    })
    
  } catch (error: any) {
    console.error('Debug Google Sheets error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
