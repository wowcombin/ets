import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    console.log(`Loading dashboard data for ${currentMonth}...`)
    
    // Получаем ВСЕХ сотрудников
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .order('username')
    
    if (empError) {
      console.error('Error loading employees:', empError)
      throw empError
    }
    
    // Разделяем на активных и уволенных
    const activeEmployees = employees?.filter(e => !e.username.includes('УВОЛЕН') && e.is_active !== false) || []
    const firedEmployees = employees?.filter(e => e.username.includes('УВОЛЕН') || e.is_active === false) || []
    
    // Получаем ВСЕ транзакции за текущий месяц БЕЗ ЛИМИТА
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('*, employee:employees(username, is_manager)')
      .eq('month', currentMonth)
      .limit(10000) // Явно указываем большой лимит
    
    if (transError) {
      console.error('Error loading transactions:', transError)
      throw transError
    }
    
    console.log(`Found ${transactions?.length || 0} transactions for ${currentMonth}`)
    
    // Получаем расходы
    const { data: expenses, error: expError } = await supabase
      .from('expenses')
      .select('*')
      .eq('month', currentMonth)
    
    if (expError) {
      console.error('Error loading expenses:', expError)
      throw expError
    }
    
    // Получаем зарплаты
    const { data: salaries, error: salError } = await supabase
      .from('salaries')
      .select('*, employee:employees(username, is_manager)')
      .eq('month', currentMonth)
      .order('total_salary', { ascending: false })
    
    if (salError) {
      console.error('Error loading salaries:', salError)
      throw salError
    }
    
    console.log(`Found ${salaries?.length || 0} salaries for ${currentMonth}`)
    
    // Получаем карты
    const { data: cards, error: cardError } = await supabase
      .from('cards')
      .select('*')
      .order('card_number')
    
    if (cardError) {
      console.error('Error loading cards:', cardError)
      throw cardError
    }
    
    // ВАЖНО: Рассчитываем статистику из ВСЕХ транзакций
    let totalGross = 0
    let totalNet = 0
    let totalExpenses = 0
    
    // Считаем брутто из транзакций
    if (transactions && transactions.length > 0) {
      totalGross = transactions.reduce((sum, t) => {
        return sum + (parseFloat(t.gross_profit_usd) || 0)
      }, 0)
    }
    
    // Считаем расходы
    if (expenses && expenses.length > 0) {
      totalExpenses = expenses.reduce((sum, e) => {
        return sum + (parseFloat(e.amount_usd) || 0)
      }, 0)
    }
    
    totalNet = totalGross - totalExpenses
    
    // Считаем использованные карты из транзакций
    const usedCardNumbers = new Set<string>()
    transactions?.forEach(t => {
      if (t.card_number) {
        usedCardNumbers.add(t.card_number)
      }
    })
    const usedCardCount = usedCardNumbers.size
    
    console.log(`Stats: Gross=$${totalGross.toFixed(2)}, Net=$${totalNet.toFixed(2)}, Expenses=$${totalExpenses.toFixed(2)}`)
    
    // Группируем статистику по сотрудникам
    const employeeStats = new Map()
    
    transactions?.forEach(t => {
      if (!t.employee_id) return
      
      if (!employeeStats.has(t.employee_id)) {
        employeeStats.set(t.employee_id, {
          username: t.employee?.username || 'Unknown',
          totalDeposits: 0,
          totalWithdrawals: 0,
          totalGross: 0,
          transactionCount: 0,
          casinos: new Set()
        })
      }
      
      const stats = employeeStats.get(t.employee_id)
      stats.totalDeposits += parseFloat(t.deposit_usd) || 0
      stats.totalWithdrawals += parseFloat(t.withdrawal_usd) || 0
      stats.totalGross += parseFloat(t.gross_profit_usd) || 0
      stats.transactionCount++
      if (t.casino_name) {
        stats.casinos.add(t.casino_name)
      }
    })
    
    // Конвертируем в массив для отправки
    const employeeStatsArray = Array.from(employeeStats.entries()).map(([id, stats]) => ({
      id,
      username: stats.username,
      totalDeposits: Math.round(stats.totalDeposits * 100) / 100,
      totalWithdrawals: Math.round(stats.totalWithdrawals * 100) / 100,
      totalGross: Math.round(stats.totalGross * 100) / 100,
      transactionCount: stats.transactionCount,
      casinos: Array.from(stats.casinos)
    }))
    
    // Группируем статистику по казино
    const casinoStats = new Map()
    
    transactions?.forEach(t => {
      if (!t.casino_name) return
      
      if (!casinoStats.has(t.casino_name)) {
        casinoStats.set(t.casino_name, {
          totalDeposits: 0,
          totalWithdrawals: 0,
          totalGross: 0,
          transactionCount: 0,
          employees: new Set()
        })
      }
      
      const stats = casinoStats.get(t.casino_name)
      stats.totalDeposits += parseFloat(t.deposit_usd) || 0
      stats.totalWithdrawals += parseFloat(t.withdrawal_usd) || 0
      stats.totalGross += parseFloat(t.gross_profit_usd) || 0
      stats.transactionCount++
      if (t.employee?.username) {
        stats.employees.add(t.employee.username)
      }
    })
    
    // Конвертируем в массив
    const casinoStatsArray = Array.from(casinoStats.entries()).map(([name, stats]) => ({
      name,
      totalDeposits: Math.round(stats.totalDeposits * 100) / 100,
      totalWithdrawals: Math.round(stats.totalWithdrawals * 100) / 100,
      totalGross: Math.round(stats.totalGross * 100) / 100,
      transactionCount: stats.transactionCount,
      employees: Array.from(stats.employees)
    }))
    
    // Округляем финальные значения
    totalGross = Math.round(totalGross * 100) / 100
    totalNet = Math.round(totalNet * 100) / 100
    totalExpenses = Math.round(totalExpenses * 100) / 100
    
    const responseData = {
      success: true,
      data: {
        employees: activeEmployees,
        firedEmployees,
        transactions: transactions || [],
        expenses: expenses || [],
        salaries: salaries || [],
        cards: cards || [],
        month: currentMonth,
        stats: {
          totalGross,
          totalNet,
          totalExpenses,
          employeeCount: activeEmployees.length,
          totalEmployeeCount: employees?.length || 0,
          cardCount: cards?.length || 0,
          usedCardCount,
          transactionCount: transactions?.length || 0,
          salaryCount: salaries?.length || 0,
        },
        employeeStats: employeeStatsArray,
        casinoStats: casinoStatsArray
      }
    }
    
    console.log('Dashboard data prepared:', {
      month: currentMonth,
      transactions: transactions?.length || 0,
      totalGross,
      totalNet,
      salaries: salaries?.length || 0,
      usedCards: usedCardCount
    })
    
    return NextResponse.json(responseData)
    
  } catch (error: any) {
    console.error('Dashboard data error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to load dashboard data',
      details: error
    }, { status: 500 })
  }
}
