import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    // Получаем всех сотрудников
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id, username, is_active, is_manager, password_hash, created_password_at, last_login')
      .order('username')
    
    if (employeesError) {
      return NextResponse.json({
        success: false,
        error: 'Ошибка подключения к таблице employees',
        details: employeesError.message
      })
    }
    
    const stats = {
      total: employees?.length || 0,
      active: employees?.filter(e => e.is_active).length || 0,
      managers: employees?.filter(e => e.is_manager).length || 0,
      withPasswords: employees?.filter(e => e.password_hash).length || 0,
      recentLogins: employees?.filter(e => e.last_login).length || 0
    }
    
    return NextResponse.json({
      success: true,
      message: 'Сотрудники загружены успешно',
      stats,
      employees: employees?.map(e => ({
        username: e.username,
        is_active: e.is_active,
        is_manager: e.is_manager,
        has_password: !!e.password_hash,
        created_password_at: e.created_password_at,
        last_login: e.last_login
      }))
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Критическая ошибка',
      details: error.message
    })
  }
}