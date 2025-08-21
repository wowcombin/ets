import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireAuth()
    
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    // Получаем данные о сотрудниках (только не менеджеры)
    const { data: salaries, error } = await supabase
      .from('salaries')
      .select('*, employee:employees(username, is_manager, is_active)')
      .eq('month', currentMonth)
      .order('total_salary', { ascending: false })
    
    if (error) {
      throw error
    }
    
    // Фильтруем только работников (не менеджеров)
    const workersLeaderboard = salaries
      ?.filter(s => !s.employee.is_manager)
      .map((s, index) => ({
        rank: index + 1,
        username: s.employee.username,
        total_salary: s.total_salary,
        base_salary: s.base_salary,
        bonus: s.bonus,
        leader_bonus: s.leader_bonus,
        is_paid: s.is_paid,
        paid_at: s.paid_at,
        is_active: s.employee.is_active
      }))
    
    // Получаем общий профит без расходов
    const { data: transactions } = await supabase
      .from('transactions')
      .select('gross_profit_usd')
      .eq('month', currentMonth)
    
    const totalGross = transactions?.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) || 0
    
    // Статистика по казино
    const { data: casinoStats } = await supabase
      .from('transactions')
      .select('casino_name, gross_profit_usd')
      .eq('month', currentMonth)
    
    const casinoProfit: Record<string, number> = {}
    casinoStats?.forEach(t => {
      if (t.casino_name) {
        casinoProfit[t.casino_name] = (casinoProfit[t.casino_name] || 0) + (t.gross_profit_usd || 0)
      }
    })
    
    const sortedCasinos = Object.entries(casinoProfit)
      .map(([name, profit]) => ({ name, profit }))
      .sort((a, b) => b.profit - a.profit)
    
    return NextResponse.json({
      success: true,
      data: {
        month: currentMonth,
        totalGross,
        leaderboard: workersLeaderboard,
        casinoStats: sortedCasinos,
        user: {
          username: user.username,
          is_manager: user.is_manager
        }
      }
    })
    
  } catch (error: any) {
    if (error.message === 'Не авторизован') {
      return NextResponse.json({
        success: false,
        error: 'Не авторизован'
      }, { status: 401 })
    }
    
    console.error('Leaderboard error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
