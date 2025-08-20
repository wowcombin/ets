import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = getServiceSupabase()
  const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
  
  // Считаем общее количество
  const { count } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('month', currentMonth)
  
  // Получаем сумму через агрегацию
  const { data: transactions } = await supabase
    .from('transactions')
    .select('gross_profit_usd')
    .eq('month', currentMonth)
  
  let totalGross = 0
  if (transactions) {
    // Если транзакций больше 1000, нужна пагинация
    let allGross = 0
    let from = 0
    const limit = 1000
    
    while (true) {
      const { data: batch } = await supabase
        .from('transactions')
        .select('gross_profit_usd')
        .eq('month', currentMonth)
        .range(from, from + limit - 1)
      
      if (!batch || batch.length === 0) break
      
      batch.forEach(t => {
        allGross += parseFloat(t.gross_profit_usd) || 0
      })
      
      if (batch.length < limit) break
      from += limit
    }
    
    totalGross = allGross
  }
  
  return NextResponse.json({
    month: currentMonth,
    totalTransactions: count,
    totalGross: Math.round(totalGross * 100) / 100,
    message: `База содержит ${count} транзакций на сумму $${totalGross.toFixed(2)}`
  })
}
