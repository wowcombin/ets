# 🚀 Инструкции по настройке базы данных

## Проблема найдена:
1. Таблица `sessions` не создана в Supabase
2. У пользователя нет пароля в базе данных

## 🔧 Решение:

### 1. Создайте таблицу sessions в Supabase:

Зайдите в Supabase Dashboard → SQL Editor и выполните:

```sql
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

-- Политики для sessions
CREATE POLICY "Enable read access for all users" ON sessions
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for service role" ON sessions
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable update for service role" ON sessions
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Enable delete for service role" ON sessions
    FOR DELETE USING (auth.role() = 'service_role');
```

### 2. После создания таблицы:

1. Перейдите на https://etsmo.vercel.app/register
2. Введите ваш username: `@hostileua` 
3. Создайте пароль
4. Попробуйте войти снова

### 3. Проверьте результат:

- https://etsmo.vercel.app/api/test-db - проверка базы
- https://etsmo.vercel.app/api/debug-auth - детальная диагностика

## ✅ После выполнения всех шагов система будет работать!
