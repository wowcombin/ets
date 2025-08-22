import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    // Получаем текущий месяц
    const now = new Date()
    const year = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const monthCode = `${year}-${month}`
    
    console.log(`Verifying totals for month: ${monthCode}`)
    
    // Получаем все транзакции текущего месяца
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('month', monthCode)
    
    if (error) {
      throw error
    }
    
    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No transactions found',
        data: {
          monthCode,
          transactionCount: 0,
          totalGrossProfit: 0,
          calculatedGrossProfit: 0,
          employeeTotals: {}
        }
      })
    }
    
    // Считаем суммы
    let totalGrossProfit = 0
    let calculatedGrossProfit = 0
    const employeeTotals: Record<string, any> = {}
    
    for (const transaction of transactions) {
      // Суммируем из поля gross_profit_usd
      totalGrossProfit += transaction.gross_profit_usd || 0
      
      // Считаем вручную
      const deposit = transaction.deposit_usd || 0
      const withdrawal = transaction.withdrawal_usd || 0
      const profit = withdrawal - deposit
      calculatedGrossProfit += profit
      
      // Группируем по сотрудникам
      if (!employeeTotals[transaction.employee_id]) {
        employeeTotals[transaction.employee_id] = {
          transactionCount: 0,
          totalDeposit: 0,
          totalWithdrawal: 0,
          grossProfit: 0,
          calculatedProfit: 0,
          transactions: []
        }
      }
      
      employeeTotals[transaction.employee_id].transactionCount++
      employeeTotals[transaction.employee_id].totalDeposit += deposit
      employeeTotals[transaction.employee_id].totalWithdrawal += withdrawal
      employeeTotals[transaction.employee_id].grossProfit += transaction.gross_profit_usd || 0
      employeeTotals[transaction.employee_id].calculatedProfit += profit
      
      // Добавляем детали первых 5 транзакций для проверки
      if (employeeTotals[transaction.employee_id].transactions.length < 5) {
        employeeTotals[transaction.employee_id].transactions.push({
          casino: transaction.casino_name,
          deposit_gbp: transaction.deposit_gbp,
          withdrawal_gbp: transaction.withdrawal_gbp,
          deposit_usd: transaction.deposit_usd,
          withdrawal_usd: transaction.withdrawal_usd,
          gross_profit_usd: transaction.gross_profit_usd,
          calculated_profit: profit
        })
      }
    }
    
    // Получаем имена сотрудников
    const employeeIds = Object.keys(employeeTotals)
    const { data: employees } = await supabase
      .from('employees')
      .select('id, username')
      .in('id', employeeIds)
    
    const employeeMap = new Map(employees?.map(e => [e.id, e.username]) || [])
    
    // Добавляем имена к результатам
    const employeeResults = Object.entries(employeeTotals).map(([id, data]) => ({
      id,
      username: employeeMap.get(id) || 'Unknown',
      ...data
    }))
    
    // Сортируем по профиту
    employeeResults.sort((a, b) => b.calculatedProfit - a.calculatedProfit)
    
    return NextResponse.json({
      success: true,
      data: {
        monthCode,
        transactionCount: transactions.length,
        totalGrossProfit: Math.round(totalGrossProfit * 100) / 100,
        calculatedGrossProfit: Math.round(calculatedGrossProfit * 100) / 100,
        difference: Math.round((totalGrossProfit - calculatedGrossProfit) * 100) / 100,
        employeeTotals: employeeResults,
        sampleTransactions: transactions.slice(0, 10).map(t => ({
          employee_id: t.employee_id,
          casino: t.casino_name,
          deposit_gbp: t.deposit_gbp,
          withdrawal_gbp: t.withdrawal_gbp,
          deposit_usd: t.deposit_usd,
          withdrawal_usd: t.withdrawal_usd,
          gross_profit_usd: t.gross_profit_usd,
          net_profit_usd: t.net_profit_usd
        }))
      }
    })
    
  } catch (error: any) {
    console.error('Verify totals error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
