// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Публичные страницы, доступные без авторизации
const publicPaths = ['/login', '/register', '/api/auth/login', '/api/auth/register']

// Страницы только для менеджеров
const managerOnlyPaths = ['/admin', '/sync', '/test-sync', '/api/sync-all', '/api/calculate-salaries']

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Пропускаем публичные пути
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }
  
  // Проверяем наличие сессии
  const sessionToken = request.cookies.get('session')
  
  if (!sessionToken) {
    // Если нет сессии - редирект на логин
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.json(
      { success: false, error: 'Не авторизован' },
      { status: 401 }
    )
  }
  
  // Для API запросов проверяем права через заголовок
  if (pathname.startsWith('/api/')) {
    // Проверка будет в самом API endpoint через getUserFromSession
    return NextResponse.next()
  }
  
  // Для страниц только менеджеров делаем дополнительную проверку
  if (managerOnlyPaths.some(path => pathname.startsWith(path))) {
    // Проверка прав будет на стороне страницы
    return NextResponse.next()
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}

// lib/auth.ts - вспомогательные функции
import { cookies } from 'next/headers'
import { getServiceSupabase } from './supabase/client'

export async function getUserFromSession() {
  try {
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('session')
    
    if (!sessionToken) {
      return null
    }
    
    const supabase = getServiceSupabase()
    
    const { data: session, error } = await supabase
      .from('sessions')
      .select('*, employee:employees(*)')
      .eq('token', sessionToken.value)
      .single()
    
    if (error || !session) {
      return null
    }
    
    // Проверяем что сессия не истекла
    if (new Date(session.expires_at) < new Date()) {
      await supabase
        .from('sessions')
        .delete()
        .eq('token', sessionToken.value)
      return null
    }
    
    // Проверяем что сотрудник активен
    if (!session.employee.is_active) {
      return null
    }
    
    return session.employee
  } catch (error) {
    console.error('Error getting user from session:', error)
    return null
  }
}

export async function requireAuth() {
  const user = await getUserFromSession()
  if (!user) {
    throw new Error('Не авторизован')
  }
  return user
}

export async function requireManager() {
  const user = await requireAuth()
  if (!user.is_manager) {
    throw new Error('Доступ только для менеджеров')
  }
  return user
}
