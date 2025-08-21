import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    console.log('Upgrading transactions table with tracking fields...')
    
    // Добавляем новые поля для отслеживания времени обновлений
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Добавляем поля для отслеживания времени обновлений
        ALTER TABLE transactions 
        ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW());
        
        -- Создаем индекс для быстрого поиска по времени обновления
        CREATE INDEX IF NOT EXISTS idx_transactions_last_updated ON transactions(last_updated);
        CREATE INDEX IF NOT EXISTS idx_transactions_sync_timestamp ON transactions(sync_timestamp);
        
        -- Обновляем существующие записи - устанавливаем last_updated = created_at для старых записей
        UPDATE transactions 
        SET last_updated = created_at, sync_timestamp = TIMEZONE('utc', NOW())
        WHERE last_updated IS NULL;
      `
    })
    
    if (error) {
      console.error('Error upgrading transactions table:', error)
      return NextResponse.json({
        success: false,
        error: 'Ошибка обновления таблицы транзакций',
        details: error
      })
    }
    
    console.log('Transactions table upgraded successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Таблица транзакций успешно обновлена с полями отслеживания времени!',
      data: data
    })
    
  } catch (error: any) {
    console.error('Upgrade transactions table error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Ошибка обновления таблицы'
    }, { status: 500 })
  }
}
