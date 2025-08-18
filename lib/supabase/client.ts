import { createClient } from '@supabase/supabase-js'

// Проверяем наличие переменных окружения
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Создаем клиент для использования на клиенте
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)

// Создаем клиент для использования на сервере (с service role key)
export const getServiceSupabase = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY')
  }
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}

// Типы для таблиц базы данных
export type Employee = {
  id: string
  username: string // @mr_e500
  folder_id?: string // ID папки в Google Drive
  is_manager: boolean
  manager_type?: 'test_manager' | 'profit_manager'
  profit_percentage: number
  created_at: string
  updated_at: string
}

export type Transaction = {
  id: string
  employee_id: string
  month: string // "2024-08"
  casino_name: string
  deposit_gbp: number
  withdrawal_gbp: number
  deposit_usd: number
  withdrawal_usd: number
  card_number: string
  gross_profit_usd: number
  net_profit_usd: number
  created_at: string
  updated_at: string
}

export type Expense = {
  id: string
  month: string // "2024-08"
  amount_usd: number
  description?: string
  created_at: string
  updated_at: string
}

export type Card = {
  id: string
  card_number: string
  status: 'available' | 'assigned' | 'used'
  assigned_to?: string // employee_id
  casino_name?: string
  month?: string
  created_at: string
  updated_at: string
}

export type Salary = {
  id: string
  employee_id: string
  month: string
  base_salary: number
  bonus: number
  total_salary: number
  is_paid: boolean
  created_at: string
  updated_at: string
}

// Вспомогательные функции для работы с базой
export const dbHelpers = {
  // Получить всех сотрудников
  async getEmployees() {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('username')
    
    if (error) throw error
    return data as Employee[]
  },

  // Получить транзакции за месяц
  async getTransactionsByMonth(month: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('month', month)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data as Transaction[]
  },

  // Получить расходы за месяц
  async getExpensesByMonth(month: string) {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('month', month)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data as Expense[]
  },

  // Получить все карты
  async getCards() {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .order('card_number')
    
    if (error) throw error
    return data as Card[]
  },

  // Получить зарплаты за месяц
  async getSalariesByMonth(month: string) {
    const { data, error } = await supabase
      .from('salaries')
      .select('*')
      .eq('month', month)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data as Salary[]
  }
}
