import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    // Получаем количество записей в каждой таблице
    const { count: employeeCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
    
    const { count: transactionCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      
    const { count: cardCount } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      
    const { count: expenseCount } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      
    const { count: salaryCount } = await supabase
      .from('salaries')
      .select('*', { count: 'exact', head: true })
    
    // Получаем последние 5 сотрудников
    const { data: employees } = await supabase
      .from('employees')
      .select('username, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    
    // Получаем последние 5 транзакций
    const { data: transactions } = await supabase
      .from('transactions')
      .select('casino_name, gross_profit_usd, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    
    // Получаем общую статистику по текущему месяцу
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    const { data: monthTransactions } = await supabase
      .from('transactions')
      .select('gross_profit_usd, net_profit_usd')
      .eq('month', currentMonth)
    
    const totalGross = monthTransactions?.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) || 0
    const totalNet = monthTransactions?.reduce((sum, t) => sum + (t.net_profit_usd || 0), 0) || 0
    
    return NextResponse.json({
      success: true,
      counts: {
        employees: employeeCount || 0,
        transactions: transactionCount || 0,
        cards: cardCount || 0,
        expenses: expenseCount || 0,
        salaries: salaryCount || 0
      },
      currentMonth,
      monthlyStats: {
        totalGross,
        totalNet,
        transactionCount: monthTransactions?.length || 0
      },
      recentEmployees: employees || [],
      recentTransactions: transactions || [],
      message: 'Database check complete'
    })
  } catch (error: any) {
    console.error('Database check error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error
    })
  }
}
