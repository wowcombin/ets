import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Отслеживание изменений в Google Sheets путем сравнения данных
export async function POST() {
  try {
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    console.log('=== TRACKING SHEET CHANGES ===')
    
    // Получаем текущие данные из базы для сравнения
    const { data: existingTransactions } = await supabase
      .from('transactions')
      .select('employee_id, casino_name, card_number, deposit_usd, withdrawal_usd, gross_profit_usd')
      .eq('month', currentMonth)
    
    // Создаем карту существующих транзакций для быстрого поиска
    const existingMap = new Map()
    existingTransactions?.forEach(t => {
      const key = `${t.employee_id}_${t.casino_name}_${t.card_number}`
      existingMap.set(key, t)
    })
    
    // Получаем свежие данные из Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const JUNIOR_FOLDER_ID = '1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu'
    
    // Получаем список папок сотрудников
    const drive = google.drive({ version: 'v3', auth })
    const { data: folders } = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder'`,
      pageSize: 1000,
      fields: 'files(id, name)'
    })
    
    const newUpdates: any[] = []
    const currentTime = new Date()
    
    // Проверяем каждую папку сотрудника
    for (const folder of folders.files || []) {
      const folderName = folder.name || ''
      
      // Пропускаем уволенных
      if (folderName.includes('УВОЛЕН')) continue
      
      // Извлекаем username
      const usernameMatch = folderName.match(/@[\w\d_]+/)
      if (!usernameMatch) continue
      
      const username = usernameMatch[0]
      
      // Получаем employee_id из базы
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('username', username)
        .single()
      
      if (!employee) continue
      
      try {
        // Ищем WORK таблицу в папке сотрудника
        const { data: workFiles } = await drive.files.list({
          q: `'${folder.id}' in parents and name contains 'WORK'`,
          pageSize: 10,
          fields: 'files(id, name)'
        })
        
        const workFile = workFiles?.files?.[0]
        if (!workFile) continue
        
        // Читаем данные из листа August
        const sheetResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: workFile.id!,
          range: 'August!A:D',
        })
        
        const rows = sheetResponse.data.values || []
        
        // Анализируем каждую строку
        for (let i = 1; i < rows.length; i++) { // Пропускаем заголовок
          const row = rows[i]
          if (!row || row.length < 4) continue
          
          const casino = row[0]
          const deposit = parseFloat(row[1]) || 0
          const withdrawal = parseFloat(row[2]) || 0
          const cardNumber = row[3]
          
          if (!casino || (!deposit && !withdrawal)) continue
          
          const key = `${employee.id}_${casino}_${cardNumber}`
          const existing = existingMap.get(key)
          
          // Проверяем изменились ли данные
          if (!existing || 
              existing.deposit_usd !== deposit || 
              existing.withdrawal_usd !== withdrawal) {
            
            newUpdates.push({
              employee_id: employee.id,
              username: username,
              casino_name: casino,
              card_number: cardNumber,
              deposit_usd: deposit,
              withdrawal_usd: withdrawal,
              gross_profit_usd: withdrawal - deposit,
              change_detected_at: currentTime.toISOString(),
              is_new: !existing,
              old_values: existing || null
            })
          }
        }
        
      } catch (sheetError) {
        console.error(`Error reading sheet for ${username}:`, sheetError)
        continue
      }
    }
    
    console.log(`Found ${newUpdates.length} changes`)
    
    // Сохраняем информацию об изменениях в отдельную таблицу
    if (newUpdates.length > 0) {
      // Создаем таблицу для отслеживания изменений если её нет
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS sheet_changes (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              employee_id UUID REFERENCES employees(id),
              username VARCHAR(255),
              casino_name VARCHAR(255),
              card_number VARCHAR(255),
              deposit_usd DECIMAL(10,2),
              withdrawal_usd DECIMAL(10,2),
              gross_profit_usd DECIMAL(10,2),
              change_detected_at TIMESTAMP WITH TIME ZONE,
              is_new BOOLEAN DEFAULT true,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
          );
          
          CREATE INDEX IF NOT EXISTS idx_sheet_changes_detected ON sheet_changes(change_detected_at);
          CREATE INDEX IF NOT EXISTS idx_sheet_changes_employee ON sheet_changes(employee_id);
        `
      }).catch(e => console.log('Table might already exist:', e))
      
      // Вставляем новые изменения
      const { error: insertError } = await supabase
        .from('sheet_changes')
        .insert(newUpdates.map(update => ({
          employee_id: update.employee_id,
          username: update.username,
          casino_name: update.casino_name,
          card_number: update.card_number,
          deposit_usd: update.deposit_usd,
          withdrawal_usd: update.withdrawal_usd,
          gross_profit_usd: update.gross_profit_usd,
          change_detected_at: update.change_detected_at,
          is_new: update.is_new
        })))
      
      if (insertError) {
        console.error('Error inserting sheet changes:', insertError)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Обнаружено ${newUpdates.length} изменений в Google Sheets`,
      data: {
        changesFound: newUpdates.length,
        changes: newUpdates.slice(0, 10), // Показываем первые 10
        timestamp: currentTime.toISOString()
      }
    })
    
  } catch (error: any) {
    console.error('Sheet changes tracking error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Ошибка отслеживания изменений'
    }, { status: 500 })
  }
}
