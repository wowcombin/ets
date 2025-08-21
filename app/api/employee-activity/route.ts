import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { requireSimpleAuth } from '@/lib/simple-auth'

export const dynamic = 'force-dynamic'

function getCurrentMonthCode(): string {
  const year = new Date().getFullYear()
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0')
  return `${year}-${month}`
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] // YYYY-MM-DD
}

export async function GET() {
  try {
    const user = await requireSimpleAuth()
    const supabase = getServiceSupabase()
    const currentMonth = getCurrentMonthCode()
    
    // Получаем всех активных сотрудников (не менеджеров)
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('is_manager', false)
      .eq('is_active', true)
    
    if (empError) throw empError
    
    // Получаем ВСЕ транзакции текущего месяца с пагинацией
    let allTransactions: any[] = []
    let from = 0
    const limit = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('transactions')
        .select('*, employee:employees(username)')
        .eq('month', currentMonth)
        .range(from, from + limit - 1)
        .order('created_at', { ascending: false })
      
      if (batchError) break
      
      if (batch && batch.length > 0) {
        allTransactions = [...allTransactions, ...batch]
        from += limit
        hasMore = batch.length === limit
      } else {
        hasMore = false
      }
    }
    
    // Анализируем активность каждого сотрудника
    const employeeActivity = employees?.map(emp => {
      const empTransactions = allTransactions.filter(t => t.employee_id === emp.id)
      
      // Фильтруем транзакции с ненулевыми депозитами или выводами
      const activeTransactions = empTransactions.filter(t => 
        (t.deposit_usd && t.deposit_usd > 0) || (t.withdrawal_usd && t.withdrawal_usd > 0)
      )
      
      // Находим последнюю активность (последний ненулевой депозит или вывод)
      const lastActivity = activeTransactions.length > 0 
        ? activeTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null
      
      // Группируем по дням для подсчета карт за день
      const dailyStats: Record<string, {
        date: string
        uniqueCards: Set<string>
        deposits: number
        withdrawals: number
        totalDeposit: number
        totalWithdrawal: number
        transactions: any[]
      }> = {}
      
      activeTransactions.forEach(t => {
        const date = formatDate(new Date(t.created_at))
        
        if (!dailyStats[date]) {
          dailyStats[date] = {
            date,
            uniqueCards: new Set(),
            deposits: 0,
            withdrawals: 0,
            totalDeposit: 0,
            totalWithdrawal: 0,
            transactions: []
          }
        }
        
        const dayStats = dailyStats[date]
        dayStats.transactions.push(t)
        
        if (t.card_number) {
          dayStats.uniqueCards.add(t.card_number)
        }
        
        if (t.deposit_usd && t.deposit_usd > 0) {
          dayStats.deposits++
          dayStats.totalDeposit += t.deposit_usd
        }
        
        if (t.withdrawal_usd && t.withdrawal_usd > 0) {
          dayStats.withdrawals++
          dayStats.totalWithdrawal += t.withdrawal_usd
        }
      })
      
      // Конвертируем Set в количество для каждого дня
      const dailyStatsArray = Object.values(dailyStats).map(day => ({
        ...day,
        uniqueCardsCount: day.uniqueCards.size,
        uniqueCards: Array.from(day.uniqueCards)
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      // Рассчитываем общую статистику
      const totalUniqueCards = new Set(activeTransactions.map(t => t.card_number).filter(Boolean)).size
      const totalWorkDays = dailyStatsArray.length
      const avgCardsPerDay = totalWorkDays > 0 ? totalUniqueCards / totalWorkDays : 0
      
      // Находим самый продуктивный день
      const bestDay = dailyStatsArray.reduce((best, current) => {
        return current.uniqueCardsCount > (best?.uniqueCardsCount || 0) ? current : best
      }, null as any)
      
      return {
        employee_id: emp.id,
        username: emp.username,
        lastActivity: lastActivity ? {
          time: lastActivity.created_at,
          type: (lastActivity.deposit_usd && lastActivity.deposit_usd > 0) ? 'deposit' : 'withdrawal',
          amount: (lastActivity.deposit_usd && lastActivity.deposit_usd > 0) ? lastActivity.deposit_usd : lastActivity.withdrawal_usd,
          casino: lastActivity.casino_name,
          card: lastActivity.card_number
        } : null,
        totalActiveTransactions: activeTransactions.length,
        totalUniqueCards: totalUniqueCards,
        totalWorkDays: totalWorkDays,
        avgCardsPerDay: Math.round(avgCardsPerDay * 10) / 10,
        bestDay: bestDay ? {
          date: bestDay.date,
          cardsUsed: bestDay.uniqueCardsCount,
          deposits: bestDay.deposits,
          withdrawals: bestDay.withdrawals
        } : null,
        dailyStats: dailyStatsArray.slice(0, 7), // Последние 7 дней
        monthlyTotals: {
          totalDeposits: activeTransactions.filter(t => t.deposit_usd > 0).length,
          totalWithdrawals: activeTransactions.filter(t => t.withdrawal_usd > 0).length,
          totalDepositAmount: activeTransactions.reduce((sum, t) => sum + (t.deposit_usd || 0), 0),
          totalWithdrawalAmount: activeTransactions.reduce((sum, t) => sum + (t.withdrawal_usd || 0), 0),
          grossProfit: activeTransactions.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0)
        }
      }
    }).sort((a, b) => {
      // Сортируем по последней активности (самые активные сверху)
      if (!a.lastActivity && !b.lastActivity) return 0
      if (!a.lastActivity) return 1
      if (!b.lastActivity) return -1
      return new Date(b.lastActivity.time).getTime() - new Date(a.lastActivity.time).getTime()
    }) || []
    
    return NextResponse.json({
      success: true,
      data: {
        month: currentMonth,
        totalEmployees: employees?.length || 0,
        activeEmployees: employeeActivity.filter(emp => emp.lastActivity !== null).length,
        employeeActivity,
        summary: {
          totalTransactions: allTransactions.length,
          activeTransactions: allTransactions.filter(t => 
            (t.deposit_usd && t.deposit_usd > 0) || (t.withdrawal_usd && t.withdrawal_usd > 0)
          ).length,
          totalUniqueCards: new Set(
            allTransactions
              .filter(t => (t.deposit_usd && t.deposit_usd > 0) || (t.withdrawal_usd && t.withdrawal_usd > 0))
              .map(t => t.card_number)
              .filter(Boolean)
          ).size
        }
      }
    })
    
  } catch (error: any) {
    console.error('Employee activity error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка получения статистики активности' },
      { status: 500 }
    )
  }
}
