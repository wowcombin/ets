import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    // Получаем историю подозрительных изменений за последние 7 дней
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { data: suspiciousChanges, error } = await supabase
      .from('transaction_history')
      .select(`
        *,
        employee:employees(username),
        transaction:transactions(*)
      `)
      .eq('change_type', 'correction')
      .gte('changed_at', sevenDaysAgo.toISOString())
      .order('changed_at', { ascending: false })
      .limit(100)
    
    if (error) {
      throw error
    }
    
    // Группируем по сотрудникам
    const changesByEmployee: Record<string, any> = {}
    
    suspiciousChanges?.forEach(change => {
      const employeeName = change.employee?.username || 'Unknown'
      if (!changesByEmployee[employeeName]) {
        changesByEmployee[employeeName] = {
          username: employeeName,
          changes: [],
          totalOldProfit: 0,
          totalNewProfit: 0,
          totalDifference: 0
        }
      }
      
      const difference = (change.new_profit_usd || 0) - (change.old_profit_usd || 0)
      
      changesByEmployee[employeeName].changes.push({
        casino: change.casino_name,
        oldDeposit: change.old_deposit_usd,
        newDeposit: change.new_deposit_usd,
        oldWithdrawal: change.old_withdrawal_usd,
        newWithdrawal: change.new_withdrawal_usd,
        oldProfit: change.old_profit_usd,
        newProfit: change.new_profit_usd,
        difference,
        changedAt: change.changed_at
      })
      
      changesByEmployee[employeeName].totalOldProfit += change.old_profit_usd || 0
      changesByEmployee[employeeName].totalNewProfit += change.new_profit_usd || 0
      changesByEmployee[employeeName].totalDifference += difference
    })
    
    // Преобразуем в массив и сортируем по общей разнице
    const sortedEmployees = Object.values(changesByEmployee)
      .sort((a, b) => Math.abs(b.totalDifference) - Math.abs(a.totalDifference))
    
    return NextResponse.json({
      success: true,
      data: {
        totalChanges: suspiciousChanges?.length || 0,
        employeesWithChanges: sortedEmployees.length,
        changesByEmployee: sortedEmployees,
        summary: {
          totalOldProfit: sortedEmployees.reduce((sum, emp) => sum + emp.totalOldProfit, 0),
          totalNewProfit: sortedEmployees.reduce((sum, emp) => sum + emp.totalNewProfit, 0),
          totalDifference: sortedEmployees.reduce((sum, emp) => sum + emp.totalDifference, 0)
        }
      }
    })
    
  } catch (error: any) {
    console.error('Suspicious changes error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
