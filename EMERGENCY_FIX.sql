-- ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ ТАБЛИЦЫ TRANSACTIONS
-- Выполните этот SQL в Supabase SQL Editor

-- 1. Сначала проверим текущую структуру
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'transactions' 
ORDER BY ordinal_position;

-- 2. Добавляем недостающие столбцы если их нет
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Обновляем существующие записи
UPDATE transactions 
SET last_updated = created_at, sync_timestamp = created_at 
WHERE last_updated IS NULL OR sync_timestamp IS NULL;

-- 4. Проверяем что все готово
SELECT COUNT(*) as total_transactions FROM transactions;

-- 5. Тестовая вставка
INSERT INTO transactions (
  employee_id, 
  month, 
  casino_name, 
  deposit_gbp, 
  withdrawal_gbp, 
  deposit_usd, 
  withdrawal_usd, 
  card_number, 
  gross_profit_usd, 
  net_profit_usd,
  last_updated,
  sync_timestamp
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '2025-08',
  'TEST_CASINO',
  10.0,
  15.0,
  13.0,
  19.5,
  '1234567890123456',
  6.5,
  6.5,
  NOW(),
  NOW()
);

-- 6. Удаляем тестовую запись
DELETE FROM transactions WHERE casino_name = 'TEST_CASINO';
