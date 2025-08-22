import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    // Добавляем новые колонки в таблицу salaries
    const alterTableSQL = `
      ALTER TABLE salaries 
      ADD COLUMN IF NOT EXISTS base_salary DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS bonus DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS leader_bonus DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_salary DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
    `
    
    // Выполняем SQL напрямую
    const { error } = await supabase.rpc('exec_sql', { sql: alterTableSQL })
    
    if (error) {
      console.error('Error updating salaries schema:', error)
      
      // Если функция exec_sql не существует, предоставим SQL для ручного выполнения
      return NextResponse.json({
        success: false,
        error: error.message,
        manual_sql: alterTableSQL,
        instructions: 'Пожалуйста, выполните этот SQL в Supabase SQL Editor'
      })
    }
    
    // Обновляем существующие записи
    const updateSQL = `
      UPDATE salaries 
      SET 
        is_paid = CASE WHEN paid_at IS NOT NULL THEN TRUE ELSE FALSE END,
        total_salary = amount,
        base_salary = amount - COALESCE(bonus, 0) - COALESCE(leader_bonus, 0)
      WHERE total_salary IS NULL OR total_salary = 0;
    `
    
    await supabase.rpc('exec_sql', { sql: updateSQL })
    
    return NextResponse.json({
      success: true,
      message: 'Схема salaries успешно обновлена'
    })
    
  } catch (error: any) {
    console.error('Update salaries schema error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      manual_sql: `
        ALTER TABLE salaries 
        ADD COLUMN IF NOT EXISTS base_salary DECIMAL(10, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS bonus DECIMAL(10, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS leader_bonus DECIMAL(10, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_salary DECIMAL(10, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
        
        UPDATE salaries 
        SET 
          is_paid = CASE WHEN paid_at IS NOT NULL THEN TRUE ELSE FALSE END,
          total_salary = amount,
          base_salary = amount - COALESCE(bonus, 0) - COALESCE(leader_bonus, 0)
        WHERE total_salary IS NULL OR total_salary = 0;
      `
    }, { status: 500 })
  }
}
