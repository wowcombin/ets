import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const results: {
      steps: any[]
      success: boolean
    } = {
      steps: [],
      success: false
    }
    
    // Шаг 1: Проверяем подключение
    const { data: checkData, error: checkError } = await supabase
      .from('employees')
      .select('count')
      .single()
    
    results.steps.push({
      step: 'Check connection',
      success: !checkError,
      error: checkError?.message
    })
    
    // Шаг 2: Пробуем создать тестового сотрудника
    const testUsername = `@test_${Date.now()}`
    const { data: insertData, error: insertError } = await supabase
      .from('employees')
      .insert([{
        username: testUsername,
        folder_id: 'test_folder',
        is_manager: false,
        profit_percentage: 10.00
      }])
      .select()
      .single()
    
    results.steps.push({
      step: 'Insert test employee',
      success: !insertError,
      data: insertData,
      error: insertError?.message
    })
    
    if (insertData) {
      // Шаг 3: Проверяем что сотрудник создался
      const { data: verifyData, error: verifyError } = await supabase
        .from('employees')
        .select('*')
        .eq('username', testUsername)
        .single()
      
      results.steps.push({
        step: 'Verify employee exists',
        success: !verifyError && verifyData !== null,
        data: verifyData,
        error: verifyError?.message
      })
      
      // Шаг 4: Пробуем создать транзакцию
      const { data: transData, error: transError } = await supabase
        .from('transactions')
        .insert([{
          employee_id: insertData.id,
          month: '2025-08',
          casino_name: 'Test Casino',
          deposit_gbp: 100,
          withdrawal_gbp: 150,
          deposit_usd: 130,
          withdrawal_usd: 195,
          card_number: '1234',
          gross_profit_usd: 65,
          net_profit_usd: 65
        }])
        .select()
        .single()
      
      results.steps.push({
        step: 'Insert test transaction',
        success: !transError,
        data: transData,
        error: transError?.message
      })
      
      // Шаг 5: Удаляем тестовые данные
      await supabase
        .from('transactions')
        .delete()
        .eq('employee_id', insertData.id)
      
      await supabase
        .from('employees')
        .delete()
        .eq('id', insertData.id)
      
      results.steps.push({
        step: 'Cleanup test data',
        success: true
      })
    }
    
    // Шаг 6: Получаем финальные подсчеты
    const { count: empCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
    
    const { count: transCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
    
    results.steps.push({
      step: 'Final counts',
      employees: empCount,
      transactions: transCount
    })
    
    results.success = results.steps.every(s => s.success !== false)
    
    return NextResponse.json(results)
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    })
  }
}
