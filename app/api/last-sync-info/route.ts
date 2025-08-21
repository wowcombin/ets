import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    // Получаем последнюю транзакцию для определения времени последней синхронизации
    const { data: lastTransaction, error } = await supabase
      .from('transactions')
      .select('created_at, employee_id, casino_name, gross_profit_usd, employee:employees!inner(username)')
      .eq('month', currentMonth)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw error
    }
    
    // Получаем общее количество транзакций
    const { count: totalTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('month', currentMonth)
    
    // Получаем количество транзакций за последний час
    const oneHourAgo = new Date()
    oneHourAgo.setHours(oneHourAgo.getHours() - 1)
    
    const { count: recentTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('month', currentMonth)
      .gte('created_at', oneHourAgo.toISOString())
    
    return NextResponse.json({
      success: true,
      data: {
        lastSync: lastTransaction ? {
          time: lastTransaction.created_at,
          employee: (lastTransaction.employee as any)?.username || 'Unknown',
          casino: lastTransaction.casino_name,
          profit: lastTransaction.gross_profit_usd,
          timeAgo: Math.round((new Date().getTime() - new Date(lastTransaction.created_at).getTime()) / (1000 * 60)) // минут назад
        } : null,
        stats: {
          totalTransactions: totalTransactions || 0,
          recentTransactions: recentTransactions || 0,
          currentTime: new Date().toISOString(),
          month: currentMonth
        }
      }
    })
    
  } catch (error: any) {
    console.error('Last sync info error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка получения информации о синхронизации' },
      { status: 500 }
    )
  }
}
