import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Проверяем переменные окружения
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    const debug: any = {
      env: {
        hasUrl: !!url,
        hasAnonKey: !!anonKey,
        hasServiceKey: !!serviceKey,
        url: url || 'NOT SET',
      },
      tests: []
    }
    
    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables',
        debug
      })
    }
    
    // Тест 1: Подключение с anon key
    try {
      const anonClient = createClient(url, anonKey)
      const { count: anonCount, error } = await anonClient
        .from('employees')
        .select('*', { count: 'exact', head: true })
      
      debug.tests.push({
        test: 'Anon client connection',
        success: !error,
        count: anonCount,
        error: error?.message
      })
    } catch (e: any) {
      debug.tests.push({
        test: 'Anon client connection',
        success: false,
        error: e.message
      })
    }
    
    // Тест 2: Подключение с service key
    try {
      const serviceClient = createClient(url, serviceKey)
      const { count: serviceCount, error } = await serviceClient
        .from('employees')
        .select('*', { count: 'exact', head: true })
      
      debug.tests.push({
        test: 'Service client connection',
        success: !error,
        count: serviceCount,
        error: error?.message
      })
    } catch (e: any) {
      debug.tests.push({
        test: 'Service client connection',
        success: false,
        error: e.message
      })
    }
    
    // Тест 3: Создание тестовой записи с service key
    try {
      const serviceClient = createClient(url, serviceKey)
      const testUsername = `@debug_test_${Date.now()}`
      
      const { data: insertData, error: insertError } = await serviceClient
        .from('employees')
        .insert([{
          username: testUsername,
          folder_id: 'debug_test',
          is_manager: false,
          profit_percentage: 10.00
        }])
        .select()
        .single()
      
      if (insertData) {
        // Удаляем тестовую запись
        await serviceClient
          .from('employees')
          .delete()
          .eq('id', insertData.id)
      }
      
      debug.tests.push({
        test: 'Create and delete test record',
        success: !insertError,
        data: insertData,
        error: insertError?.message
      })
    } catch (e: any) {
      debug.tests.push({
        test: 'Create and delete test record',
        success: false,
        error: e.message
      })
    }
    
    // Тест 4: Проверяем все таблицы
    try {
      const serviceClient = createClient(url, serviceKey)
      const tables = ['employees', 'transactions', 'expenses', 'cards', 'salaries']
      const tableCounts: any = {}
      
      for (const table of tables) {
        const { count, error } = await serviceClient
          .from(table)
          .select('*', { count: 'exact', head: true })
        
        tableCounts[table] = {
          count: count || 0,
          error: error?.message
        }
      }
      
      debug.tests.push({
        test: 'Check all tables',
        success: true,
        tables: tableCounts
      })
    } catch (e: any) {
      debug.tests.push({
        test: 'Check all tables',
        success: false,
        error: e.message
      })
    }
    
    // Тест 5: Проверяем последние транзакции
    try {
      const serviceClient = createClient(url, serviceKey)
      const { data: transactions, error } = await serviceClient
        .from('transactions')
        .select('id, month, casino_name, gross_profit_usd')
        .order('created_at', { ascending: false })
        .limit(5)
      
      debug.tests.push({
        test: 'Get recent transactions',
        success: !error,
        count: transactions?.length || 0,
        data: transactions,
        error: error?.message
      })
    } catch (e: any) {
      debug.tests.push({
        test: 'Get recent transactions',
        success: false,
        error: e.message
      })
    }
    
    const allTestsPassed = debug.tests.every((t: any) => t.success)
    
    return NextResponse.json({
      success: allTestsPassed,
      message: allTestsPassed ? 'All database tests passed' : 'Some database tests failed',
      debug
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
