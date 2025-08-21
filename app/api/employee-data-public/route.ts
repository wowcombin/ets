import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

// Временный публичный endpoint для диагностики проблем с employee dashboard
export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    console.log('PUBLIC Employee data API called for month:', currentMonth)
    
    // Получаем активных сотрудников (не менеджеров, не уволенных, с WORK папкой)
    const { data: allEmployees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('is_manager', false)
    
    // Фильтруем сотрудников: исключаем уволенных и без WORK папки
    const employees = allEmployees?.filter(emp => {
      console.log(`Checking employee ${emp.username}: active=${emp.is_active}, folder_id=${emp.folder_id}`)
      
      // Исключаем уволенных (username содержит УВОЛЕН)
      if (emp.username.includes('УВОЛЕН')) {
        console.log(`Excluding fired: ${emp.username}`)
        return false
      }
      
      // Исключаем неактивных
      if (!emp.is_active) {
        console.log(`Excluding inactive: ${emp.username}`)
        return false
      }
      
      // Проверяем наличие folder_id (означает что есть папка WORK)
      if (!emp.folder_id) {
        console.log(`Excluding no WORK folder: ${emp.username}`)
        return false
      }
      
      console.log(`Including: ${emp.username}`)
      return true
    }) || []
    
    if (empError) {
      console.error('Employees error:', empError)
      throw empError
    }
    
    console.log('Found employees after filtering:', employees?.length)
    const employeeIds = employees?.map(e => e.id) || []
    console.log('Employee IDs:', employeeIds.length)
    
    // Получаем транзакции с пагинацией ТОЛЬКО для отфильтрованных сотрудников
    let allTransactions: any[] = []
    let from = 0
    const limit = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('transactions')
        .select('*, employee:employees(username, is_manager)')
        .eq('month', currentMonth)
        .in('employee_id', employeeIds) // Получаем только транзакции отфильтрованных сотрудников
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
    console.log('Total transactions fetched for active employees:', transactions.length)
    
    // Все транзакции уже от правильных сотрудников
    const employeeTransactions = transactions
    
    console.log('Employee transactions:', employeeTransactions.length)
    
    // Получаем зарплаты
    let { data: salaries, error: salError } = await supabase
      .from('salaries')
      .select('*, employee:employees(username, is_manager)')
      .eq('month', currentMonth)
      .in('employee_id', employeeIds)
      .order('total_salary', { ascending: false })
    
    if (salError) {
      console.error('Salaries error:', salError)
    }
    
    console.log('Salaries found:', salaries?.length)
    
    // Если зарплаты не найдены, попробуем их рассчитать
    if (!salaries || salaries.length === 0) {
      console.log('No salaries found, triggering salary calculation...')
      try {
        const calcResponse = await fetch(`${process.env.NEXTAUTH_URL || 'https://etsmo.vercel.app'}/api/calculate-salaries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (calcResponse.ok) {
          console.log('Salary calculation triggered successfully')
          // Перезапрашиваем зарплаты
          const { data: newSalaries } = await supabase
            .from('salaries')
            .select('*, employee:employees(username, is_manager)')
            .eq('month', currentMonth)
            .in('employee_id', employeeIds)
            .order('total_salary', { ascending: false })
          
          if (newSalaries) {
            console.log('New salaries found after calculation:', newSalaries.length)
            salaries = newSalaries
          }
        }
      } catch (calcError) {
        console.error('Salary calculation error:', calcError)
      }
    }
    
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
    
    // Последние обновления от отфильтрованных сотрудников (где есть заполненные клетки > 0)
    const recentUpdates = employeeTransactions // Используем транзакции уже отфильтрованных сотрудников
      .filter(t => {
        // Показываем записи где есть депозит > 0 ИЛИ вывод > 0
        const hasDeposit = (t.deposit_usd || 0) > 0
        const hasWithdrawal = (t.withdrawal_usd || 0) > 0
        return hasDeposit || hasWithdrawal
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20)
      .map(t => {
        const deposit = t.deposit_usd || 0
        const withdrawal = t.withdrawal_usd || 0
        const profit = withdrawal - deposit
        const adjustedProfit = profit * 1.3
        
        return {
          ...t,
          calculated_profit: adjustedProfit,
          has_deposit: deposit > 0,
          has_withdrawal: withdrawal > 0,
          raw_profit: profit,
          display_time: t.created_at,
          is_recent: (new Date().getTime() - new Date(t.created_at).getTime()) < 3600000
        }
      })
    
    console.log('Recent updates:', recentUpdates.length)
    
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
        recentUpdates: recentUpdates.map(t => ({
          id: t.id,
          employee: t.employee?.username,
          casino_name: t.casino_name,
          deposit_usd: t.deposit_usd,
          withdrawal_usd: t.withdrawal_usd,
          raw_profit: t.raw_profit,
          calculated_profit: t.calculated_profit,
          has_deposit: t.has_deposit,
          has_withdrawal: t.has_withdrawal,
          card_number: t.card_number,
          created_at: t.created_at,
          display_time: t.display_time,
          is_recent: t.is_recent,
          update_type: t.has_deposit && t.has_withdrawal ? 'complete' : t.has_deposit ? 'deposit' : 'withdrawal'
        })),
        lastUpdated: new Date().toISOString(),
        debug: {
          employeesCount: employees?.length,
          allTransactionsCount: transactions.length,
          employeeTransactionsCount: employeeTransactions.length,
          salariesCount: salaries?.length,
          recentUpdatesCount: recentUpdates.length
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
