import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { performSync } from '../sync-all/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    // Получаем текущий месяц
    const now = new Date()
    const year = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const monthCode = `${year}-${month}`
    
    console.log(`Clearing all transactions for month: ${monthCode}`)
    
    // Удаляем все транзакции текущего месяца
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('month', monthCode)
    
    if (deleteError) {
      throw deleteError
    }
    
    console.log('All transactions cleared, starting resync...')
    
    // Вызываем функцию синхронизации напрямую
    const syncResponse = await performSync()
    
    // Извлекаем JSON данные из NextResponse
    const syncResult = await syncResponse.json()
    
    return NextResponse.json({
      success: true,
      message: 'Данные очищены и синхронизированы заново',
      monthCode,
      syncResult
    })
    
  } catch (error: any) {
    console.error('Clear and resync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
