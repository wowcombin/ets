import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    console.log('Starting complete database reset...')
    
    // Очищаем ВСЕ таблицы в правильном порядке (из-за foreign keys)
    
    // 1. Сначала зависимые таблицы
    await supabase.from('salaries').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('cards').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    // 2. Потом сотрудников
    await supabase.from('employees').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    // 3. Создаем менеджеров заново
    const managers = [
      {
        username: '@sobroffice',
        is_manager: true,
        is_active: true,
        manager_type: 'test_manager',
        profit_percentage: 10.00,
        folder_id: 'test'
      },
      {
        username: '@vladsohr',
        is_manager: true,
        is_active: true,
        manager_type: 'profit_manager',
        profit_percentage: 5.00,
        folder_id: 'manager'
      },
      {
        username: '@n1mbo',
        is_manager: true,
        is_active: true,
        manager_type: 'profit_manager',
        profit_percentage: 10.00,
        folder_id: 'manager'
      },
      {
        username: '@i88jU',
        is_manager: true,
        is_active: true,
        manager_type: 'profit_manager',
        profit_percentage: 5.00,
        folder_id: 'manager'
      }
    ]
    
    const { error: managerError } = await supabase
      .from('employees')
      .insert(managers)
    
    if (managerError) {
      console.error('Error creating managers:', managerError)
    }
    
    // Проверяем что осталось
    const { count: empCount } = await supabase.from('employees').select('*', { count: 'exact', head: true })
    const { count: transCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true })
    const { count: salCount } = await supabase.from('salaries').select('*', { count: 'exact', head: true })
    
    return NextResponse.json({
      success: true,
      message: 'Database reset complete',
      remaining: {
        employees: empCount || 0,
        transactions: transCount || 0,
        salaries: salCount || 0
      }
    })
    
  } catch (error: any) {
    console.error('Reset error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
