import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    // Проверяем все таблицы
    const checks = {
      currentMonth,
      timestamp: new Date().toISOString(),
      tables: {} as any,
      latestData: {} as any,
      errors: [] as string[]
    }
    
    // 1. Проверяем сотрудников
    try {
      const { data: employees, count } = await supabase
        .from('employees')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(5)
      
      checks.tables.employees = {
        count: count || 0,
        hasData: !!employees && employees.length > 0,
        latest: employees?.[0] || null
      }
    } catch (error: any) {
      checks.errors.push(`Employees: ${error.message}`)
    }
    
    // 2. Проверяем транзакции за текущий месяц
    try {
      const { data: transactions, count } = await supabase
        .from('transactions')
        .select('*, employee:employees(username)', { count: 'exact' })
        .eq('month', currentMonth)
        .order('created_at', { ascending: false })
        .limit(5)
      
      checks.tables.transactions = {
        count: count || 0,
        hasData: !!transactions && transactions.length > 0,
        latest: transactions?.[0] || null,
        month: currentMonth
      }
      
      // Считаем общий брутто
      if (transactions && transactions.length > 0) {
        const { data: allTrans } = await supabase
          .from('transactions')
          .select('gross_profit_usd, net_profit_usd')
          .eq('month', currentMonth)
        
        const totalGross = allTrans?.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) || 0
        const totalNet = allTrans?.reduce((sum, t) => sum + (t.net_profit_usd || 0), 0) || 0
        
        checks.tables.transactions.totalGross = totalGross
        checks.tables.transactions.totalNet = totalNet
      }
    } catch (error: any) {
      checks.errors.push(`Transactions: ${error.message}`)
    }
    
    // 3. Проверяем расходы
    try {
      const { data: expenses, count } = await supabase
        .from('expenses')
        .select('*', { count: 'exact' })
        .eq('month', currentMonth)
      
      checks.tables.expenses = {
        count: count || 0,
        hasData: !!expenses && expenses.length > 0,
        totalAmount: expenses?.reduce((sum, e) => sum + (e.amount_usd || 0), 0) || 0,
        month: currentMonth
      }
    } catch (error: any) {
      checks.errors.push(`Expenses: ${error.message}`)
    }
    
    // 4. Проверяем карты
    try {
      const { data: cards, count } = await supabase
        .from('cards')
        .select('*', { count: 'exact' })
      
      const usedCards = cards?.filter(c => c.status === 'used').length || 0
      const assignedCards = cards?.filter(c => c.status === 'assigned').length || 0
      const availableCards = cards?.filter(c => c.status === 'available').length || 0
      
      checks.tables.cards = {
        count: count || 0,
        hasData: !!cards && cards.length > 0,
        status: {
          used: usedCards,
          assigned: assignedCards,
          available: availableCards
        }
      }
    } catch (error: any) {
      checks.errors.push(`Cards: ${error.message}`)
    }
    
    // 5. Проверяем зарплаты
    try {
      const { data: salaries, count } = await supabase
        .from('salaries')
        .select('*, employee:employees(username)', { count: 'exact' })
        .eq('month', currentMonth)
        .order('total_salary', { ascending: false })
      
      checks.tables.salaries = {
        count: count || 0,
        hasData: !!salaries && salaries.length > 0,
        month: currentMonth,
        totalSalaries: salaries?.reduce((sum, s) => sum + (s.total_salary || 0), 0) || 0,
        topEarner: salaries?.[0] || null
      }
    } catch (error: any) {
      checks.errors.push(`Salaries: ${error.message}`)
    }
    
    // 6. Проверяем последнюю синхронизацию
    try {
      const { data: lastTrans } = await supabase
        .from('transactions')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      checks.latestData.lastTransactionCreated = lastTrans?.created_at || null
    } catch (error: any) {
      checks.errors.push(`Latest check: ${error.message}`)
    }
    
    // Формируем итоговый статус
    const hasAnyData = Object.values(checks.tables).some((t: any) => t.hasData)
    const hasCurrentMonthData = checks.tables.transactions?.hasData || false
    
    return NextResponse.json({
      success: true,
      status: {
        hasAnyData,
        hasCurrentMonthData,
        isHealthy: checks.errors.length === 0,
        needsSync: !hasCurrentMonthData
      },
      data: checks,
      recommendations: [
        !hasAnyData ? 'База данных пуста. Выполните синхронизацию.' : null,
        !hasCurrentMonthData ? `Нет данных за ${currentMonth}. Выполните синхронизацию.` : null,
        checks.tables.salaries?.count === 0 ? 'Зарплаты не рассчитаны. Выполните расчет после синхронизации.' : null,
        checks.errors.length > 0 ? 'Есть ошибки при работе с базой данных.' : null
      ].filter(Boolean)
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
