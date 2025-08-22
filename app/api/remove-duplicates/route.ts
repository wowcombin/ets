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
    
    console.log(`Removing duplicates for month: ${monthCode}`)
    
    // Получаем все транзакции текущего месяца
    const { data: allTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('month', monthCode)
      .order('created_at', { ascending: true })
    
    if (fetchError) {
      throw fetchError
    }
    
    if (!allTransactions || allTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No transactions found',
        stats: {
          totalTransactions: 0,
          duplicatesRemoved: 0,
          uniqueTransactions: 0
        }
      })
    }
    
    // Находим дубликаты
    const seen = new Map<string, any>()
    const duplicateIds = []
    
    for (const transaction of allTransactions) {
      // Создаем уникальный ключ (без card_number и id)
      const key = `${transaction.employee_id}_${transaction.month}_${transaction.casino_name}_${transaction.deposit_usd}_${transaction.withdrawal_usd}`
      
      if (seen.has(key)) {
        // Это дубликат - добавляем в список для удаления
        duplicateIds.push(transaction.id)
      } else {
        // Первая встреча - сохраняем
        seen.set(key, transaction)
      }
    }
    
    // Удаляем дубликаты
    if (duplicateIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .in('id', duplicateIds)
      
      if (deleteError) {
        throw deleteError
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Удалено ${duplicateIds.length} дубликатов`,
      stats: {
        monthCode,
        totalTransactions: allTransactions.length,
        duplicatesRemoved: duplicateIds.length,
        uniqueTransactions: seen.size
      }
    })
    
  } catch (error: any) {
    console.error('Remove duplicates error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
