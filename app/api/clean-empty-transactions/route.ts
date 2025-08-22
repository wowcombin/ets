import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    // Получаем текущий месяц
    const now = new Date()
    const year = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const monthCode = `${year}-${month}`
    
    console.log(`Cleaning empty transactions for month: ${monthCode}`)
    
    // Сначала получаем количество транзакций для удаления
    const { count: toDeleteCount, error: countError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('month', monthCode)
      .eq('deposit_usd', 0)
      .eq('withdrawal_usd', 0)
    
    if (countError) {
      throw countError
    }
    
    // Удаляем транзакции где и депозит и вывод равны нулю
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('month', monthCode)
      .eq('deposit_usd', 0)
      .eq('withdrawal_usd', 0)
    
    if (deleteError) {
      throw deleteError
    }
    
    // Получаем обновленную статистику
    const { count: remainingCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('month', monthCode)
    
    return NextResponse.json({
      success: true,
      message: `Удалено ${toDeleteCount || 0} пустых транзакций`,
      stats: {
        monthCode,
        deletedTransactions: toDeleteCount || 0,
        remainingTransactions: remainingCount || 0
      }
    })
    
  } catch (error: any) {
    console.error('Clean empty transactions error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
