import { createClient } from '@supabase/supabase-js'

// Используем ваши переменные окружения
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oxnrptswkkfynjumtvnb.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94bnJwdHN3a2tmeW5qdW10dm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMDY5MTMsImV4cCI6MjA3MDc4MjkxM30.0iTHTooHPDs46qXmDuWFe0Iedm3fzW-de92HjFPdjf8'

// Создаем клиент для использования на клиенте
// Используем service role key для полного доступа
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94bnJwdHN3a2tmeW5qdW10dm5iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTIwNjkxMywiZXhwIjoyMDcwNzgyOTEzfQ.bDYjlBpg4xLPy6ytaYU6XtjKvOpKl0leGkZFvy1o_iE'

export const supabase = createClient(
  supabaseUrl,
  typeof window !== 'undefined' ? supabaseAnonKey : serviceKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)

// Создаем клиент для использования на сервере (с service role key)
export const getServiceSupabase = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94bnJwdHN3a2tmeW5qdW10dm5iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTIwNjkxMywiZXhwIjoyMDcwNzgyOTEzfQ.bDYjlBpg4xLPy6ytaYU6XtjKvOpKl0leGkZFvy1o_iE'
  
  return createClient(
    supabaseUrl,
    serviceKey,
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
