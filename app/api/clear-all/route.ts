import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    console.log('Starting complete database cleanup...')
    
    // Очищаем ВСЕ транзакции
    const { error: transError, count: transCount } = await supabase
      .from('transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Удаляем все записи
    
    if (transError) {
      console.error('Error clearing transactions:', transError)
    } else {
      console.log(`Deleted ${transCount || 'all'} transactions`)
    }
    
    // Очищаем ВСЕ расходы
    const { error: expError, count: expCount } = await supabase
      .from('expenses')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    
    if (expError) {
      console.error('Error clearing expenses:', expError)
    } else {
      console.log(`Deleted ${expCount || 'all'} expenses`)
    }
    
    // Очищаем ВСЕ зарплаты
    const { error: salError, count: salCount } = await supabase
      .from('salaries')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    
    if (salError) {
      console.error('Error clearing salaries:', salError)
    } else {
      console.log(`Deleted ${salCount || 'all'} salaries`)
    }
    
    // Очищаем ВСЕ карты
    const { error: cardError, count: cardCount } = await supabase
      .from('cards')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    
    if (cardError) {
      console.error('Error clearing cards:', cardError)
    } else {
      console.log(`Deleted ${cardCount || 'all'} cards`)
    }
    
    // НЕ удаляем сотрудников, только обновляем их статусы
    const { error: empUpdateError } = await supabase
      .from('employees')
      .update({ 
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    
    if (empUpdateError) {
      console.error('Error updating employees:', empUpdateError)
    }
    
    // Проверяем что осталось
    const { count: remainingTrans } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
    
    const { count: remainingExp } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
    
    const { count: remainingSal } = await supabase
      .from('salaries')
      .select('*', { count: 'exact', head: true })
    
    const { count: remainingCards } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
    
    return NextResponse.json({
      success: true,
      message: 'Database cleared successfully',
      deleted: {
        transactions: transCount || 'all',
        expenses: expCount || 'all',
        salaries: salCount || 'all',
        cards: cardCount || 'all'
      },
      remaining: {
        transactions: remainingTrans || 0,
        expenses: remainingExp || 0,
        salaries: remainingSal || 0,
        cards: remainingCards || 0
      }
    })
    
  } catch (error: any) {
    console.error('Clear all error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to clear database'
    }, { status: 500 })
  }
}
