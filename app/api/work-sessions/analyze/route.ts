import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { requireSimpleAuth } from '@/lib/simple-auth'

export const dynamic = 'force-dynamic'

function getCurrentMonthCode(): string {
  const year = new Date().getFullYear()
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0')
  return `${year}-${month}`
}

// Функция для определения рабочих сессий из транзакций
function analyzeWorkSessions(transactions: any[]): any[] {
  const sessions: any[] = []
  
  // Группируем транзакции по сотруднику и карте
  const groupedByEmployeeAndCard: Record<string, any[]> = {}
  
  transactions.forEach(transaction => {
    const key = `${transaction.employee_id}_${transaction.card_number}`
    if (!groupedByEmployeeAndCard[key]) {
      groupedByEmployeeAndCard[key] = []
    }
    groupedByEmployeeAndCard[key].push(transaction)
  })
  
  // Анализируем каждую группу для поиска пар депозит-вывод
  Object.values(groupedByEmployeeAndCard).forEach(cardTransactions => {
    if (cardTransactions.length < 2) return // Нужен минимум депозит и вывод
    
    // Сортируем по времени создания
    cardTransactions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    
    let i = 0
    while (i < cardTransactions.length - 1) {
      const deposit = cardTransactions[i]
      
      // Ищем депозит (deposit_usd > 0 и withdrawal_usd = 0)
      if ((deposit.deposit_usd || 0) > 0 && (deposit.withdrawal_usd || 0) === 0) {
        
        // Ищем соответствующий вывод
        for (let j = i + 1; j < cardTransactions.length; j++) {
          const withdrawal = cardTransactions[j]
          
          // Проверяем что это вывод (withdrawal_usd > 0)
          if ((withdrawal.withdrawal_usd || 0) > 0) {
            const depositTime = new Date(deposit.created_at)
            const withdrawalTime = new Date(withdrawal.created_at)
            
            // Рассчитываем время работы (от депозита до вывода + 5 минут на регистрацию)
            const workDurationMs = withdrawalTime.getTime() - depositTime.getTime()
            const workDurationMinutes = Math.round(workDurationMs / (1000 * 60)) + 5 // +5 минут на регистрацию
            
            const grossProfit = (withdrawal.withdrawal_usd || 0) - (deposit.deposit_usd || 0)
            
            sessions.push({
              employee_id: deposit.employee_id,
              employee_username: deposit.employee?.username,
              casino_name: deposit.casino_name,
              card_number: deposit.card_number,
              deposit_amount: deposit.deposit_usd,
              withdrawal_amount: withdrawal.withdrawal_usd,
              deposit_time: depositTime,
              withdrawal_time: withdrawalTime,
              work_duration_minutes: workDurationMinutes,
              gross_profit: grossProfit,
              is_completed: true,
              month: getCurrentMonthCode()
            })
            
            i = j // Переходим к следующей транзакции после найденного вывода
            break
          }
        }
      }
      i++
    }
  })
  
  return sessions
}

export async function POST() {
  try {
    const user = await requireSimpleAuth()
    
    if (!user.is_manager) {
      return NextResponse.json(
        { success: false, error: 'Доступ только для менеджеров' },
        { status: 403 }
      )
    }
    
    const supabase = getServiceSupabase()
    const currentMonth = getCurrentMonthCode()
    
    // Получаем все транзакции текущего месяца
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('*, employee:employees(username)')
      .eq('month', currentMonth)
      .order('created_at', { ascending: true })
    
    if (transError) throw transError
    
    // Анализируем транзакции для создания рабочих сессий
    const workSessions = analyzeWorkSessions(transactions || [])
    
    // Очищаем существующие сессии для текущего месяца
    await supabase
      .from('work_sessions')
      .delete()
      .eq('month', currentMonth)
    
    // Вставляем новые рабочие сессии
    if (workSessions.length > 0) {
      const { error: insertError } = await supabase
        .from('work_sessions')
        .insert(workSessions)
      
      if (insertError) throw insertError
    }
    
    return NextResponse.json({
      success: true,
      message: `Проанализировано и создано ${workSessions.length} рабочих сессий`,
      data: {
        analyzedTransactions: transactions?.length || 0,
        createdSessions: workSessions.length,
        month: currentMonth
      }
    })
    
  } catch (error: any) {
    console.error('Work sessions analysis error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка анализа рабочих сессий' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const user = await requireSimpleAuth()
    const supabase = getServiceSupabase()
    const currentMonth = getCurrentMonthCode()
    
    // Получаем статистику рабочих сессий
    const { data: workSessions, error } = await supabase
      .from('work_sessions')
      .select('*, employee:employees(username, is_manager)')
      .eq('month', currentMonth)
      .order('deposit_time', { ascending: false })
    
    if (error) throw error
    
    // Группируем статистику по сотрудникам
    const employeeStats: Record<string, any> = {}
    
    workSessions?.forEach(session => {
      const username = session.employee?.username
      if (!username) return
      
      if (!employeeStats[username]) {
        employeeStats[username] = {
          username,
          totalSessions: 0,
          completedSessions: 0,
          totalWorkTime: 0,
          totalProfit: 0,
          averageSessionTime: 0,
          averageProfit: 0,
          casinosWorked: new Set(),
          firstWorkTime: null,
          lastWorkTime: null,
          activeDays: new Set()
        }
      }
      
      const stats = employeeStats[username]
      stats.totalSessions++
      
      if (session.is_completed) {
        stats.completedSessions++
        stats.totalWorkTime += session.work_duration_minutes || 0
        stats.totalProfit += session.gross_profit || 0
        stats.casinosWorked.add(session.casino_name)
        
        const sessionDate = new Date(session.deposit_time).toDateString()
        stats.activeDays.add(sessionDate)
        
        if (!stats.firstWorkTime || new Date(session.deposit_time) < new Date(stats.firstWorkTime)) {
          stats.firstWorkTime = session.deposit_time
        }
        
        if (!stats.lastWorkTime || new Date(session.deposit_time) > new Date(stats.lastWorkTime)) {
          stats.lastWorkTime = session.deposit_time
        }
      }
    })
    
    // Рассчитываем средние значения
    Object.values(employeeStats).forEach((stats: any) => {
      if (stats.completedSessions > 0) {
        stats.averageSessionTime = Math.round(stats.totalWorkTime / stats.completedSessions)
        stats.averageProfit = stats.totalProfit / stats.completedSessions
      }
      stats.casinosWorked = Array.from(stats.casinosWorked)
      stats.activeDaysCount = stats.activeDays.size
      stats.activeDays = Array.from(stats.activeDays)
    })
    
    const sortedStats = Object.values(employeeStats)
      .sort((a: any, b: any) => b.totalWorkTime - a.totalWorkTime)
    
    return NextResponse.json({
      success: true,
      data: {
        month: currentMonth,
        totalSessions: workSessions?.length || 0,
        employeeStats: sortedStats,
        recentSessions: workSessions?.slice(0, 20) || []
      }
    })
    
  } catch (error: any) {
    console.error('Work sessions stats error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка получения статистики' },
      { status: 500 }
    )
  }
}
