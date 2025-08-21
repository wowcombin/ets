import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { deleteSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('session')?.value
    
    if (sessionToken) {
      // Удаляем сессию из базы
      await deleteSession(sessionToken)
    }
    
    // Удаляем cookie
    cookieStore.delete('session')
    
    return NextResponse.json({
      success: true,
      message: 'Выход выполнен успешно'
    })
    
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка при выходе' },
      { status: 500 }
    )
  }
}
