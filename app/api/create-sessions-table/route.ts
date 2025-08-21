import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    // Простое создание таблицы через прямой SQL запрос
    const { data, error } = await supabase
      .from('employees') // используем существующую таблицу для выполнения SQL
      .select('id')
      .limit(1)
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Нет доступа к базе данных',
        solution: 'Проверьте переменные окружения Supabase'
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Для создания таблицы sessions выполните в Supabase SQL Editor:',
      sql: `
CREATE TABLE IF NOT EXISTS sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_employee ON sessions(employee_id);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_policy" ON sessions FOR ALL USING (true);
      `,
      instructions: [
        '1. Скопируйте SQL выше',
        '2. Зайдите в Supabase Dashboard',
        '3. Перейдите в SQL Editor',
        '4. Вставьте и выполните SQL',
        '5. Попробуйте войти снова'
      ]
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}
