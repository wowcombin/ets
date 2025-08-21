import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    // Пытаемся создать таблицу sessions через прямой SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
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

        -- Создаем политики
        CREATE POLICY IF NOT EXISTS "Enable read access for all users" ON sessions
            FOR SELECT USING (true);

        CREATE POLICY IF NOT EXISTS "Enable insert for service role" ON sessions
            FOR INSERT WITH CHECK (auth.role() = 'service_role');

        CREATE POLICY IF NOT EXISTS "Enable update for service role" ON sessions
            FOR UPDATE USING (auth.role() = 'service_role');

        CREATE POLICY IF NOT EXISTS "Enable delete for service role" ON sessions
            FOR DELETE USING (auth.role() = 'service_role');
      `
    })
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Ошибка создания таблицы sessions',
        details: error,
        solution: 'Выполните SQL из schema.sql в Supabase Dashboard'
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Таблица sessions успешно создана',
      data: data
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      solution: 'Выполните SQL из lib/supabase/schema.sql в Supabase SQL Editor'
    })
  }
}
