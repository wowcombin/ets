// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Публичные страницы, доступные без авторизации
const publicPaths = [
  '/login',
  '/register',
  '/',
  '/api/auth/login',
  '/api/auth/register',
  '/api/test-db',
  '/api/debug-auth',
  '/api/create-sessions-table'
]

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Пропускаем статические файлы
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // файлы с расширениями
  ) {
    return NextResponse.next()
  }
  
  // Проверяем публичные пути
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path))
  
  // Получаем токен из cookies
  const sessionToken = request.cookies.get('session')?.value
  
  // Если страница публичная - пропускаем
  if (isPublicPath) {
    // Если пользователь залогинен и пытается зайти на login/register - редирект на главную
    if (sessionToken && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }
  
  // Для защищенных страниц проверяем наличие сессии
  if (!sessionToken) {
    // Для API возвращаем 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    // Для страниц - редирект на login
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ]
}
