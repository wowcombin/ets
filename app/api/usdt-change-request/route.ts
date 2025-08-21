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
    
    // Автоматически создаем таблицу если её нет
    try {
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS usdt_change_requests (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
              current_address VARCHAR(255),
              requested_address VARCHAR(255) NOT NULL,
              requested_network VARCHAR(50) DEFAULT 'BEP20',
              reason TEXT,
              status VARCHAR(20) DEFAULT 'pending',
              approved_by UUID REFERENCES employees(id),
              approved_at TIMESTAMP WITH TIME ZONE,
              rejection_reason TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
          );
          
          ALTER TABLE usdt_change_requests ENABLE ROW LEVEL SECURITY;
          
          CREATE POLICY IF NOT EXISTS "Enable read access for all users" ON usdt_change_requests FOR SELECT USING (true);
          CREATE POLICY IF NOT EXISTS "Enable insert for service role" ON usdt_change_requests FOR INSERT WITH CHECK (auth.role() = 'service_role');
          CREATE POLICY IF NOT EXISTS "Enable update for service role" ON usdt_change_requests FOR UPDATE USING (auth.role() = 'service_role');
          CREATE POLICY IF NOT EXISTS "Enable delete for service role" ON usdt_change_requests FOR DELETE USING (auth.role() = 'service_role');
        `
      })
      console.log('USDT change requests table created/verified')
    } catch (tableError) {
      console.error('Error creating USDT table:', tableError)
      // Продолжаем выполнение даже если создание таблицы не удалось
    }
    
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
