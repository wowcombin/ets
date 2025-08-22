import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const monthCode = getCurrentMonthCode()
    
    // Получаем последние транзакции
    const { data: latestTransactions, error } = await supabase
      .from('transactions')
      .select('*, employee:employees(username)')
      .eq('month', monthCode)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) throw error
    
    // Получаем общее количество транзакций за месяц
    const { count: totalCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('month', monthCode)
    
    // Получаем транзакции за последние 10 минут
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: recentTransactions, count: recentCount } = await supabase
      .from('transactions')
      .select('*, employee:employees(username)', { count: 'exact' })
      .eq('month', monthCode)
      .gte('created_at', tenMinutesAgo)
      .order('created_at', { ascending: false })
    
    return NextResponse.json({
      success: true,
      currentMonth: monthCode,
      totalTransactions: totalCount || 0,
      recentTransactionsLast10Min: recentCount || 0,
      latestTransactions: latestTransactions?.map(t => ({
        id: t.id,
        employee: t.employee?.username,
        casino: t.casino_name,
        deposit: t.deposit_usd,
        withdrawal: t.withdrawal_usd,
        profit: t.gross_profit_usd,
        created_at: t.created_at,
        minutesAgo: Math.round((Date.now() - new Date(t.created_at).getTime()) / (1000 * 60))
      })),
      recentTransactions: recentTransactions?.map(t => ({
        id: t.id,
        employee: t.employee?.username,
        casino: t.casino_name,
        created_at: t.created_at
      }))
    })
    
  } catch (error: any) {
    console.error('Check latest transactions error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}

function getCurrentMonthCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  return `${year}-${month}`
}
