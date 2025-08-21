// lib/auth.ts
import { cookies } from 'next/headers'
import { getServiceSupabase } from './supabase/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

export interface User {
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

export interface Session {
  id: string
  employee_id: string
  token: string
  expires_at: string
  created_at: string
  employee?: User
}

// Получить пользователя из сессии
export async function getUserFromSession(): Promise<User | null> {
  try {
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('session')
    
    if (!sessionToken) {
      return null
    }
    
    const supabase = getServiceSupabase()
    
    // Получаем сессию с данными сотрудника
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
      // Удаляем истекшую сессию
      await supabase
        .from('sessions')
        .delete()
        .eq('token', sessionToken.value)
      return null
    }
    
    // Проверяем что сотрудник активен
    if (!session.employee.is_active || session.employee.username.includes('УВОЛЕН')) {
      // Удаляем сессию неактивного пользователя
      await supabase
        .from('sessions')
        .delete()
        .eq('token', sessionToken.value)
      return null
    }
    
    return session.employee
  } catch (error) {
    console.error('Error getting user from session:', error)
    return null
  }
}

// Требовать авторизацию
export async function requireAuth(): Promise<User> {
  const user = await getUserFromSession()
  if (!user) {
    throw new Error('Не авторизован')
  }
  return user
}

// Требовать права менеджера
export async function requireManager(): Promise<User> {
  const user = await requireAuth()
  if (!user.is_manager) {
    throw new Error('Доступ только для менеджеров')
  }
  return user
}

// Создать сессию
export async function createSession(employeeId: string): Promise<string> {
  const supabase = getServiceSupabase()
  
  // Генерируем токен
  const sessionToken = randomBytes(32).toString('hex')
  
  // Сессия действует 7 дней
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)
  
  // Создаем сессию в БД
  const { error } = await supabase
    .from('sessions')
    .insert([{
      employee_id: employeeId,
      token: sessionToken,
      expires_at: expiresAt.toISOString()
    }])
  
  if (error) {
    throw error
  }
  
  // Обновляем last_login
  await supabase
    .from('employees')
    .update({ last_login: new Date().toISOString() })
    .eq('id', employeeId)
  
  return sessionToken
}

// Удалить сессию
export async function deleteSession(token: string): Promise<void> {
  const supabase = getServiceSupabase()
  
  await supabase
    .from('sessions')
    .delete()
    .eq('token', token)
}

// Очистить истекшие сессии
export async function cleanExpiredSessions(): Promise<void> {
  const supabase = getServiceSupabase()
  
  await supabase
    .from('sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
}

// Проверить пароль
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Хешировать пароль
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

// Генерировать случайный пароль
export function generatePassword(): string {
  return randomBytes(8).toString('hex')
}

// Проверить права доступа к данным сотрудника
export async function canViewEmployee(user: User, employeeId: string): Promise<boolean> {
  // Менеджеры видят всех
  if (user.is_manager) {
    return true
  }
  
  // Сотрудники видят только себя
  return user.id === employeeId
}

// Проверить права на просмотр зарплат
export async function canViewSalaries(user: User): Promise<boolean> {
  // Только менеджеры могут видеть все зарплаты
  // Обычные сотрудники видят только свою через отдельный endpoint
  return user.is_manager
}

// Проверить права на оплату зарплат
export async function canPaySalaries(user: User): Promise<boolean> {
  // Только менеджеры могут отмечать зарплаты как оплаченные
  return user.is_manager
}

// Получить доступные для пользователя данные
export async function getAccessibleData(user: User) {
  const supabase = getServiceSupabase()
  const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
  
  if (user.is_manager) {
    // Менеджеры видят все
    return {
      canViewAll: true,
      canViewExpenses: true,
      canViewAllSalaries: true,
      canPaySalaries: true,
      canViewLeaderboard: true
    }
  } else {
    // Обычные сотрудники имеют ограниченный доступ
    const { data: ownSalary } = await supabase
      .from('salaries')
      .select('*')
      .eq('employee_id', user.id)
      .eq('month', currentMonth)
      .single()
    
    const { data: ownTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('employee_id', user.id)
      .eq('month', currentMonth)
    
    return {
      canViewAll: false,
      canViewExpenses: false,
      canViewAllSalaries: false,
      canPaySalaries: false,
      canViewLeaderboard: true, // Могут видеть таблицу лидеров
      ownData: {
        salary: ownSalary,
        transactions: ownTransactions
      }
    }
  }
}

// Валидация USDT адреса (BEP20)
export function validateUsdtAddress(address: string): boolean {
  // BEP20 адрес начинается с 0x и имеет 42 символа
  const pattern = /^0x[a-fA-F0-9]{40}$/
  return pattern.test(address)
}

// Форматировать USDT адрес для отображения
export function formatUsdtAddress(address: string): string {
  if (!address) return ''
  // Показываем первые 6 и последние 4 символа
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
