import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    // Получаем несколько транзакций для проверки структуры
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .limit(5)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    // Проверяем структуру колонок
    let columns = null
    let columnsError = null
    try {
      const result = await supabase
        .rpc('get_table_columns', { table_name: 'transactions' })
      columns = result.data
      columnsError = result.error
    } catch (e) {
      columnsError = 'RPC not available'
    }
    
    return NextResponse.json({
      success: true,
      sample_transactions: transactions,
      transaction_count: transactions?.length || 0,
      first_transaction_fields: transactions?.[0] ? Object.keys(transactions[0]) : [],
      columns_info: columns || 'Not available',
      timestamp_check: transactions?.map(t => ({
        id: t.id,
        created_at: t.created_at,
        sync_timestamp: t.sync_timestamp,
        last_updated: t.last_updated,
        has_created_at: !!t.created_at,
        has_sync_timestamp: !!t.sync_timestamp,
        has_last_updated: !!t.last_updated
      }))
    })
    
  } catch (error: any) {
    console.error('Debug transactions error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
