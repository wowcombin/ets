// Простая авторизация без таблицы sessions (временное решение)
import { cookies } from 'next/headers'
import { getServiceSupabase } from './supabase/client'

export interface SimpleUser {
  id: string
  username: string
  is_manager: boolean
  is_active: boolean
  usdt_address?: string
  usdt_network?: string
  profit_percentage?: number
  manager_type?: string
  created_password_at?: string
  last_login?: string
}

// Получить пользователя из простой сессии
export async function getSimpleUserFromSession(): Promise<SimpleUser | null> {
  try {
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('session')
    
    if (!sessionToken) {
      return null
    }
    
    // Парсим простой токен формата: employeeId_timestamp
    const [employeeId, timestamp] = sessionToken.value.split('_')
    
    if (!employeeId || !timestamp) {
      return null
    }
    
    // Проверяем что токен не старше 7 дней
    const tokenAge = Date.now() - parseInt(timestamp)
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    
    if (tokenAge > sevenDays) {
      return null
    }
    
    const supabase = getServiceSupabase()
    
    // Получаем данные пользователя
    const { data: employee, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single()
    
    if (error || !employee) {
      return null
    }
    
    // Проверяем что сотрудник активен
    if (!employee.is_active || employee.username.includes('УВОЛЕН')) {
      return null
    }
    
    return employee
  } catch (error) {
    console.error('Error getting simple user from session:', error)
    return null
  }
}

// Требовать простую авторизацию
export async function requireSimpleAuth(): Promise<SimpleUser> {
  const user = await getSimpleUserFromSession()
  if (!user) {
    throw new Error('Не авторизован')
  }
  return user
}

// Требовать права менеджера
export async function requireSimpleManager(): Promise<SimpleUser> {
  const user = await requireSimpleAuth()
  if (!user.is_manager) {
    throw new Error('Доступ только для менеджеров')
  }
  return user
}
