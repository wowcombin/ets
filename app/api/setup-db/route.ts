import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export async function POST() {
  try {
    const supabase = getServiceSupabase()
    
    // Создаем таблицу sessions
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Создаем таблицу сессий для авторизации
        CREATE TABLE IF NOT EXISTS sessions (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
            token VARCHAR(255) UNIQUE NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            user_agent TEXT,
            ip_address INET,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
        );

        -- Создаем индексы
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
        CREATE INDEX IF NOT EXISTS idx_sessions_employee ON sessions(employee_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

        -- Включаем RLS
        ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
      `
    })
    
    if (createError) {
      return NextResponse.json({
        success: false,
        error: 'Ошибка создания таблицы',
        details: createError.message,
        solution: 'Выполните SQL вручную в Supabase Dashboard'
      })
    }
    
    // Создаем политики
    const { error: policyError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Политики для sessions
        DROP POLICY IF EXISTS "Enable read access for all users" ON sessions;
        DROP POLICY IF EXISTS "Enable insert for service role" ON sessions;
        DROP POLICY IF EXISTS "Enable update for service role" ON sessions;
        DROP POLICY IF EXISTS "Enable delete for service role" ON sessions;
        
        CREATE POLICY "Enable read access for all users" ON sessions
            FOR SELECT USING (true);

        CREATE POLICY "Enable insert for service role" ON sessions
            FOR INSERT WITH CHECK (auth.role() = 'service_role');

        CREATE POLICY "Enable update for service role" ON sessions
            FOR UPDATE USING (auth.role() = 'service_role');

        CREATE POLICY "Enable delete for service role" ON sessions
            FOR DELETE USING (auth.role() = 'service_role');
      `
    })
    
    return NextResponse.json({
      success: true,
      message: 'База данных настроена успешно!',
      created: ['sessions table', 'indexes', 'RLS policies'],
      policy_error: policyError?.message || null
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Критическая ошибка',
      details: error.message,
      solution: 'Выполните SQL скрипт вручную в Supabase Dashboard'
    })
  }
}
