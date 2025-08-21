// lib/auth.ts
import { cookies } from 'next/headers'
import { getServiceSupabase } from './supabase/client'

export interface User {
  id: string
  username: string
  is_manager: boolean
  is_active: boolean
  usdt_address?: string
  profit_percentage?: number
  manager_type?: string
}

export async function getUserFromSession(): Promise<User | null> {
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
    if (!session.employee.is_active || session.employee.username.includes('УВОЛЕН')) {
      return null
    }
    
    return session.employee
  } catch (error) {
    console.error('Error getting user from session:', error)
    return null
  }
}

export async function requireAuth(): Promise<User> {
  const user = await getUserFromSession()
  if (!user) {
    throw new Error('Не авторизован')
  }
  return user
}

export async function requireManager(): Promise<User> {
  const user = await requireAuth()
  if (!user.is_manager) {
    throw new Error('Доступ только для менеджеров')
  }
  return user
}
