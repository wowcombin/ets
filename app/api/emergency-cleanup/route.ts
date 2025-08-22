import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  try {
    const supabase = getServiceSupabase()
    
    console.log('EMERGENCY CLEANUP: Removing ALL transactions to stop duplication...')
    
    // Получаем статистику до очистки
    const { count: beforeCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
    
    const { data: beforeGross } = await supabase
      .from('transactions')
      .select('gross_profit_usd')
    
    const totalGrossBefore = beforeGross?.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) || 0
    
    console.log(`Before cleanup: ${beforeCount} transactions, $${totalGrossBefore.toFixed(2)} gross`)
    
    // УДАЛЯЕМ ВСЕ ТРАНЗАКЦИИ
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Удаляем все
    
    if (deleteError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to clear transactions: ' + deleteError.message
      }, { status: 500 })
    }
    
    // Проверяем что все удалилось
    const { count: afterCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
    
    console.log(`After cleanup: ${afterCount} transactions remaining`)
    
    return NextResponse.json({
      success: true,
      message: 'Emergency cleanup completed - all transactions cleared',
      stats: {
        transactionsBefore: beforeCount || 0,
        transactionsAfter: afterCount || 0,
        transactionsRemoved: (beforeCount || 0) - (afterCount || 0),
        grossBefore: Math.round(totalGrossBefore * 100) / 100
      },
      nextStep: 'Run /api/sync-all to import fresh data from Google Sheets'
    })
    
  } catch (error: any) {
    console.error('Emergency cleanup error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
