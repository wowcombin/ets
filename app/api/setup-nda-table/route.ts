import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = getServiceSupabase()
    
    console.log('Creating NDA signatures table...')
    
    // SQL для создания таблицы и настройки RLS
    const createTableSQL = `
      -- Создание таблицы для хранения подписанных NDA
      CREATE TABLE IF NOT EXISTS nda_signatures (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          full_name TEXT NOT NULL,
          passport TEXT NOT NULL,
          issued_by TEXT NOT NULL,
          issued_date TEXT NOT NULL,
          address TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          signature_date TEXT NOT NULL,
          document_url TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Создание индексов
      CREATE INDEX IF NOT EXISTS idx_nda_signatures_email ON nda_signatures(email);
      CREATE INDEX IF NOT EXISTS idx_nda_signatures_created_at ON nda_signatures(created_at DESC);

      -- Включение RLS
      ALTER TABLE nda_signatures ENABLE ROW LEVEL SECURITY;

      -- Политика для вставки (публичная)
      DROP POLICY IF EXISTS "Anyone can sign NDA" ON nda_signatures;
      CREATE POLICY "Anyone can sign NDA" ON nda_signatures
          FOR INSERT WITH CHECK (true);

      -- Политика для чтения (только менеджеры)
      DROP POLICY IF EXISTS "Managers can view NDA signatures" ON nda_signatures;
      CREATE POLICY "Managers can view NDA signatures" ON nda_signatures
          FOR SELECT USING (
              EXISTS (
                  SELECT 1 FROM employees 
                  WHERE employees.id::text = auth.jwt() ->> 'sub'
                  AND employees.is_manager = true
                  AND employees.is_active = true
              )
          );
    `
    
    const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL })
    
    if (error) {
      console.error('Error creating NDA table:', error)
      return NextResponse.json({
        success: false,
        error: error.message,
        sql: createTableSQL
      }, { status: 500 })
    }
    
    // Проверяем что таблица создалась
    const { data: tableCheck, error: checkError } = await supabase
      .from('nda_signatures')
      .select('*')
      .limit(1)
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking table:', checkError)
      return NextResponse.json({
        success: false,
        error: 'Table created but verification failed: ' + checkError.message
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'NDA signatures table created successfully',
      tableExists: true
    })
    
  } catch (error: any) {
    console.error('Setup NDA table error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred'
    }, { status: 500 })
  }
}
