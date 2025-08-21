import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession()
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      )
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        is_manager: user.is_manager,
        is_active: user.is_active,
        usdt_address: user.usdt_address,
        usdt_network: user.usdt_network,
        last_login: user.last_login,
        created_password_at: user.created_password_at
      }
    })
    
  } catch (error) {
    console.error('Auth me error:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
