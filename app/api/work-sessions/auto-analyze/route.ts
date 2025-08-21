import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

function getCurrentMonthCode(): string {
  const year = new Date().getFullYear()
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0')
  return `${year}-${month}`
}

// Автоматический анализ рабочих сессий (вызывается после синхронизации)
export async function POST() {
  try {
    const supabase = getServiceSupabase()
    const currentMonth = getCurrentMonthCode()
    
    console.log(`Starting auto work sessions analysis for ${currentMonth}`)
    
    // Получаем все транзакции текущего месяца с пагинацией
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
        .order('created_at', { ascending: true }) // Сортируем по времени для правильного анализа
      
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
    
    console.log(`Fetched ${allTransactions.length} transactions for analysis`)
    
    // Фильтруем только транзакции сотрудников (не менеджеров)
    const employeeTransactions = allTransactions.filter(t => !t.employee?.is_manager)
    
    // Группируем по сотрудникам для анализа
    const employeeGroups: Record<string, any[]> = {}
    employeeTransactions.forEach(t => {
      if (!employeeGroups[t.employee_id]) {
        employeeGroups[t.employee_id] = []
      }
      employeeGroups[t.employee_id].push(t)
    })
    
    const workSessions: any[] = []
    
    // Анализируем каждого сотрудника
    Object.entries(employeeGroups).forEach(([employeeId, transactions]) => {
      // Группируем по картам
      const cardGroups: Record<string, any[]> = {}
      transactions.forEach(t => {
        if (t.card_number) {
          if (!cardGroups[t.card_number]) {
            cardGroups[t.card_number] = []
          }
          cardGroups[t.card_number].push(t)
        }
      })
      
      // Анализируем каждую карту для поиска пар депозит-вывод
      Object.entries(cardGroups).forEach(([cardNumber, cardTransactions]) => {
        cardTransactions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        
        let i = 0
        while (i < cardTransactions.length) {
          const transaction = cardTransactions[i]
          
          // Ищем депозит (deposit_usd > 0)
          if ((transaction.deposit_usd || 0) > 0) {
            const depositTime = new Date(transaction.created_at)
            
            // Ищем соответствующий вывод в следующих транзакциях той же карты
            let withdrawalTransaction = null
            for (let j = i + 1; j < cardTransactions.length; j++) {
              const nextTransaction = cardTransactions[j]
              if ((nextTransaction.withdrawal_usd || 0) > 0) {
                withdrawalTransaction = nextTransaction
                break
              }
            }
            
            if (withdrawalTransaction) {
              const withdrawalTime = new Date(withdrawalTransaction.created_at)
              const workDurationMs = withdrawalTime.getTime() - depositTime.getTime()
              const workDurationMinutes = Math.round(workDurationMs / (1000 * 60)) + 5 // +5 минут на регистрацию
              
              const grossProfit = (withdrawalTransaction.withdrawal_usd || 0) - (transaction.deposit_usd || 0)
              
              workSessions.push({
                employee_id: employeeId,
                casino_name: transaction.casino_name,
                card_number: cardNumber,
                deposit_amount: transaction.deposit_usd,
                withdrawal_amount: withdrawalTransaction.withdrawal_usd,
                deposit_time: depositTime.toISOString(),
                withdrawal_time: withdrawalTime.toISOString(),
                work_duration_minutes: Math.max(workDurationMinutes, 5), // Минимум 5 минут
                gross_profit: grossProfit,
                is_completed: true,
                month: currentMonth
              })
            } else {
              // Незавершенная сессия (только депозит)
              workSessions.push({
                employee_id: employeeId,
                casino_name: transaction.casino_name,
                card_number: cardNumber,
                deposit_amount: transaction.deposit_usd,
                withdrawal_amount: null,
                deposit_time: depositTime.toISOString(),
                withdrawal_time: null,
                work_duration_minutes: null,
                gross_profit: null,
                is_completed: false,
                month: currentMonth
              })
            }
          }
          i++
        }
      })
    })
    
    console.log(`Created ${workSessions.length} work sessions`)
    
    // Очищаем старые сессии и вставляем новые
    await supabase
      .from('work_sessions')
      .delete()
      .eq('month', currentMonth)
    
    if (workSessions.length > 0) {
      const { error: insertError } = await supabase
        .from('work_sessions')
        .insert(workSessions)
      
      if (insertError) {
        console.error('Error inserting work sessions:', insertError)
        throw insertError
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Автоматически проанализировано ${employeeTransactions.length} транзакций, создано ${workSessions.length} рабочих сессий`,
      data: {
        month: currentMonth,
        analyzedTransactions: employeeTransactions.length,
        createdSessions: workSessions.length,
        completedSessions: workSessions.filter(s => s.is_completed).length,
        incompleteSessions: workSessions.filter(s => !s.is_completed).length
      }
    })
    
  } catch (error: any) {
    console.error('Auto work sessions analysis error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка автоматического анализа' },
      { status: 500 }
    )
  }
}
