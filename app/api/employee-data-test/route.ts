import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

// Временный публичный API для тестирования employee dashboard
export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    // Получаем активных сотрудников (не менеджеров, не уволенных, с WORK папкой)
    const { data: allEmployees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('is_manager', false)
    
    const employees = allEmployees?.filter(emp => {
      if (emp.username.includes('УВОЛЕН')) return false
      if (!emp.is_active) return false
      if (!emp.folder_id) return false
      return true
    }) || []
    
    if (empError) throw empError
    
    // Получаем транзакции ТОЛЬКО сотрудников для лидерборда
    const employeeIds = employees?.map(e => e.id) || []
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
        from += limit
        hasMore = batch.length === limit
      } else {
        hasMore = false
      }
    }
    
    // Получаем ВСЕ транзакции для общей статистики (включая менеджеров)
    let allTransactions: any[] = []
    let totalFrom = 0
    let totalHasMore = true
    
    while (totalHasMore) {
      const { data: totalBatch, error: totalBatchError } = await supabase
        .from('transactions')
        .select('*, employee:employees(username, is_manager)')
        .eq('month', currentMonth)
        .range(totalFrom, totalFrom + limit - 1)
        .order('created_at', { ascending: false })
      
      if (totalBatchError) {
        console.error(`Error fetching total batch from ${totalFrom}:`, totalBatchError)
        break
      }
      
      if (totalBatch && totalBatch.length > 0) {
        allTransactions = [...allTransactions, ...totalBatch]
        totalFrom += limit
        totalHasMore = totalBatch.length === limit
      } else {
        totalHasMore = false
      }
    }
    
    const totalGross = allTransactions?.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) || 0
    
    // Статистика по сотрудникам
    const employeeStats = employees?.map(emp => {
      const empTransactions = employeeTransactions?.filter(t => t.employee_id === emp.id) || []
      const totalEmpGross = empTransactions.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0)
      const transactionCount = empTransactions.length
      const casinoCount = new Set(empTransactions.map(t => t.casino_name)).size
      
      const baseSalary = totalEmpGross * 0.1
      const bonus = totalEmpGross >= 2000 ? 200 : 0
      const maxTransaction = Math.max(...empTransactions.map(t => t.gross_profit_usd || 0))
      
      return {
        id: emp.id,
        username: emp.username,
        totalGross: totalEmpGross,
        transactionCount,
        casinoCount,
        salary: {
          base_salary: baseSalary,
          bonus: bonus,
          leader_bonus: 0,
          total_salary: baseSalary + bonus,
          is_paid: false,
          max_transaction: maxTransaction
        },
        rank: 0
      }
    }) || []
    
    // Сортируем и устанавливаем ранги
    employeeStats.sort((a, b) => (b.salary?.total_salary || 0) - (a.salary?.total_salary || 0))
    employeeStats.forEach((emp, index) => {
      emp.rank = index + 1
    })
    
    // Определяем лидера месяца
    let monthLeader: any = null
    let maxTransactionValue = 0
    
    employeeStats.forEach(emp => {
      const empMaxTransaction = emp.salary?.max_transaction || 0
      if (empMaxTransaction > maxTransactionValue) {
        maxTransactionValue = empMaxTransaction
        monthLeader = emp
      }
    })
    
    if (monthLeader && maxTransactionValue > 0) {
      const leaderBonus = maxTransactionValue * 0.1
      if (monthLeader.salary) {
        monthLeader.salary.leader_bonus = leaderBonus
        monthLeader.salary.total_salary = (monthLeader.salary.base_salary || 0) + (monthLeader.salary.bonus || 0) + leaderBonus
        monthLeader.is_month_leader = true
      }
    }
    
    // Статистика по казино
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
    
    // Последние обновления
    const recentUpdates = allTransactions
      ?.filter(t => {
        const hasDeposit = (t.deposit_usd || 0) > 0
        const hasWithdrawal = (t.withdrawal_usd || 0) > 0
        return hasDeposit || hasWithdrawal
      })
      .sort((a, b) => {
        const timeA = new Date(a.sync_timestamp || a.created_at).getTime()
        const timeB = new Date(b.sync_timestamp || b.created_at).getTime()
        return timeB - timeA
      })
      .slice(0, 20)
      .map(t => {
        const deposit = t.deposit_usd || 0
        const withdrawal = t.withdrawal_usd || 0
        const profit = withdrawal - deposit
        
        return {
          id: t.id,
          employee: t.employee?.username,
          casino_name: t.casino_name,
          deposit_usd: t.deposit_usd,
          withdrawal_usd: t.withdrawal_usd,
          raw_profit: profit,
          calculated_profit: profit,
          has_deposit: deposit > 0,
          has_withdrawal: withdrawal > 0,
          card_number: t.card_number,
          created_at: t.created_at,
          sync_timestamp: t.sync_timestamp,
          update_type: deposit > 0 && withdrawal > 0 ? 'complete' : deposit > 0 ? 'deposit' : 'withdrawal'
        }
      }) || []
    
    return NextResponse.json({
      success: true,
      data: {
        month: currentMonth,
        user: {
          id: 'test-user',
          username: '@test',
          is_manager: false,
          stats: employeeStats[0] || null // Возвращаем первого для тестирования
        },
        stats: {
          totalGross,
          employeeCount: employees?.length || 0,
          transactionCount: allTransactions?.length || 0,
          casinoCount: sortedCasinos.length
        },
        leaderboard: employeeStats,
        casinoStats: sortedCasinos,
        recentUpdates,
        lastUpdated: new Date().toISOString(),
        debug: {
          totalEmployees: employees?.length,
          totalTransactions: allTransactions?.length,
          employeeTransactions: employeeTransactions?.length
        }
      }
    })
    
  } catch (error: any) {
    console.error('Employee data test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Ошибка загрузки данных: ' + error.message
    }, { status: 500 })
  }
}
