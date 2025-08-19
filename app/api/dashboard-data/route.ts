import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    // Получаем сотрудников
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .order('username')
    
    if (empError) throw empError
    
    // Получаем транзакции за текущий месяц с данными сотрудников
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('*, employee:employees(username)')
      .eq('month', currentMonth)
      .order('created_at', { ascending: false })
    
    if (transError) throw transError
    
    // Получаем расходы
    const { data: expenses, error: expError } = await supabase
      .from('expenses')
      .select('*')
      .eq('month', currentMonth)
    
    if (expError) throw expError
    
    // Получаем зарплаты с данными сотрудников
    const { data: salaries, error: salError } = await supabase
      .from('salaries')
      .select('*, employee:employees(username)')
      .eq('month', currentMonth)
      .order('total_salary', { ascending: false })
    
    if (salError) throw salError
    
    // Получаем карты
    const { data: cards, error: cardError } = await supabase
      .from('cards')
      .select('*')
      .order('card_number')
    
    if (cardError) throw cardError
    
    // Рассчитываем статистику
    const totalGross = transactions?.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) || 0
    const totalNet = transactions?.reduce((sum, t) => sum + (t.net_profit_usd || 0), 0) || 0
    const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_usd || 0), 0) || 0
    const usedCardCount = cards?.filter(c => c.status === 'used').length || 0
    
    return NextResponse.json({
      success: true,
      data: {
        employees: employees || [],
        transactions: transactions || [],
        expenses: expenses || [],
        salaries: salaries || [],
        cards: cards || [],
        month: currentMonth,
        stats: {
          totalGross,
          totalNet,
          totalExpenses,
          employeeCount: employees?.length || 0,
          cardCount: cards?.length || 0,
          usedCardCount,
        }
      }
    })
    
  } catch (error: any) {
    console.error('Dashboard data error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to load dashboard data'
    }, { status: 500 })
  }
}
