import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = getServiceSupabase()
    
    console.log('Adding missing columns to transactions table...')
    
    // SQL для добавления недостающих столбцов
    const addColumnsSQL = `
      -- Добавляем недостающие столбцы в таблицу transactions
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();
      
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();
      
      -- Обновляем существующие записи
      UPDATE transactions 
      SET last_updated = created_at, sync_timestamp = created_at 
      WHERE last_updated IS NULL OR sync_timestamp IS NULL;
    `
    
    const { error } = await supabase.rpc('exec_sql', { sql: addColumnsSQL })
    
    if (error) {
      console.error('Error adding columns:', error)
      return NextResponse.json({
        success: false,
        error: error.message,
        sql: addColumnsSQL
      }, { status: 500 })
    }
    
    // Проверяем что столбцы добавились
    const { data: testInsert, error: testError } = await supabase
      .from('transactions')
      .insert([{
        employee_id: '00000000-0000-0000-0000-000000000000',
        month: '2025-08',
        casino_name: 'TEST_CASINO',
        deposit_gbp: 10,
        withdrawal_gbp: 15,
        deposit_usd: 13,
        withdrawal_usd: 19.5,
        card_number: '1234567890123456',
        gross_profit_usd: 6.5,
        net_profit_usd: 6.5,
        last_updated: new Date().toISOString(),
        sync_timestamp: new Date().toISOString()
      }])
      .select()
    
    if (testError) {
      return NextResponse.json({
        success: false,
        error: 'Test insert failed: ' + testError.message
      }, { status: 500 })
    }
    
    // Удаляем тестовую запись
    if (testInsert?.[0]?.id) {
      await supabase
        .from('transactions')
        .delete()
        .eq('id', testInsert[0].id)
    }
    
    return NextResponse.json({
      success: true,
      message: 'Transactions table fixed successfully! Missing columns added.',
      columnsAdded: ['last_updated', 'sync_timestamp']
    })
    
  } catch (error: any) {
    console.error('Fix transactions table error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred'
    }, { status: 500 })
  }
}
