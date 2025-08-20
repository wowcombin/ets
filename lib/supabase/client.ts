// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js'

// SECURITY FIX: Use environment variables only, never hardcode credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Client for browser/frontend use
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Server-side client with service role key
export const getServiceSupabase = () => {
  if (typeof window !== 'undefined') {
    throw new Error('Service role client can only be used on the server')
  }
  
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }
  
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// Types remain the same
export type Employee = {
  id: string
  username: string
  folder_id?: string
  is_manager: boolean
  is_active: boolean
  manager_type?: 'test_manager' | 'profit_manager'
  profit_percentage: number
  created_at: string
  updated_at: string
}

export type Transaction = {
  id: string
  employee_id: string
  month: string
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
  month: string
  amount_usd: number
  description?: string
  created_at: string
  updated_at: string
}

export type Card = {
  id: string
  card_number: string
  status: 'available' | 'assigned' | 'used'
  assigned_to?: string
  casino_name?: string
  sheet?: string
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
  leader_bonus: number
  total_salary: number
  is_paid: boolean
  created_at: string
  updated_at: string
}

// Helper functions
export const dbHelpers = {
  async getEmployees() {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('username')
    
    if (error) throw error
    return data as Employee[]
  },

  async getTransactionsByMonth(month: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('month', month)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data as Transaction[]
  },

  async getExpensesByMonth(month: string) {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('month', month)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data as Expense[]
  },

  async getCards() {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .order('card_number')
    
    if (error) throw error
    return data as Card[]
  },

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
