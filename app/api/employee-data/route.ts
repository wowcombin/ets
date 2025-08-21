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
    
    // ВАЖНО: Получаем ВСЕ транзакции сотрудников используя пагинацию
    const employeeIds = employees?.map(e => e.id) || []
    console.log('Fetching ALL employee transactions with pagination...')
    let allTransactions: any[] = []
    let from = 0
    const limit = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('transactions')
        .select('*, employee:employees(username, is_manager)')
        .eq('month', currentMonth)
        .in('employee_id', employeeIds)
        .range(from, from + limit - 1)
        .order('created_at', { ascending: false })
      
      if (batchError) {
        console.error(`Error fetching employee batch from ${from}:`, batchError)
        break
      }
      
      if (batch && batch.length > 0) {
        allTransactions = [...allTransactions, ...batch]
        console.log(`Employee batch: ${from} to ${from + batch.length - 1}, total so far: ${allTransactions.length}`)
        from += limit
        hasMore = batch.length === limit
      } else {
        hasMore = false
      }
    }
    
    const transactions = allTransactions
    console.log(`Total employee transactions fetched: ${transactions.length}`)
    
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
    
    // Сортируем по итоговой зарплате (total_salary), а не по профиту
    employeeStats.sort((a, b) => {
      const salaryA = a.salary?.total_salary || 0
      const salaryB = b.salary?.total_salary || 0
      return salaryB - salaryA
    })
    
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
      const leaderBonus = maxTransactionValue * 0.2 // 20% от самой большой транзакции
      if (monthLeader.salary) {
        monthLeader.salary.leader_bonus = leaderBonus
        monthLeader.salary.total_salary = (monthLeader.salary.base_salary || 0) + (monthLeader.salary.bonus || 0) + leaderBonus
        monthLeader.is_month_leader = true
      }
      console.log(`Month leader: ${monthLeader.username} with transaction $${maxTransactionValue}, bonus: $${leaderBonus}`)
    }
    
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
    
    // Последние транзакции (только от сотрудников, только положительные результаты)
    const recentTransactions = transactions
      ?.filter(t => (t.gross_profit_usd || 0) > 0) // Показываем только положительные результаты
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) // Сортируем по времени
      .slice(0, 20) || []
    
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
          created_at: t.created_at,
          created_at_debug: {
            original: t.created_at,
            parsed: new Date(t.created_at).toISOString(),
            formatted: new Date(t.created_at).toLocaleString('ru-RU')
          }
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
