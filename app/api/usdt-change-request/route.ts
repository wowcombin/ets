import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { requireSimpleAuth } from '@/lib/simple-auth'
import { validateUsdtAddress } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Создать запрос на изменение USDT адреса
export async function POST(request: Request) {
  try {
    const user = await requireSimpleAuth()
    
    const { requested_address, reason } = await request.json()
    
    if (!requested_address) {
      return NextResponse.json({
        success: false,
        error: 'USDT адрес обязателен'
      }, { status: 400 })
    }
    
    // Валидируем новый адрес
    if (!validateUsdtAddress(requested_address)) {
      return NextResponse.json({
        success: false,
        error: 'Неверный формат USDT адреса. Должен начинаться с 0x и содержать 42 символа.'
      }, { status: 400 })
    }
    
    const supabase = getServiceSupabase()
    
    // Проверяем, есть ли уже активный запрос
    const { data: existingRequest, error: checkError } = await supabase
      .from('usdt_change_requests')
      .select('*')
      .eq('employee_id', user.id)
      .eq('status', 'pending')
      .single()
    
    if (existingRequest) {
      return NextResponse.json({
        success: false,
        error: 'У вас уже есть активный запрос на изменение адреса. Дождитесь рассмотрения.'
      }, { status: 400 })
    }
    
    // Создаем новый запрос
    const { data: newRequest, error: insertError } = await supabase
      .from('usdt_change_requests')
      .insert({
        employee_id: user.id,
        current_address: user.usdt_address,
        requested_address,
        reason: reason || 'Изменение адреса кошелька',
        status: 'pending'
      })
      .select()
      .single()
    
    if (insertError) throw insertError
    
    return NextResponse.json({
      success: true,
      message: 'Запрос на изменение USDT адреса отправлен менеджерам',
      data: {
        request_id: newRequest.id,
        current_address: user.usdt_address,
        requested_address,
        status: 'pending'
      }
    })
    
  } catch (error: any) {
    console.error('USDT change request error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка создания запроса' },
      { status: 500 }
    )
  }
}

// Получить запросы на изменение (для менеджеров)
export async function GET() {
  try {
    const user = await requireSimpleAuth()
    
    if (!user.is_manager) {
      return NextResponse.json(
        { success: false, error: 'Доступ только для менеджеров' },
        { status: 403 }
      )
    }
    
    const supabase = getServiceSupabase()
    
    // Получаем все запросы
    const { data: requests, error } = await supabase
      .from('usdt_change_requests')
      .select('*, employee:employees(username, usdt_address), approved_by_user:employees!usdt_change_requests_approved_by_fkey(username)')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return NextResponse.json({
      success: true,
      data: {
        requests: requests?.map(req => ({
          id: req.id,
          employee: {
            id: req.employee_id,
            username: req.employee?.username,
            current_address: req.employee?.usdt_address
          },
          current_address: req.current_address,
          requested_address: req.requested_address,
          requested_network: req.requested_network,
          reason: req.reason,
          status: req.status,
          approved_by: req.approved_by_user?.username,
          approved_at: req.approved_at,
          rejection_reason: req.rejection_reason,
          created_at: req.created_at
        })) || [],
        summary: {
          total: requests?.length || 0,
          pending: requests?.filter(r => r.status === 'pending').length || 0,
          approved: requests?.filter(r => r.status === 'approved').length || 0,
          rejected: requests?.filter(r => r.status === 'rejected').length || 0
        }
      }
    })
    
  } catch (error: any) {
    console.error('USDT requests get error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка получения запросов' },
      { status: 500 }
    )
  }
}
