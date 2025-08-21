import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { getSimpleUserFromSession } from '@/lib/simple-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('=== DEBUG EMPLOYEE DATA START ===')
    
    // Проверяем авторизацию
    const user = await getSimpleUserFromSession()
    console.log('User from session:', user ? { id: user.id, username: user.username, is_manager: user.is_manager } : 'null')
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Не авторизован',
        debug: 'No user found in session'
      })
    }
    
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    console.log('Current month:', currentMonth)
    
    // Проверяем доступ к базе данных
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('is_manager', false)
      .eq('is_active', true)
      .limit(5)
    
    console.log('Employees query result:', { count: employees?.length, error: empError })
    
    if (empError) {
      return NextResponse.json({
        success: false,
        error: 'Ошибка доступа к таблице employees',
        debug: empError
      })
    }
    
    // Проверяем транзакции
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('*, employee:employees(username)')
      .eq('month', currentMonth)
      .limit(10)
      .order('created_at', { ascending: false })
    
    console.log('Transactions query result:', { count: transactions?.length, error: transError })
    
    if (transError) {
      return NextResponse.json({
        success: false,
        error: 'Ошибка доступа к таблице transactions',
        debug: transError
      })
    }
    
    // Проверяем зарплаты
    const { data: salaries, error: salError } = await supabase
      .from('salaries')
      .select('*, employee:employees(username)')
      .eq('month', currentMonth)
      .limit(5)
    
    console.log('Salaries query result:', { count: salaries?.length, error: salError })
    
    return NextResponse.json({
      success: true,
      debug: {
        user: {
          id: user.id,
          username: user.username,
          is_manager: user.is_manager
        },
        month: currentMonth,
        database: {
          employees: employees?.length || 0,
          transactions: transactions?.length || 0,
          salaries: salaries?.length || 0
        },
        sampleTransaction: transactions?.[0] ? {
          id: transactions[0].id,
          employee: transactions[0].employee?.username,
          casino: transactions[0].casino_name,
          deposit: transactions[0].deposit_usd,
          withdrawal: transactions[0].withdrawal_usd,
          profit: transactions[0].gross_profit_usd,
          created_at: transactions[0].created_at,
          created_at_parsed: new Date(transactions[0].created_at).toISOString()
        } : null,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error: any) {
    console.error('Debug employee data error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      debug: {
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    })
  }
}
