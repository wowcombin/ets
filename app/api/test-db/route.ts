import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    // Проверяем подключение к базе
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id, username, is_active, password_hash')
      .limit(1)
    
    if (employeesError) {
      return NextResponse.json({
        success: false,
        error: 'Ошибка подключения к таблице employees',
        details: employeesError.message
      })
    }
    
    // Проверяем существование таблицы sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id')
      .limit(1)
    
    if (sessionsError) {
      return NextResponse.json({
        success: false,
        error: 'Таблица sessions не найдена - нужно обновить базу данных',
        details: sessionsError.message,
        solution: 'Выполните SQL скрипт из lib/supabase/schema.sql'
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'База данных работает корректно',
      employees_count: employees?.length || 0,
      tables_checked: ['employees', 'sessions']
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Критическая ошибка',
      details: error.message
    })
  }
}
