-- Создание таблицы usdt_change_requests для системы запросов на изменение USDT адресов
-- Выполните этот код в Supabase Dashboard → SQL Editor

-- Создаем таблицу
CREATE TABLE IF NOT EXISTS usdt_change_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    current_address VARCHAR(255),
    requested_address VARCHAR(255) NOT NULL,
    requested_network VARCHAR(50) DEFAULT 'BEP20',
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    approved_by UUID REFERENCES employees(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_usdt_requests_employee ON usdt_change_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_usdt_requests_status ON usdt_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_usdt_requests_created ON usdt_change_requests(created_at);

-- Включаем RLS
ALTER TABLE usdt_change_requests ENABLE ROW LEVEL SECURITY;

-- Создаем политики (удаляем старые если есть)
DROP POLICY IF EXISTS "Enable read access for all users" ON usdt_change_requests;
DROP POLICY IF EXISTS "Enable insert for service role" ON usdt_change_requests;
DROP POLICY IF EXISTS "Enable update for service role" ON usdt_change_requests;
DROP POLICY IF EXISTS "Enable delete for service role" ON usdt_change_requests;

-- Создаем новые политики
CREATE POLICY "Enable read access for all users" ON usdt_change_requests
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for service role" ON usdt_change_requests
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable update for service role" ON usdt_change_requests
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Enable delete for service role" ON usdt_change_requests
    FOR DELETE USING (auth.role() = 'service_role');
