import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { requireAuth, validateUsdtAddress } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    
    const { usdt_address } = await request.json()
    
    // Валидируем USDT адрес если он указан
    if (usdt_address && !validateUsdtAddress(usdt_address)) {
      return NextResponse.json({
        success: false,
        error: 'Неверный формат USDT адреса. Должен начинаться с 0x и содержать 42 символа.'
      }, { status: 400 })
    }
    
    const supabase = getServiceSupabase()
    
    const { error } = await supabase
      .from('employees')
      .update({
        usdt_address: usdt_address || null,
        usdt_network: 'BEP20',
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
    
    if (error) {
      console.error('Error updating USDT address:', error)
      throw error
    }
    
    return NextResponse.json({
      success: true,
      message: 'USDT адрес успешно обновлен'
    })
    
  } catch (error: any) {
    if (error.message === 'Не авторизован') {
      return NextResponse.json({
        success: false,
        error: 'Не авторизован'
      }, { status: 401 })
    }
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
