import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    // Получаем ВСЕ транзакции
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, employee:employees(username)')
      .eq('month', currentMonth)
    
    // Группируем по сотрудникам
    const byEmployee = new Map()
    let totalGross = 0
    
    transactions?.forEach(t => {
      totalGross += t.gross_profit_usd || 0
      
      const username = t.employee?.username || 'Unknown'
      if (!byEmployee.has(username)) {
        byEmployee.set(username, {
          count: 0,
          gross: 0,
          deposits: 0,
          withdrawals: 0
        })
      }
      
      const emp = byEmployee.get(username)
      emp.count++
      emp.gross += t.gross_profit_usd || 0
      emp.deposits += t.deposit_usd || 0
      emp.withdrawals += t.withdrawal_usd || 0
    })
    
    // Конвертируем в массив
    const employeeBreakdown = Array.from(byEmployee.entries()).map(([username, data]) => ({
      username,
      ...data
    })).sort((a, b) => b.gross - a.gross)
    
    return NextResponse.json({
      success: true,
      month: currentMonth,
      totalTransactions: transactions?.length || 0,
      totalGross,
      employeeBreakdown,
      raw: transactions?.slice(0, 10) // первые 10 для проверки
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
