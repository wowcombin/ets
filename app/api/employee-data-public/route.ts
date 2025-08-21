import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

// Временный публичный endpoint для диагностики проблем с employee dashboard
export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    console.log('PUBLIC Employee data API called for month:', currentMonth)
    
    // Получаем всех активных сотрудников (не менеджеров)
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('is_manager', false)
      .eq('is_active', true)
    
    if (empError) {
      console.error('Employees error:', empError)
      throw empError
    }
    
    console.log('Found employees:', employees?.length)
    
    // Получаем транзакции с пагинацией
    let allTransactions: any[] = []
    let from = 0
    const limit = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('transactions')
        .select('*, employee:employees(username, is_manager)')
        .eq('month', currentMonth)
        .range(from, from + limit - 1)
        .order('created_at', { ascending: false })
      
      if (batchError) {
        console.error(`Error fetching batch from ${from}:`, batchError)
        break
      }
      
      if (batch && batch.length > 0) {
        allTransactions = [...allTransactions, ...batch]
        from += limit
        hasMore = batch.length === limit
      } else {
        hasMore = false
      }
    }
    
    const transactions = allTransactions
    console.log('Total transactions fetched:', transactions.length)
    
    // Фильтруем только транзакции сотрудников
    const employeeIds = employees?.map(e => e.id) || []
    const employeeTransactions = transactions.filter(t => 
      employeeIds.includes(t.employee_id) && !t.employee?.is_manager
    )
    
    console.log('Employee transactions:', employeeTransactions.length)
    
    // Получаем зарплаты
    const { data: salaries, error: salError } = await supabase
      .from('salaries')
      .select('*, employee:employees(username, is_manager)')
      .eq('month', currentMonth)
      .in('employee_id', employeeIds)
      .order('total_salary', { ascending: false })
    
    if (salError) {
      console.error('Salaries error:', salError)
    }
    
    console.log('Salaries found:', salaries?.length)
    
    // Статистика по сотрудникам
    const employeeStats = employees?.map(emp => {
      const empTransactions = employeeTransactions.filter(t => t.employee_id === emp.id)
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
        rank: 0
      }
    }) || []
    
    // Сортируем по зарплате
    employeeStats.sort((a, b) => {
      const salaryA = a.salary?.total_salary || 0
      const salaryB = b.salary?.total_salary || 0
      return salaryB - salaryA
    })
    
    // Устанавливаем ранги
    employeeStats.forEach((emp, index) => {
      emp.rank = index + 1
    })
    
    // Последние успешные транзакции
    const recentTransactions = employeeTransactions
      .filter(t => (t.gross_profit_usd || 0) > 0)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20)
    
    console.log('Recent positive transactions:', recentTransactions.length)
    
    const response = NextResponse.json({
      success: true,
      data: {
        month: currentMonth,
        user: {
          id: 'public',
          username: 'PUBLIC_ACCESS',
          is_manager: false,
          stats: employeeStats[0] || null
        },
        stats: {
          totalGross: employeeTransactions.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0),
          employeeCount: employees?.length || 0,
          transactionCount: employeeTransactions.length,
          casinoCount: new Set(employeeTransactions.map(t => t.casino_name)).size
        },
        leaderboard: employeeStats,
        casinoStats: [],
        recentTransactions: recentTransactions.map(t => ({
          id: t.id,
          employee: t.employee?.username,
          casino_name: t.casino_name,
          gross_profit_usd: t.gross_profit_usd,
          created_at: t.created_at,
          created_at_debug: {
            original: t.created_at,
            parsed: new Date(t.created_at).toISOString(),
            formatted: new Date(t.created_at).toLocaleString('ru-RU'),
            timestamp: new Date(t.created_at).getTime()
          }
        })),
        lastUpdated: new Date().toISOString(),
        debug: {
          employeesCount: employees?.length,
          allTransactionsCount: transactions.length,
          employeeTransactionsCount: employeeTransactions.length,
          salariesCount: salaries?.length,
          recentTransactionsCount: recentTransactions.length
        }
      }
    })
    
    // Добавляем заголовки для предотвращения кэширования
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
    
  } catch (error: any) {
    console.error('Public employee data error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Ошибка получения данных',
        debug: {
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    )
  }
}
