import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { requireManager, hashPassword, generatePassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const manager = await requireManager()
    
    const { username } = await request.json()
    
    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Логин обязателен' },
        { status: 400 }
      )
    }
    
    // Нормализуем username - добавляем @ если его нет
    const normalizedUsername = username.startsWith('@') ? username : `@${username}`
    
    const supabase = getServiceSupabase()
    
    // Ищем пользователя в базе
    const { data: employee, error } = await supabase
      .from('employees')
      .select('*')
      .eq('username', normalizedUsername)
      .single()
    
    if (error || !employee) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден в системе.' },
        { status: 404 }
      )
    }
    
    // Генерируем новый пароль
    const password = generatePassword()
    const passwordHash = await hashPassword(password)
    
    // Сохраняем пароль в базе (перезаписываем старый)
    const { error: updateError } = await supabase
      .from('employees')
      .update({
        password_hash: passwordHash,
        created_password_at: new Date().toISOString()
      })
      .eq('id', employee.id)
    
    if (updateError) {
      console.error('Error updating password:', updateError)
      return NextResponse.json(
        { success: false, error: 'Ошибка создания пароля' },
        { status: 500 }
      )
    }
    
    // Удаляем все активные сессии пользователя
    await supabase
      .from('sessions')
      .delete()
      .eq('employee_id', employee.id)
    
    return NextResponse.json({
      success: true,
      password: password,
      message: `Новый пароль создан для ${normalizedUsername}`,
      employee: {
        username: employee.username,
        is_active: employee.is_active
      }
    })
    
  } catch (error: any) {
    if (error.message === 'Не авторизован' || error.message === 'Доступ только для менеджеров') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.message === 'Не авторизован' ? 401 : 403 }
      )
    }
    
    console.error('Generate password error:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
