// app/api/check-fired/route.ts
import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Проверяем в Google Drive
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

    const folders = response.data.files || []
    
    // Находим папки с "УВОЛЕН"
    const firedInDrive = folders.filter(f => f.name?.includes('УВОЛЕН')).map(f => ({
      folderName: f.name,
      username: f.name?.replace(' УВОЛЕН', '').trim(),
      folderId: f.id
    }))
    
    // Проверяем в базе данных
    const supabase = getServiceSupabase()
    const { data: employees } = await supabase
      .from('employees')
      .select('*')
      .order('username')
    
    const firedInDb = employees?.filter(e => !e.is_active || e.username.includes('УВОЛЕН')) || []
    const activeInDb = employees?.filter(e => e.is_active && !e.username.includes('УВОЛЕН')) || []
    
    // Находим несоответствия
    const mismatches = []
    
    for (const fired of firedInDrive) {
      const empInDb = employees?.find(e => e.username === fired.username)
      if (empInDb && empInDb.is_active) {
        mismatches.push({
          username: fired.username,
          inDrive: 'УВОЛЕН',
          inDb: 'Активен',
          needsUpdate: true
        })
      }
    }
    
    // Проверяем активных в БД, которые могут быть уволены в Drive
    for (const emp of activeInDb) {
      const folderInDrive = folders.find(f => {
        const cleanName = f.name?.replace(' УВОЛЕН', '').trim()
        return cleanName === emp.username
      })
      
      if (folderInDrive?.name?.includes('УВОЛЕН')) {
        if (!mismatches.find(m => m.username === emp.username)) {
          mismatches.push({
            username: emp.username,
            inDrive: 'УВОЛЕН',
            inDb: 'Активен',
            needsUpdate: true
          })
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      googleDrive: {
        totalFolders: folders.length,
        firedCount: firedInDrive.length,
        firedEmployees: firedInDrive
      },
      database: {
        totalEmployees: employees?.length || 0,
        activeCount: activeInDb.length,
        firedCount: firedInDb.length,
        firedEmployees: firedInDb.map(e => ({
          username: e.username,
          is_active: e.is_active
        }))
      },
      mismatches,
      needsSync: mismatches.length > 0,
      message: mismatches.length > 0 
        ? `Найдено ${mismatches.length} несоответствий. Необходима синхронизация.`
        : 'Все статусы сотрудников синхронизированы.'
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
