import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Создаем функцию для подсчета статистики
    const { error } = await supabase.rpc('exec', {
      sql: `
        CREATE OR REPLACE FUNCTION get_total_stats(
          p_month TEXT,
          p_exclude_ids UUID[]
        )
        RETURNS TABLE(
          total_gross DECIMAL,
          transaction_count INTEGER
        )
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RETURN QUERY
          SELECT 
            COALESCE(SUM(gross_profit_usd), 0)::DECIMAL as total_gross,
            COUNT(*)::INTEGER as transaction_count
          FROM transactions
          WHERE month = p_month
            AND (p_exclude_ids IS NULL OR NOT (employee_id = ANY(p_exclude_ids)));
        END;
        $$;
      `
    })

    if (error) {
      console.error('Error creating function:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Stats function created successfully'
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
