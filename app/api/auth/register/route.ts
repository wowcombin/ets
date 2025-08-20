// app/api/auth/register/route.ts
import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

export async function POST(request: Request) {
  try {
    const { username } = await request.json()
    
    if (!username) {
      return NextResponse.json({
        success: false,
        error: 'Username is required'
      }, { status: 400 })
    }
    
    const supabase = getServiceSupabase()
    
    // Проверяем существует ли сотрудник
    const { data: employee, error: fetchError } = await supabase
      .from('employees')
      .select('*')
      .eq('username', username)
      .single()
    
    if (fetchError || !employee) {
      return NextResponse.json({
        success: false,
        error: 'Сотрудник не найден'
      }, { status: 404 })
    }
    
    // Проверяем что у сотрудника еще нет пароля
    if (employee.password_hash) {
      return NextResponse.json({
        success: false,
        error: 'Пароль уже создан. Обратитесь к администратору для сброса.'
      }, { status: 400 })
    }
    
    // Проверяем что сотрудник активен
    if (!employee.is_active || username.includes('УВОЛЕН')) {
      return NextResponse.json({
        success: false,
        error: 'Доступ запрещен'
      }, { status: 403 })
    }
    
    // Генерируем случайный пароль
    const password = randomBytes(8).toString('hex')
    const passwordHash = await bcrypt.hash(password, 10)
    
    // Сохраняем хеш пароля
    const { error: updateError } = await supabase
      .from('employees')
      .update({
        password_hash: passwordHash,
        created_password_at: new Date().toISOString()
      })
      .eq('id', employee.id)
    
    if (updateError) {
      throw updateError
    }
    
    return NextResponse.json({
      success: true,
      password, // Показываем пароль только один раз!
      message: 'Сохраните этот пароль! Он больше не будет показан.'
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// app/api/auth/login/route.ts
import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()
    
    if (!username || !password) {
      return NextResponse.json({
        success: false,
        error: 'Логин и пароль обязательны'
      }, { status: 400 })
    }
    
    const supabase = getServiceSupabase()
    
    // Находим сотрудника
    const { data: employee, error: fetchError } = await supabase
      .from('employees')
      .select('*')
      .eq('username', username)
      .single()
    
    if (fetchError || !employee) {
      return NextResponse.json({
        success: false,
        error: 'Неверный логин или пароль'
      }, { status: 401 })
    }
    
    // Проверяем что сотрудник активен
    if (!employee.is_active || username.includes('УВОЛЕН')) {
      return NextResponse.json({
        success: false,
        error: 'Доступ заблокирован'
      }, { status: 403 })
    }
    
    // Проверяем пароль
    if (!employee.password_hash) {
      return NextResponse.json({
        success: false,
        error: 'Сначала зарегистрируйтесь'
      }, { status: 401 })
    }
    
    const isValidPassword = await bcrypt.compare(password, employee.password_hash)
    
    if (!isValidPassword) {
      return NextResponse.json({
        success: false,
        error: 'Неверный логин или пароль'
      }, { status: 401 })
    }
    
    // Создаем сессию
    const sessionToken = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Сессия на 7 дней
    
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert([{
        employee_id: employee.id,
        token: sessionToken,
        expires_at: expiresAt.toISOString()
      }])
    
    if (sessionError) {
      throw sessionError
    }
    
    // Обновляем last_login
    await supabase
      .from('employees')
      .update({ last_login: new Date().toISOString() })
      .eq('id', employee.id)
    
    // Устанавливаем cookie
    cookies().set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 дней
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
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServiceSupabase } from '@/lib/supabase/client'

export async function POST() {
  try {
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('session')
    
    if (sessionToken) {
      const supabase = getServiceSupabase()
      
      // Удаляем сессию из БД
      await supabase
        .from('sessions')
        .delete()
        .eq('token', sessionToken.value)
      
      // Удаляем cookie
      cookieStore.delete('session')
    }
    
    return NextResponse.json({
      success: true,
      message: 'Вы вышли из системы'
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// app/api/auth/me/route.ts
import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('session')
    
    if (!sessionToken) {
      return NextResponse.json({
        success: false,
        error: 'Не авторизован'
      }, { status: 401 })
    }
    
    const supabase = getServiceSupabase()
    
    // Проверяем сессию
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*, employee:employees(*)')
      .eq('token', sessionToken.value)
      .single()
    
    if (sessionError || !session) {
      return NextResponse.json({
        success: false,
        error: 'Сессия недействительна'
      }, { status: 401 })
    }
    
    // Проверяем что сессия не истекла
    if (new Date(session.expires_at) < new Date()) {
      await supabase
        .from('sessions')
        .delete()
        .eq('token', sessionToken.value)
      
      return NextResponse.json({
        success: false,
        error: 'Сессия истекла'
      }, { status: 401 })
    }
    
    // Проверяем что сотрудник все еще активен
    if (!session.employee.is_active) {
      return NextResponse.json({
        success: false,
        error: 'Доступ заблокирован'
      }, { status: 403 })
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: session.employee.id,
        username: session.employee.username,
        is_manager: session.employee.is_manager,
        is_active: session.employee.is_active,
        usdt_address: session.employee.usdt_address
      }
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
