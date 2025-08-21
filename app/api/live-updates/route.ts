import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

// Получение реально последних обновлений на основе изменений данных
export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    // Получаем активных сотрудников
    const { data: allEmployees } = await supabase
      .from('employees')
      .select('*')
      .eq('is_manager', false)
    
    const employees = allEmployees?.filter(emp => {
      return !emp.username.includes('УВОЛЕН') && emp.is_active && emp.folder_id
    }) || []
    
    const employeeIds = employees.map(e => e.id)
    
    // Получаем ВСЕ транзакции для анализа
    let allTransactions: any[] = []
    let from = 0
    const limit = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: batch } = await supabase
        .from('transactions')
        .select('*, employee:employees(username)')
        .eq('month', currentMonth)
        .in('employee_id', employeeIds)
        .range(from, from + limit - 1)
        .order('updated_at', { ascending: false }) // Сортируем по времени обновления
      
      if (batch && batch.length > 0) {
        allTransactions = [...allTransactions, ...batch]
        from += limit
        hasMore = batch.length === limit
      } else {
        hasMore = false
      }
    }
    
    // Группируем транзакции по сотрудникам и находим последние изменения
    const employeeLastUpdates = new Map()
    
    allTransactions.forEach(t => {
      const empId = t.employee_id
      const updateTime = new Date(t.updated_at).getTime()
      
      if (!employeeLastUpdates.has(empId) || 
          employeeLastUpdates.get(empId).updateTime < updateTime) {
        
        // Проверяем что есть реальные данные (не нули)
        const hasData = (t.deposit_usd && t.deposit_usd > 0) || 
                       (t.withdrawal_usd && t.withdrawal_usd > 0)
        
        if (hasData) {
          employeeLastUpdates.set(empId, {
            ...t,
            updateTime,
            calculated_profit: ((t.withdrawal_usd || 0) - (t.deposit_usd || 0)) * 1.3,
            raw_profit: (t.withdrawal_usd || 0) - (t.deposit_usd || 0),
            has_deposit: (t.deposit_usd || 0) > 0,
            has_withdrawal: (t.withdrawal_usd || 0) > 0
          })
        }
      }
    })
    
    // Преобразуем в массив и сортируем по времени обновления
    const liveUpdates = Array.from(employeeLastUpdates.values())
      .sort((a, b) => b.updateTime - a.updateTime)
      .slice(0, 20)
      .map(update => ({
        id: update.id,
        employee: update.employee?.username,
        casino_name: update.casino_name,
        card_number: update.card_number,
        deposit_usd: update.deposit_usd,
        withdrawal_usd: update.withdrawal_usd,
        raw_profit: update.raw_profit,
        calculated_profit: update.calculated_profit,
        has_deposit: update.has_deposit,
        has_withdrawal: update.has_withdrawal,
        updated_at: update.updated_at,
        is_recent: (Date.now() - update.updateTime) < 3600000, // Последний час
        minutes_ago: Math.round((Date.now() - update.updateTime) / (1000 * 60))
      }))
    
    return NextResponse.json({
      success: true,
      data: {
        liveUpdates,
        totalEmployeesChecked: employees.length,
        updatesFound: liveUpdates.length,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error: any) {
    console.error('Live updates error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Ошибка получения живых обновлений'
    }, { status: 500 })
  }
}
