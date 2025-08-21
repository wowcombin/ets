import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { requireSimpleAuth } from '@/lib/simple-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireSimpleAuth()
    
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    // Получаем только данные сотрудников (не менеджеров)
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('is_manager', false)
      .eq('is_active', true)
    
    if (empError) throw empError
    
    // Получаем транзакции только сотрудников
    const employeeIds = employees?.map(e => e.id) || []
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('*, employee:employees(username, is_manager)')
      .eq('month', currentMonth)
      .in('employee_id', employeeIds)
      .order('created_at', { ascending: false })
    
    if (transError) throw transError
    
    // Получаем зарплаты только сотрудников
    const { data: salaries, error: salError } = await supabase
      .from('salaries')
      .select('*, employee:employees(username, is_manager)')
      .eq('month', currentMonth)
      .in('employee_id', employeeIds)
      .order('total_salary', { ascending: false })
    
    if (salError) throw salError
    
    // Рассчитываем статистику без расходов и данных менеджеров
    const totalGross = transactions?.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) || 0
    
    // Статистика по сотрудникам
    const employeeStats = employees?.map(emp => {
      const empTransactions = transactions?.filter(t => t.employee_id === emp.id) || []
      const empSalary = salaries?.find(s => s.employee_id === emp.id)
      
      const totalEmpGross = empTransactions.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0)
      const transactionCount = empTransactions.length
      const casinoCount = new Set(empTransactions.map(t => t.casino_name)).size
      
      return {
        id: emp.id,
        username: emp.username,
        totalGross: totalEmpGross,
        transactionCount,
        casinoCount,
        salary: empSalary ? {
          base_salary: empSalary.base_salary,
          bonus: empSalary.bonus,
          leader_bonus: empSalary.leader_bonus,
          total_salary: empSalary.total_salary,
          is_paid: empSalary.is_paid
        } : null,
        rank: 0 // будет установлен позже
      }
    }) || []
    
    // Сортируем по итоговой зарплате (total_salary), а не по профиту
    employeeStats.sort((a, b) => {
      const salaryA = a.salary?.total_salary || 0
      const salaryB = b.salary?.total_salary || 0
      return salaryB - salaryA
    })
    
    // Устанавливаем ранги после сортировки по зарплате
    employeeStats.forEach((emp, index) => {
      emp.rank = index + 1
    })
    
    // Статистика по казино (только от сотрудников)
    const casinoStats: Record<string, any> = {}
    transactions?.forEach(t => {
      if (t.casino_name) {
        if (!casinoStats[t.casino_name]) {
          casinoStats[t.casino_name] = {
            name: t.casino_name,
            totalGross: 0,
            transactionCount: 0,
            employees: new Set()
          }
        }
        casinoStats[t.casino_name].totalGross += t.gross_profit_usd || 0
        casinoStats[t.casino_name].transactionCount++
        casinoStats[t.casino_name].employees.add(t.employee?.username)
      }
    })
    
    const sortedCasinos = Object.values(casinoStats)
      .map((casino: any) => ({
        ...casino,
        employees: Array.from(casino.employees),
        employeeCount: casino.employees.size,
        avgProfit: casino.transactionCount > 0 ? casino.totalGross / casino.transactionCount : 0
      }))
      .sort((a: any, b: any) => b.totalGross - a.totalGross)
    
    // Данные текущего пользователя
    const currentUserStats = employeeStats.find(emp => emp.id === user.id)
    
    // Последние транзакции (только от сотрудников)
    const recentTransactions = transactions?.slice(0, 20) || []
    
    // Анализ новых аккаунтов (сотрудники с недавней активностью)
    const newAccountsActivity = employees?.map(emp => {
      const empTransactions = transactions?.filter(t => t.employee_id === emp.id) || []
      const latestTransaction = empTransactions.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
      
      const recentProfit = empTransactions
        .filter(t => {
          const transDate = new Date(t.created_at)
          const weekAgo = new Date()
          weekAgo.setDate(weekAgo.getDate() - 7)
          return transDate >= weekAgo
        })
        .reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0)
      
      return {
        username: emp.username,
        isActive: emp.is_active,
        latestActivity: latestTransaction?.created_at,
        weeklyProfit: recentProfit,
        totalTransactions: empTransactions.length,
        averageProfit: empTransactions.length > 0 ? 
          empTransactions.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) / empTransactions.length : 0,
        topCasino: empTransactions.reduce((acc, t) => {
          if (!acc[t.casino_name]) acc[t.casino_name] = 0
          acc[t.casino_name] += t.gross_profit_usd || 0
          return acc
        }, {} as Record<string, number>)
      }
    }).map(emp => ({
      ...emp,
      topCasino: Object.entries(emp.topCasino).sort(([,a], [,b]) => b - a)[0]?.[0] || 'Нет данных'
    })).sort((a, b) => b.weeklyProfit - a.weeklyProfit) || []
    
    return NextResponse.json({
      success: true,
      data: {
        month: currentMonth,
        user: {
          id: user.id,
          username: user.username,
          is_manager: user.is_manager,
          stats: currentUserStats
        },
        stats: {
          totalGross,
          employeeCount: employees?.length || 0,
          transactionCount: transactions?.length || 0,
          casinoCount: sortedCasinos.length
        },
        leaderboard: employeeStats,
        casinoStats: sortedCasinos,
        recentTransactions: recentTransactions.map(t => ({
          id: t.id,
          employee: t.employee?.username,
          casino_name: t.casino_name,
          gross_profit_usd: t.gross_profit_usd,
          deposit_usd: t.deposit_usd,
          withdrawal_usd: t.withdrawal_usd,
          card_number: t.card_number,
          created_at: t.created_at
        })),
        accountsActivity: newAccountsActivity.slice(0, 10), // Топ-10 активных аккаунтов
        weeklyLeaders: newAccountsActivity.filter(emp => emp.weeklyProfit > 0).slice(0, 5) // Топ-5 за неделю
      }
    })
    
  } catch (error: any) {
    if (error.message === 'Не авторизован') {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      )
    }
    
    console.error('Employee data error:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки данных' },
      { status: 500 }
    )
  }
}
