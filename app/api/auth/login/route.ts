import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { verifyPassword, createSession } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Логин и пароль обязательны' },
        { status: 400 }
      )
    }
    
    // Нормализуем username - добавляем @ если его нет
    const normalizedUsername = username.startsWith('@') ? username : `@${username}`
    
    const supabase = getServiceSupabase()
    
    // Ищем пользователя
    const { data: employee, error } = await supabase
      .from('employees')
      .select('*')
      .eq('username', normalizedUsername)
      .single()
    
    if (error || !employee) {
      return NextResponse.json(
        { success: false, error: 'Неверный логин или пароль' },
        { status: 401 }
      )
    }
    
    // Проверяем что у пользователя есть пароль
    if (!employee.password_hash) {
      return NextResponse.json(
        { success: false, error: 'Пароль не создан. Используйте регистрацию для создания пароля.' },
        { status: 401 }
      )
    }
    
    // Проверяем что пользователь активен
    if (!employee.is_active || employee.username.includes('УВОЛЕН')) {
      return NextResponse.json(
        { success: false, error: 'Аккаунт деактивирован. Обратитесь к администратору.' },
        { status: 403 }
      )
    }
    
    // Проверяем пароль
    const isValidPassword = await verifyPassword(password, employee.password_hash)
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Неверный логин или пароль' },
        { status: 401 }
      )
    }
    
    // Создаем сессию
    const sessionToken = await createSession(employee.id)
    
    // Устанавливаем cookie
    const cookieStore = cookies()
    cookieStore.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 дней
    })
    
    return NextResponse.json({
      success: true,
      user: {
        id: employee.id,
        username: employee.username,
        is_manager: employee.is_manager,
        is_active: employee.is_active
      }
    })
    
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Внутренняя ошибка сервера',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}
