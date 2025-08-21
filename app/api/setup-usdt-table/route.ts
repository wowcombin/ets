import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Выполните этот SQL в Supabase Dashboard → SQL Editor:',
    sql: `
-- Создаем таблицу запросов на изменение USDT адреса
CREATE TABLE IF NOT EXISTS usdt_change_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    current_address VARCHAR(255), -- текущий адрес
    requested_address VARCHAR(255) NOT NULL, -- запрашиваемый адрес
    requested_network VARCHAR(50) DEFAULT 'BEP20', -- сеть (BEP20, TRC20, ERC20)
    reason TEXT, -- причина изменения
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    approved_by UUID REFERENCES employees(id), -- кто одобрил
    approved_at TIMESTAMP WITH TIME ZONE, -- когда одобрено
    rejection_reason TEXT, -- причина отклонения
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_usdt_requests_employee ON usdt_change_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_usdt_requests_status ON usdt_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_usdt_requests_created ON usdt_change_requests(created_at);

-- Включаем RLS
ALTER TABLE usdt_change_requests ENABLE ROW LEVEL SECURITY;

-- Создаем политики
CREATE POLICY IF NOT EXISTS "Enable read access for all users" ON usdt_change_requests
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Enable insert for service role" ON usdt_change_requests
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Enable update for service role" ON usdt_change_requests
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Enable delete for service role" ON usdt_change_requests
    FOR DELETE USING (auth.role() = 'service_role');
    `,
    instructions: [
      '1. Зайдите в Supabase Dashboard',
      '2. Перейдите в SQL Editor',  
      '3. Вставьте и выполните SQL код выше',
      '4. После выполнения система запросов USDT заработает'
    ]
  })
}
