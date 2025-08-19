import { NextResponse } from 'next/server'
import { google } from 'googleapis'

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
    
    // Получаем ВСЕ папки
    const response = await drive.files.list({
      q: `'1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu' in parents and mimeType='application/vnd.google-apps.folder'`,
      fields: 'files(id, name)',
      pageSize: 1000,
    })

    const folders = response.data.files || []
    const employeeFolders = folders.filter(f => f.name?.includes('@'))
    
    return NextResponse.json({
      success: true,
      totalFolders: folders.length,
      employeeFolders: employeeFolders.length,
      folders: employeeFolders.map(f => f.name),
      allFolders: folders.map(f => f.name)
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}
