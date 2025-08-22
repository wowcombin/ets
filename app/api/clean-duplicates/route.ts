import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  try {
    const supabase = getServiceSupabase()
    
    console.log('Cleaning duplicate transactions...')
    
    // SQL для удаления дубликатов, оставляя только последние записи
    const cleanDuplicatesSQL = `
      -- Удаляем дубликаты транзакций, оставляя только самые новые
      DELETE FROM transactions 
      WHERE id NOT IN (
        SELECT DISTINCT ON (employee_id, month, casino_name, deposit_usd, withdrawal_usd, card_number) id
        FROM transactions 
        ORDER BY employee_id, month, casino_name, deposit_usd, withdrawal_usd, card_number, created_at DESC
      );
    `
    
    // Сначала проверим количество до очистки
    const { count: beforeCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
    
    console.log(`Transactions before cleanup: ${beforeCount}`)
    
    // Выполняем очистку через прямой SQL
    const { error } = await supabase.rpc('exec_sql', { sql: cleanDuplicatesSQL })
    
    if (error) {
      console.error('Error cleaning duplicates:', error)
      return NextResponse.json({
        success: false,
        error: error.message,
        sql: cleanDuplicatesSQL
      }, { status: 500 })
    }
    
    // Проверяем количество после очистки
    const { count: afterCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
    
    console.log(`Transactions after cleanup: ${afterCount}`)
    
    const duplicatesRemoved = (beforeCount || 0) - (afterCount || 0)
    
    return NextResponse.json({
      success: true,
      message: `Duplicates cleaned successfully!`,
      stats: {
        transactionsBefore: beforeCount || 0,
        transactionsAfter: afterCount || 0,
        duplicatesRemoved: duplicatesRemoved
      }
    })
    
  } catch (error: any) {
    console.error('Clean duplicates error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred'
    }, { status: 500 })
  }
}
