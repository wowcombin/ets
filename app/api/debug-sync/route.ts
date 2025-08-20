// Создайте файл: /app/api/debug-sync/route.ts

import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    // Получаем все транзакции за текущий месяц
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*, employee:employees(username)')
      .eq('month', currentMonth)
      .order('gross_profit_usd', { ascending: false })
    
    if (error) {
      throw error
    }
    
    // Группируем по сотрудникам
    const byEmployee: Record<string, any> = {}
    let totalGross = 0
    let totalTransactions = 0
    
    transactions?.forEach(t => {
      const username = t.employee?.username || 'Unknown'
      
      if (!byEmployee[username]) {
        byEmployee[username] = {
          count: 0,
          gross: 0,
          deposits: 0,
          withdrawals: 0,
          transactions: []
        }
      }
      
      byEmployee[username].count++
      byEmployee[username].gross += t.gross_profit_usd || 0
      byEmployee[username].deposits += t.deposit_usd || 0
      byEmployee[username].withdrawals += t.withdrawal_usd || 0
      
      // Добавляем первые 5 транзакций для примера
      if (byEmployee[username].transactions.length < 5) {
        byEmployee[username].transactions.push({
          casino: t.casino_name,
          deposit: t.deposit_usd,
          withdrawal: t.withdrawal_usd,
          gross: t.gross_profit_usd,
          card: t.card_number
        })
      }
      
      totalGross += t.gross_profit_usd || 0
      totalTransactions++
    })
    
    // Сортируем по брутто
    const sortedEmployees = Object.entries(byEmployee)
      .sort(([, a], [, b]) => b.gross - a.gross)
      .map(([username, data]) => ({
        username,
        ...data,
        gross: Math.round(data.gross * 100) / 100,
        deposits: Math.round(data.deposits * 100) / 100,
        withdrawals: Math.round(data.withdrawals * 100) / 100
      }))
    
    // Получаем расходы
    const { data: expenses } = await supabase
      .from('expenses')
      .select('*')
      .eq('month', currentMonth)
    
    const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_usd || 0), 0) || 0
    
    // Получаем карты
    const { data: cards } = await supabase
      .from('cards')
      .select('status')
    
    const cardStats = {
      total: cards?.length || 0,
      available: cards?.filter(c => c.status === 'available').length || 0,
      assigned: cards?.filter(c => c.status === 'assigned').length || 0,
      used: cards?.filter(c => c.status === 'used').length || 0
    }
    
    // Проверяем использованные карты в транзакциях
    const usedCardNumbers = new Set()
    transactions?.forEach(t => {
      if (t.card_number) {
        usedCardNumbers.add(t.card_number)
      }
    })
    
    return NextResponse.json({
      success: true,
      month: currentMonth,
      summary: {
        totalGross: Math.round(totalGross * 100) / 100,
        totalNet: Math.round((totalGross - totalExpenses) * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        totalTransactions,
        employeesWithTransactions: sortedEmployees.length,
        uniqueCardsUsed: usedCardNumbers.size
      },
      cardStats,
      topEmployees: sortedEmployees.slice(0, 10),
      allEmployees: sortedEmployees,
      errors: [],
      debug: {
        transactionCount: transactions?.length || 0,
        expenseCount: expenses?.length || 0,
        cardCount: cards?.length || 0
      }
    })
    
  } catch (error: any) {
    console.error('Debug sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error
    }, { status: 500 })
  }
}
