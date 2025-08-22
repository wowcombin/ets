// app/api/clear-month/route.ts
import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

function getCurrentMonthCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  return `${year}-${month}`
}

export async function POST() {
  try {
    const supabase = getServiceSupabase()
    const monthCode = getCurrentMonthCode()
    
    console.log(`Clearing all data for month: ${monthCode}`)
    
    // Очищаем все данные для текущего месяца
    const { error: transError, count: transCount } = await supabase
      .from('transactions')
      .delete()
      .eq('month', monthCode)
    
    if (transError) {
      throw new Error(`Failed to clear transactions: ${transError.message}`)
    }
    
    const { error: expError, count: expCount } = await supabase
      .from('expenses')
      .delete()
      .eq('month', monthCode)
    
    if (expError) {
      throw new Error(`Failed to clear expenses: ${expError.message}`)
    }
    
    const { error: salError, count: salCount } = await supabase
      .from('salaries')
      .delete()
      .eq('month', monthCode)
    
    if (salError) {
      throw new Error(`Failed to clear salaries: ${salError.message}`)
    }
    
    console.log(`Cleared: ${transCount || 0} transactions, ${expCount || 0} expenses, ${salCount || 0} salaries`)
    
    return NextResponse.json({
      success: true,
      message: `Cleared all data for ${monthCode}`,
      stats: {
        monthCode,
        transactionsCleared: transCount || 0,
        expensesCleared: expCount || 0,
        salariesCleared: salCount || 0
      }
    })
    
  } catch (error: any) {
    console.error('Clear month error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    error: 'Method not allowed. Use POST to clear month data.'
  }, { status: 405 })
}
