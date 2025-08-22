import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    console.log('Checking database structure...')
    
    const results: any = {
      tables: {},
      errors: []
    }
    
    // Проверяем таблицу transactions
    try {
      const { data: transactionsTest, error: transError } = await supabase
        .from('transactions')
        .select('*')
        .limit(1)
      
      results.tables.transactions = {
        exists: !transError,
        error: transError?.message,
        canRead: !!transactionsTest || transactionsTest === null
      }
      
      // Проверяем можем ли вставлять
      const testTransaction = {
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
      }
      
      const { error: insertError, data: insertData } = await supabase
        .from('transactions')
        .insert([testTransaction])
        .select()
      
      if (insertError) {
        results.tables.transactions.canInsert = false
        results.tables.transactions.insertError = insertError.message
      } else {
        results.tables.transactions.canInsert = true
        // Удаляем тестовую запись
        if (insertData?.[0]?.id) {
          await supabase
            .from('transactions')
            .delete()
            .eq('id', insertData[0].id)
        }
      }
      
    } catch (error: any) {
      results.tables.transactions = {
        exists: false,
        error: error.message
      }
    }
    
    // Проверяем таблицу employees
    try {
      const { data: employeesTest, error: empError } = await supabase
        .from('employees')
        .select('id, username')
        .limit(5)
      
      results.tables.employees = {
        exists: !empError,
        count: employeesTest?.length || 0,
        error: empError?.message
      }
    } catch (error: any) {
      results.tables.employees = {
        exists: false,
        error: error.message
      }
    }
    
    // Проверяем общее количество транзакций
    try {
      const { count: transCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
      
      results.currentTransactionCount = transCount || 0
    } catch (error: any) {
      results.currentTransactionCount = 'error: ' + error.message
    }
    
    return NextResponse.json({
      success: true,
      database: results,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('Database check error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
