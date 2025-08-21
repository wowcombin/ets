import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { requireSimpleAuth } from '@/lib/simple-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const manager = await requireSimpleAuth()
    
    if (!manager.is_manager) {
      return NextResponse.json(
        { success: false, error: 'Доступ только для менеджеров' },
        { status: 403 }
      )
    }
    
    const { request_id, action, rejection_reason } = await request.json()
    
    if (!request_id || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: 'Неверные параметры запроса'
      }, { status: 400 })
    }
    
    if (action === 'reject' && !rejection_reason) {
      return NextResponse.json({
        success: false,
        error: 'Причина отклонения обязательна'
      }, { status: 400 })
    }
    
    const supabase = getServiceSupabase()
    
    // Получаем запрос
    const { data: changeRequest, error: fetchError } = await supabase
      .from('usdt_change_requests')
      .select('*, employee:employees(username)')
      .eq('id', request_id)
      .eq('status', 'pending')
      .single()
    
    if (fetchError || !changeRequest) {
      return NextResponse.json({
        success: false,
        error: 'Запрос не найден или уже обработан'
      }, { status: 404 })
    }
    
    if (action === 'approve') {
      // Одобряем запрос и обновляем адрес сотрудника
      const { error: updateEmployeeError } = await supabase
        .from('employees')
        .update({
          usdt_address: changeRequest.requested_address,
          usdt_network: changeRequest.requested_network,
          updated_at: new Date().toISOString()
        })
        .eq('id', changeRequest.employee_id)
      
      if (updateEmployeeError) throw updateEmployeeError
      
      // Обновляем статус запроса
      const { error: updateRequestError } = await supabase
        .from('usdt_change_requests')
        .update({
          status: 'approved',
          approved_by: manager.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', request_id)
      
      if (updateRequestError) throw updateRequestError
      
      return NextResponse.json({
        success: true,
        message: `USDT адрес для ${changeRequest.employee?.username} успешно обновлен`,
        data: {
          employee: changeRequest.employee?.username,
          new_address: changeRequest.requested_address,
          approved_by: manager.username
        }
      })
      
    } else {
      // Отклоняем запрос
      const { error: updateError } = await supabase
        .from('usdt_change_requests')
        .update({
          status: 'rejected',
          approved_by: manager.id,
          approved_at: new Date().toISOString(),
          rejection_reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', request_id)
      
      if (updateError) throw updateError
      
      return NextResponse.json({
        success: true,
        message: `Запрос на изменение адреса для ${changeRequest.employee?.username} отклонен`,
        data: {
          employee: changeRequest.employee?.username,
          rejection_reason,
          rejected_by: manager.username
        }
      })
    }
    
  } catch (error: any) {
    console.error('USDT request approval error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка обработки запроса' },
      { status: 500 }
    )
  }
}
