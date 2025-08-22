import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { requireSimpleAuth } from '@/lib/simple-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireSimpleAuth()
    
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    // Получаем активных сотрудников (не менеджеров, не уволенных, с WORK папкой)
    const { data: allEmployees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('is_manager', false)
    
    // Фильтруем сотрудников: исключаем уволенных и без WORK папки
    const employees = allEmployees?.filter(emp => {
      // Исключаем уволенных (username содержит УВОЛЕН)
      if (emp.username.includes('УВОЛЕН')) {
        return false
      }
      
      // Исключаем неактивных
      if (!emp.is_active) {
        return false
      }
      
      // Проверяем наличие folder_id (означает что есть папка WORK)
      if (!emp.folder_id) {
        return false
      }
      
      return true
    }) || []
    
    if (empError) throw empError
    
    // ВАЖНО: Получаем транзакции ТОЛЬКО сотрудников для лидерборда
    const employeeIds = employees?.map(e => e.id) || []
    
    // Для скорости загружаем только последние транзакции для отображения
    console.log('Fetching recent transactions for display...')
    const { data: recentTransactionsData, error: recentError } = await supabase
      .from('transactions')
      .select('*, employee:employees(username, is_manager)')
      .eq('month', currentMonth)
      .in('employee_id', employeeIds)
      .order('sync_timestamp', { ascending: false, nullsFirst: false })
      .limit(200)
    
    if (recentError) {
      console.error('Error fetching recent transactions:', recentError)
    }
    
    // Для полной статистики получаем все транзакции без JOIN
    console.log('Fetching all employee transactions for statistics...')
    const { data: allEmployeeTransactions, error: allError } = await supabase
      .from('transactions')
      .select('employee_id, gross_profit_usd, deposit_usd, withdrawal_usd, casino_name, card_number, created_at, sync_timestamp')
      .eq('month', currentMonth)
      .in('employee_id', employeeIds)
      .range(0, 10000) // Получаем ВСЕ транзакции, не только первые 1000
    
    if (allError) {
      console.error('Error fetching all transactions:', allError)
    }
    
    const transactions = allEmployeeTransactions || []
    console.log(`Total employee transactions fetched: ${transactions.length}`)
    
    // Получаем зарплаты только сотрудников
    const { data: salaries, error: salError } = await supabase
      .from('salaries')
      .select('*, employee:employees(username, is_manager)')
      .eq('month', currentMonth)
      .in('employee_id', employeeIds)
      .order('total_salary', { ascending: false })
    
    if (salError) throw salError
    
    // Получаем общую статистику более эффективно
    console.log('Calculating total statistics...')
    
    // Получаем список менеджеров и тестовых аккаунтов для исключения
    const { data: managersAndTest } = await supabase
      .from('employees')
      .select('id')
      .or('is_manager.eq.true,username.eq.@sobroffice')
    
    const excludeIds = managersAndTest?.map(e => e.id) || []
    
    // Считаем общий профит напрямую через агрегацию в базе
    let statsQuery = supabase
      .from('transactions')
      .select('gross_profit_usd')
      .eq('month', currentMonth)
    
    // Добавляем исключение только если есть ID для исключения
    if (excludeIds.length > 0) {
      statsQuery = statsQuery.not('employee_id', 'in', excludeIds)
    }
    
    // ВАЖНО: Указываем большой лимит, чтобы получить ВСЕ транзакции
    statsQuery = statsQuery.range(0, 10000)
    
    const { data: statsData, error: statsError } = await statsQuery
    
    if (statsError) {
      console.error('Error fetching stats:', statsError)
    }
    
    const totalGross = statsData?.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) || 0
    const totalTransactionCount = statsData?.length || 0
    
    console.log(`Total gross from EMPLOYEES only: $${totalGross.toFixed(2)} (${totalTransactionCount} transactions)`)
    console.log('Stats data sample:', statsData?.slice(0, 5))
    
    // Статистика по сотрудникам с расчетом заработка на лету
    const employeeStats = employees?.map(emp => {
      const empTransactions = transactions?.filter(t => t.employee_id === emp.id) || []
      const empSalary = salaries?.find(s => s.employee_id === emp.id)
      
      const totalEmpGross = empTransactions.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0)
      const transactionCount = empTransactions.length
      const casinoCount = new Set(empTransactions.map(t => t.casino_name)).size
      
      // Рассчитываем заработок на лету если зарплата не рассчитана
      let calculatedSalary = null
      if (!empSalary && totalEmpGross > 0) {
        const baseSalary = totalEmpGross * 0.1 // 10% от брутто
        const bonus = totalEmpGross >= 2000 ? 200 : 0 // $200 ТОЛЬКО если брутто >= $2000
        
        // Находим максимальную транзакцию для бонуса лидера (пока для всех, позже определим одного лидера)
        const maxTransaction = Math.max(...empTransactions.map(t => t.gross_profit_usd || 0))
        
        calculatedSalary = {
          base_salary: baseSalary,
          bonus: bonus,
          leader_bonus: 0, // Будет установлен позже только для одного лидера
          max_transaction: maxTransaction,
          total_salary: baseSalary + bonus,
          is_paid: false,
          calculated_on_fly: true
        }
      }
      
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
          is_paid: empSalary.is_paid,
          calculated_on_fly: false
        } : calculatedSalary,
        rank: 0 // будет установлен позже
      }
    }) || []
    
    // Определяем лидера месяца (один сотрудник с самой большой транзакцией)
    let monthLeader: any = null
    let maxTransactionValue = 0
    
    employeeStats.forEach(emp => {
      const empMaxTransaction = (emp.salary as any)?.max_transaction || 0
      if (empMaxTransaction > maxTransactionValue) {
        maxTransactionValue = empMaxTransaction
        monthLeader = emp
      }
    })
    
    // Устанавливаем бонус лидера только для одного сотрудника
    if (monthLeader && maxTransactionValue > 0) {
      const leaderBonus = maxTransactionValue * 0.1 // 10% от самой большой транзакции
      if (monthLeader.salary) {
        monthLeader.salary.leader_bonus = leaderBonus
        monthLeader.salary.total_salary = (monthLeader.salary.base_salary || 0) + (monthLeader.salary.bonus || 0) + leaderBonus
        monthLeader.is_month_leader = true
      }
      console.log(`Month leader: ${monthLeader.username} with transaction $${maxTransactionValue}, bonus: $${leaderBonus}`)
    }
    
    // Теперь сортируем по итоговой зарплате (включая все бонусы)
    employeeStats.sort((a, b) => {
      const salaryA = a.salary?.total_salary || 0
      const salaryB = b.salary?.total_salary || 0
      return salaryB - salaryA
    })
    
    // Устанавливаем ранги после финальной сортировки
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
        casinoStats[t.casino_name].employees.add(t.employee_id)
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
    
    // Последние обновления от ВСЕХ (включая менеджеров)
    const recentUpdates = recentTransactionsData
      ?.filter(t => {
        // Показываем записи где есть депозит > 0 ИЛИ вывод > 0
        const hasDeposit = (t.deposit_usd || 0) > 0
        const hasWithdrawal = (t.withdrawal_usd || 0) > 0
        return hasDeposit || hasWithdrawal
      })
      .sort((a, b) => {
        // Сортируем по времени синхронизации (самые свежие сверху)
        const timeA = new Date(a.sync_timestamp || a.created_at).getTime()
        const timeB = new Date(b.sync_timestamp || b.created_at).getTime()
        return timeB - timeA
      })
      .slice(0, 20)
      .map(t => {
        // Профит уже рассчитан в USD при синхронизации
        const deposit = t.deposit_usd || 0
        const withdrawal = t.withdrawal_usd || 0
        const profit = withdrawal - deposit
        
        return {
          ...t,
          calculated_profit: profit,
          has_deposit: deposit > 0,
          has_withdrawal: withdrawal > 0,
          raw_profit: profit,
          display_time: t.sync_timestamp || t.created_at, // Время когда данные попали в нашу систему
          is_recent: (new Date().getTime() - new Date(t.sync_timestamp || t.created_at).getTime()) < 3600000 // Новое если меньше часа
        }
      }) || []
    
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
      
      const monthlyProfit = empTransactions.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0)
      
      return {
        username: emp.username,
        isActive: emp.is_active,
        latestActivity: latestTransaction?.created_at,
        weeklyProfit: recentProfit,
        monthlyProfit: monthlyProfit, // Добавляем месячный профит для сравнения
        totalTransactions: empTransactions.length,
        averageProfit: empTransactions.length > 0 ? monthlyProfit / empTransactions.length : 0,
        topCasino: empTransactions.reduce((acc, t) => {
          if (!acc[t.casino_name]) acc[t.casino_name] = 0
          acc[t.casino_name] += t.gross_profit_usd || 0
          return acc
        }, {} as Record<string, number>)
      }
    }).map(emp => ({
      ...emp,
      topCasino: Object.entries(emp.topCasino).sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'Нет данных'
    })).sort((a, b) => b.monthlyProfit - a.monthlyProfit) || [] // Сортируем по месячному профиту для соответствия с таблицей лидеров
    
    const response = NextResponse.json({
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
          transactionCount: totalTransactionCount, // Общее количество транзакций от сотрудников
          casinoCount: sortedCasinos.length
        },
        leaderboard: employeeStats.sort((a, b) => a.rank - b.rank),
        casinoStats: sortedCasinos,
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
          sync_timestamp: t.sync_timestamp,
          update_type: t.has_deposit && t.has_withdrawal ? 'complete' : t.has_deposit ? 'deposit' : 'withdrawal'
        })),
        accountsActivity: newAccountsActivity.slice(0, 10), // Топ-10 активных аккаунтов
        weeklyLeaders: newAccountsActivity.filter(emp => emp.weeklyProfit > 0).slice(0, 5), // Топ-5 за неделю
        lastUpdated: new Date().toISOString()
      }
    })
    
    // Добавляем заголовки для предотвращения кэширования
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
    
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
