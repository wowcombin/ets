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

-- Создание индекса для быстрого поиска по email
CREATE INDEX IF NOT EXISTS idx_nda_signatures_email ON nda_signatures(email);

-- Создание индекса для сортировки по дате создания
CREATE INDEX IF NOT EXISTS idx_nda_signatures_created_at ON nda_signatures(created_at DESC);

-- Включение RLS (Row Level Security)
ALTER TABLE nda_signatures ENABLE ROW LEVEL SECURITY;

-- Политика для чтения (только для менеджеров)
DROP POLICY IF EXISTS "Managers can view NDA signatures" ON nda_signatures;
CREATE POLICY "Managers can view NDA signatures" ON nda_signatures
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
            AND employees.is_manager = true
            AND employees.is_active = true
        )
    );

-- Политика для вставки (публичная, так как страница доступна без авторизации)
DROP POLICY IF EXISTS "Anyone can sign NDA" ON nda_signatures;
CREATE POLICY "Anyone can sign NDA" ON nda_signatures
    FOR INSERT WITH CHECK (true);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS update_nda_signatures_updated_at ON nda_signatures;
CREATE TRIGGER update_nda_signatures_updated_at
    BEFORE UPDATE ON nda_signatures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
