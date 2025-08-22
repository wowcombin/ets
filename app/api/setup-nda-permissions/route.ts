import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const NDA_FOLDER_ID = '1yEj7s7qYvkI3Bg0fL7AXVNYQ7X1iwwAp'

export async function POST() {
  try {
    console.log('Setting up NDA folder permissions...')
    
    // Настройка Google API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/documents',
      ],
    })

    const drive = google.drive({ version: 'v3', auth })

    // Проверяем доступ к папке
    try {
      const folderInfo = await drive.files.get({
        fileId: NDA_FOLDER_ID,
        fields: 'id,name,permissions'
      })
      
      console.log('Folder info:', folderInfo.data)
    } catch (error: any) {
      console.error('Cannot access folder:', error.message)
      return NextResponse.json({
        success: false,
        error: `Cannot access NDA folder: ${error.message}`,
        serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
      }, { status: 403 })
    }

    // Пытаемся создать тестовый документ
    const docs = google.docs({ version: 'v1', auth })
    
    try {
      const testDoc = await docs.documents.create({
        requestBody: {
          title: `Test_NDA_${Date.now()}`
        }
      })
      
      const documentId = testDoc.data.documentId!
      
      // Перемещаем в папку NDA
      await drive.files.update({
        fileId: documentId,
        addParents: NDA_FOLDER_ID,
        removeParents: 'root'
      })
      
      // Удаляем тестовый документ
      await drive.files.delete({
        fileId: documentId
      })
      
      return NextResponse.json({
        success: true,
        message: 'Permissions are working correctly',
        serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
      })
      
    } catch (error: any) {
      console.error('Cannot create document:', error.message)
      return NextResponse.json({
        success: false,
        error: `Cannot create documents: ${error.message}`,
        serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        suggestion: 'Please share the NDA folder with the service account email and give Editor permissions'
      }, { status: 403 })
    }
    
  } catch (error: any) {
    console.error('Setup permissions error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred'
    }, { status: 500 })
  }
}
