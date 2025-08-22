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
    console.log('Fetching employee transactions with pagination...')
    let employeeTransactions: any[] = []
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
        employeeTransactions = [...employeeTransactions, ...batch]
        console.log(`Employee batch: ${from} to ${from + batch.length - 1}, total so far: ${employeeTransactions.length}`)
        from += limit
        hasMore = batch.length === limit
      } else {
        hasMore = false
      }
    }
    
    const transactions = employeeTransactions
    console.log(`Total employee transactions fetched: ${transactions.length}`)
    
    // Получаем зарплаты только сотрудников
    const { data: salaries, error: salError } = await supabase
      .from('salaries')
      .select('*, employee:employees(username, is_manager)')
      .eq('month', currentMonth)
      .in('employee_id', employeeIds)
      .order('total_salary', { ascending: false })
    
    if (salError) throw salError
    
    // Получаем ВСЕ транзакции для общей статистики (включая менеджеров)
    console.log('Fetching ALL transactions for global statistics...')
    let allTransactions: any[] = []
    let totalFrom = 0
    const totalLimit = 1000
    let totalHasMore = true
    
    while (totalHasMore) {
      const { data: totalBatch, error: totalBatchError } = await supabase
        .from('transactions')
        .select('*, employee:employees(username, is_manager)')
        .eq('month', currentMonth)
        .range(totalFrom, totalFrom + totalLimit - 1)
        .order('created_at', { ascending: false })
      
      if (totalBatchError) {
        console.error(`Error fetching total batch from ${totalFrom}:`, totalBatchError)
        break
      }
      
      if (totalBatch && totalBatch.length > 0) {
        allTransactions = [...allTransactions, ...totalBatch]
        totalFrom += totalLimit
        totalHasMore = totalBatch.length === totalLimit
      } else {
        totalHasMore = false
      }
    }
    
    // Рассчитываем ОБЩУЮ статистику от ВСЕХ (включая менеджеров)
    const totalGross = allTransactions?.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) || 0
    console.log(`Total gross from ALL: $${totalGross.toFixed(2)} (${allTransactions.length} transactions)`)
    
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
      const leaderBonus = maxTransactionValue * 0.1 // 10% от самой большой транзакции
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
    
    // Статистика по казино (от ВСЕХ включая менеджеров)
    const casinoStats: Record<string, any> = {}
    allTransactions?.forEach(t => {
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
    
    // Последние обновления от ВСЕХ (включая менеджеров)
    const recentUpdates = allTransactions
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
        // Рассчитываем по формуле (вывод - депозит) * 1.3
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
          transactionCount: allTransactions?.length || 0, // Общее количество транзакций от ВСЕХ
          casinoCount: sortedCasinos.length
        },
        leaderboard: employeeStats,
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
