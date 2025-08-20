import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Получаем папки из Google Drive
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    })

    const drive = google.drive({ version: 'v3', auth })
    
    const response = await drive.files.list({
      q: `'1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name)',
      pageSize: 1000,
    })

    const googleFolders = response.data.files || []
    
    // Получаем сотрудников из базы
    const supabase = getServiceSupabase()
    const { data: dbEmployees } = await supabase
      .from('employees')
      .select('*')
      .order('username')
    
    // Сравниваем
    const googleUsernames = googleFolders.map(f => f.name?.replace(' УВОЛЕН', '').trim())
    const dbUsernames = dbEmployees?.map(e => e.username) || []
    
    const missingInDb = googleUsernames.filter(u => !dbUsernames.includes(u))
    const extraInDb = dbUsernames.filter(u => !googleUsernames.includes(u) && !['@sobroffice', '@vladsohr', '@n1mbo', '@i88jU'].includes(u))
    
    return NextResponse.json({
      googleDrive: {
        total: googleFolders.length,
        folders: googleFolders.map(f => ({
          name: f.name,
          username: f.name?.replace(' УВОЛЕН', '').trim(),
          isFired: f.name?.includes('УВОЛЕН')
        }))
      },
      database: {
        total: dbEmployees?.length || 0,
        employees: dbEmployees?.map(e => ({
          username: e.username,
          isActive: e.is_active,
          isManager: e.is_manager
        }))
      },
      comparison: {
        missingInDb,
        extraInDb,
        matched: googleUsernames.filter(u => dbUsernames.includes(u)).length
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
