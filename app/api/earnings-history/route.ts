import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { requireSimpleAuth } from '@/lib/simple-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireSimpleAuth()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const supabase = getServiceSupabase()
    
    // Получаем все месяцы с транзакциями для пользователя
    const { data: months, error: monthsError } = await supabase
      .from('transactions')
      .select('month')
      .eq('employee_id', user.id)
      .order('month', { ascending: false })
    
    if (monthsError) {
      throw monthsError
    }
    
    // Уникальные месяцы
    const uniqueMonths = [...new Set(months?.map(m => m.month) || [])]
    
    const history = []
    
    for (const month of uniqueMonths) {
      // Получаем транзакции за месяц
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('*')
        .eq('employee_id', user.id)
        .eq('month', month)
      
      if (transError) {
        console.error(`Error loading transactions for ${month}:`, transError)
        continue
      }
      
      // Получаем информацию о зарплате
      const { data: salary, error: salaryError } = await supabase
        .from('salaries')
        .select('*')
        .eq('employee_id', user.id)
        .eq('month', month)
        .single()
      
      // Статистика по казино
      const casinoStats: Record<string, any> = {}
      let totalGross = 0
      let totalTransactions = 0
      
      transactions?.forEach(t => {
        const profit = t.gross_profit_usd || 0
        totalGross += profit
        totalTransactions++
        
        if (!casinoStats[t.casino_name]) {
          casinoStats[t.casino_name] = {
            name: t.casino_name,
            profit: 0,
            transactions: 0
          }
        }
        
        casinoStats[t.casino_name].profit += profit
        casinoStats[t.casino_name].transactions++
      })
      
      // Находим топ казино
      const topCasino = Object.values(casinoStats)
        .sort((a: any, b: any) => b.profit - a.profit)[0]
      
      // Считаем рабочие дни (дни с транзакциями)
      const workDays = new Set(
        transactions?.map(t => 
          new Date(t.created_at).toISOString().split('T')[0]
        ) || []
      ).size
      
      // Формируем данные месяца
      const monthData = {
        month,
        monthLabel: getMonthLabel(month),
        grossProfit: totalGross,
        netProfit: totalGross, // В будущем можно добавить вычет расходов
        salary: salary?.amount || calculateSalary(totalGross, user.profit_percentage || 10),
        bonus: salary?.bonus || (totalGross >= 2000 ? 200 : 0),
        leaderBonus: salary?.leader_bonus || 0,
        isPaid: salary?.is_paid || false,
        paidAt: salary?.paid_at,
        paymentHash: salary?.payment_hash,
        paymentNote: salary?.payment_note,
        transactionCount: totalTransactions,
        casinoCount: Object.keys(casinoStats).length,
        avgProfit: totalTransactions > 0 ? totalGross / totalTransactions : 0,
        workDays,
        topCasino,
        // Детальная статистика по казино
        details: {
          casinos: Object.values(casinoStats)
            .sort((a: any, b: any) => b.profit - a.profit)
            .map((c: any) => ({
              ...c,
              avgProfit: c.transactions > 0 ? c.profit / c.transactions : 0
            }))
        }
      }
      
      history.push(monthData)
    }
    
    return NextResponse.json({
      success: true,
      history
    })
    
  } catch (error: any) {
    console.error('Earnings history error:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

function getMonthLabel(monthCode: string): string {
  const [year, month] = monthCode.split('-')
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ]
  return `${months[parseInt(month) - 1]} ${year}`
}

function calculateSalary(grossProfit: number, profitPercentage: number): number {
  let salary = grossProfit * (profitPercentage / 100)
  
  // Бонус за выполнение плана
  if (grossProfit >= 2000) {
    salary += 200
  }
  
  return salary
}
