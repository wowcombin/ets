import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    // Проверяем структуру таблицы employees
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('*')
      .limit(3)
    
    if (employeesError) {
      return NextResponse.json({
        success: false,
        error: 'Ошибка employees table',
        details: employeesError
      })
    }
    
    // Проверяем существование таблицы sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .limit(1)
    
    const sessionsExists = !sessionsError
    
    // Проверяем какие поля есть в employees
    const employeeFields = employees && employees.length > 0 ? Object.keys(employees[0]) : []
    
    return NextResponse.json({
      success: true,
      database_status: {
        employees_table: !!employees,
        employees_count: employees?.length || 0,
        employees_fields: employeeFields,
        sessions_table_exists: sessionsExists,
        sessions_error: sessionsError?.message || null,
        sample_employee: employees?.[0] ? {
          username: employees[0].username,
          has_password_hash: !!employees[0].password_hash,
          is_active: employees[0].is_active,
          fields_present: {
            password_hash: 'password_hash' in employees[0],
            usdt_address: 'usdt_address' in employees[0],
            is_active: 'is_active' in employees[0],
            last_login: 'last_login' in employees[0]
          }
        } : null
      }
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Critical error',
      details: error.message
    })
  }
}
