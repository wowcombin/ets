import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    // Создаем таблицу истории изменений транзакций
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS transaction_history (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
          employee_id UUID REFERENCES employees(id),
          casino_name TEXT,
          old_deposit_usd DECIMAL(10,2),
          new_deposit_usd DECIMAL(10,2),
          old_withdrawal_usd DECIMAL(10,2),
          new_withdrawal_usd DECIMAL(10,2),
          old_profit_usd DECIMAL(10,2),
          new_profit_usd DECIMAL(10,2),
          change_type TEXT CHECK (change_type IN ('update', 'correction')),
          changed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
          sync_source TEXT DEFAULT 'sync-all'
        );
        
        CREATE INDEX IF NOT EXISTS idx_transaction_history_transaction_id ON transaction_history(transaction_id);
        CREATE INDEX IF NOT EXISTS idx_transaction_history_employee_id ON transaction_history(employee_id);
        CREATE INDEX IF NOT EXISTS idx_transaction_history_changed_at ON transaction_history(changed_at);
      `
    })
    
    if (createError) {
      throw createError
    }
    
    // Даем права на таблицу
    const { error: grantError } = await supabase.rpc('exec_sql', {
      sql: `
        GRANT ALL ON transaction_history TO authenticated;
        GRANT ALL ON transaction_history TO service_role;
      `
    })
    
    if (grantError) {
      console.error('Grant error:', grantError)
    }
    
    return NextResponse.json({
      success: true,
      message: 'Transaction history table created successfully'
    })
    
  } catch (error: any) {
    console.error('Setup transaction history error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
