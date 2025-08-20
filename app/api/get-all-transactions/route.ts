// Создайте файл: /app/api/get-all-transactions/route.ts

import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    console.log(`Fetching ALL transactions for ${currentMonth}...`)
    
    // Получаем ВСЕ транзакции используя пагинацию
    let allTransactions: any[] = []
    let from = 0
    const limit = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: batch, error } = await supabase
        .from('transactions')
        .select('*, employee:employees(username, is_manager)')
        .eq('month', currentMonth)
        .range(from, from + limit - 1)
        .order('created_at', { ascending: true })
      
      if (error) {
        console.error(`Error fetching batch from ${from}:`, error)
        break
      }
      
      if (batch && batch.length > 0) {
        allTransactions = [...allTransactions, ...batch]
        console.log(`Fetched batch: ${from} to ${from + batch.length}`)
        from += limit
        hasMore = batch.length === limit
      } else {
        hasMore = false
      }
    }
    
    console.log(`Total transactions fetched: ${allTransactions.length}`)
    
    // Рассчитываем статистику
    let totalGross = 0
    let totalDeposits = 0
    let totalWithdrawals = 0
    const employeeStats: Record<string, any> = {}
    const casinoStats: Record<string, any> = {}
    const usedCards = new Set<string>()
    
    allTransactions.forEach(t => {
      // Общая статистика
      totalGross += parseFloat(t.gross_profit_usd) || 0
      totalDeposits += parseFloat(t.deposit_usd) || 0
      totalWithdrawals += parseFloat(t.withdrawal_usd) || 0
      
      // Карты
      if (t.card_number) {
        usedCards.add(t.card_number)
      }
      
      // По сотрудникам
      const username = t.employee?.username || 'Unknown'
      if (!employeeStats[username]) {
        employeeStats[username] = {
          count: 0,
          gross: 0,
          deposits: 0,
          withdrawals: 0
        }
      }
      employeeStats[username].count++
      employeeStats[username].gross += parseFloat(t.gross_profit_usd) || 0
      employeeStats[username].deposits += parseFloat(t.deposit_usd) || 0
      employeeStats[username].withdrawals += parseFloat(t.withdrawal_usd) || 0
      
      // По казино
      const casino = t.casino_name
      if (casino) {
        if (!casinoStats[casino]) {
          casinoStats[casino] = {
            count: 0,
            gross: 0,
            deposits: 0,
            withdrawals: 0
          }
        }
        casinoStats[casino].count++
        casinoStats[casino].gross += parseFloat(t.gross_profit_usd) || 0
        casinoStats[casino].deposits += parseFloat(t.deposit_usd) || 0
        casinoStats[casino].withdrawals += parseFloat(t.withdrawal_usd) || 0
      }
    })
    
    // Сортируем сотрудников по брутто
    const sortedEmployees = Object.entries(employeeStats)
      .map(([username, stats]) => ({
        username,
        ...stats,
        gross: Math.round(stats.gross * 100) / 100
      }))
      .sort((a, b) => b.gross - a.gross)
    
    return NextResponse.json({
      success: true,
      month: currentMonth,
      totalTransactions: allTransactions.length,
      stats: {
        totalGross: Math.round(totalGross * 100) / 100,
        totalDeposits: Math.round(totalDeposits * 100) / 100,
        totalWithdrawals: Math.round(totalWithdrawals * 100) / 100,
        uniqueEmployees: Object.keys(employeeStats).length,
        uniqueCasinos: Object.keys(casinoStats).length,
        uniqueCards: usedCards.size
      },
      topEmployees: sortedEmployees.slice(0, 10),
      employeeStats: sortedEmployees,
      transactions: allTransactions.slice(0, 10) // Первые 10 для примера
    })
    
  } catch (error: any) {
    console.error('Error fetching all transactions:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
