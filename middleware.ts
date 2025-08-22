// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Публичные страницы, доступные без авторизации
const publicPaths = [
  '/login',
  '/register',
  '/',
  '/sign-nda',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/simple-login',
  '/api/sign-nda',
  '/api/sign-nda-sheets',
  '/api/sign-nda-simple',
  '/api/setup-nda-table',
  '/api/setup-nda-permissions',
  '/api/test-db',
  '/api/debug-auth',
  '/api/debug-employee-data',
  '/api/debug-sessions',
  '/api/employee-data-test',
  '/api/debug-google-sheets',
  '/api/force-import',
  '/api/check-db-structure',
  '/api/fix-transactions-table',
  '/api/clean-duplicates',
  '/api/reset-and-import',
  '/api/emergency-cleanup',
  '/api/last-sync-info',
  '/api/setup-sessions-table',
  '/api/create-sessions-table',
  '/api/employee-data-public',
  '/api/force-calculate-salaries',
  '/api/force-sync',
  '/api/usdt-change-request',
  '/api/create-usdt-table',
  '/api/upgrade-transactions-table',
  '/api/live-updates',
  '/api/track-sheet-changes',
  '/api/debug-transactions',
  '/api/test-sync',
  '/api/check-latest-transactions'
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
