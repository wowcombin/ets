import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { requireManager } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const manager = await requireManager()
    
    const { salary_id, payment_hash, payment_note } = await request.json()
    
    if (!salary_id) {
      return NextResponse.json({
        success: false,
        error: 'ID зарплаты обязателен'
      }, { status: 400 })
    }
    
    const supabase = getServiceSupabase()
    
    // Проверяем существование зарплаты
    const { data: salary, error: fetchError } = await supabase
      .from('salaries')
      .select('*, employee:employees(username, usdt_address)')
      .eq('id', salary_id)
      .single()
    
    if (fetchError || !salary) {
      return NextResponse.json({
        success: false,
        error: 'Зарплата не найдена'
      }, { status: 404 })
    }
    
    if (salary.is_paid) {
      return NextResponse.json({
        success: false,
        error: 'Эта зарплата уже оплачена'
      }, { status: 400 })
    }
    
    // Обновляем статус оплаты
    const { error: updateError } = await supabase
      .from('salaries')
      .update({
        is_paid: true,
        paid_at: new Date().toISOString(),
        payment_hash: payment_hash || null,
        paid_by: manager.id,
        payment_note: payment_note || null
      })
      .eq('id', salary_id)
    
    if (updateError) {
      console.error('Error updating payment status:', updateError)
      throw updateError
    }
    
    return NextResponse.json({
      success: true,
      message: `Зарплата ${salary.employee.username} успешно отмечена как оплаченная`
    })
    
  } catch (error: any) {
    if (error.message === 'Не авторизован' || error.message === 'Доступ только для менеджеров') {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: error.message === 'Не авторизован' ? 401 : 403 })
    }
    
    console.error('Mark paid error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
