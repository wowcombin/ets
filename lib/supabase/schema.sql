-- Создаем таблицу сотрудников
CREATE TABLE IF NOT EXISTS employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL, -- @mr_e500, @sobroffice и т.д.
    folder_id VARCHAR(255), -- ID папки в Google Drive
    is_manager BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE, -- активен ли сотрудник
    manager_type VARCHAR(50), -- 'test_manager' или 'profit_manager'
    profit_percentage DECIMAL(5,2) DEFAULT 10.00, -- процент от прибыли
    password_hash VARCHAR(255), -- хеш пароля для авторизации
    usdt_address VARCHAR(255), -- USDT адрес для выплат (BEP20)
    usdt_network VARCHAR(20) DEFAULT 'BEP20', -- сеть USDT
    created_password_at TIMESTAMP WITH TIME ZONE, -- когда создан пароль
    last_login TIMESTAMP WITH TIME ZONE, -- последний вход
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Создаем таблицу транзакций
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- формат: "2024-08"
    casino_name VARCHAR(255) NOT NULL,
    deposit_gbp DECIMAL(10,2) DEFAULT 0,
    withdrawal_gbp DECIMAL(10,2) DEFAULT 0,
    deposit_usd DECIMAL(10,2) DEFAULT 0,
    withdrawal_usd DECIMAL(10,2) DEFAULT 0,
    card_number VARCHAR(20),
    gross_profit_usd DECIMAL(10,2) DEFAULT 0,
    net_profit_usd DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Создаем таблицу расходов
CREATE TABLE IF NOT EXISTS expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    month VARCHAR(7) NOT NULL, -- формат: "2024-08"
    amount_usd DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Создаем таблицу карт
CREATE TABLE IF NOT EXISTS cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    card_number VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'available', -- 'available', 'assigned', 'used'
    assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
    casino_name VARCHAR(255),
    month VARCHAR(7),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Создаем таблицу зарплат
CREATE TABLE IF NOT EXISTS salaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL,
    base_salary DECIMAL(10,2) DEFAULT 0,
    bonus DECIMAL(10,2) DEFAULT 0,
    leader_bonus DECIMAL(10,2) DEFAULT 0,
    total_salary DECIMAL(10,2) DEFAULT 0,
    is_paid BOOLEAN DEFAULT FALSE,
    paid_by UUID REFERENCES employees(id), -- кто отметил как оплаченное
    paid_at TIMESTAMP WITH TIME ZONE, -- когда отмечено как оплаченное
    payment_hash VARCHAR(255), -- хеш транзакции USDT
    payment_note TEXT, -- заметка к платежу
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Создаем таблицу сессий для авторизации
CREATE TABLE IF NOT EXISTS sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    user_agent TEXT, -- информация о браузере
    ip_address INET, -- IP адрес пользователя
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Создаем таблицу рабочих сессий для отслеживания активности
CREATE TABLE IF NOT EXISTS work_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    casino_name VARCHAR(255) NOT NULL,
    card_number VARCHAR(255),
    deposit_amount DECIMAL(10,2) NOT NULL,
    withdrawal_amount DECIMAL(10,2),
    deposit_time TIMESTAMP WITH TIME ZONE NOT NULL, -- время депозита
    withdrawal_time TIMESTAMP WITH TIME ZONE, -- время вывода
    work_duration_minutes INTEGER, -- продолжительность работы в минутах (от депозита до вывода + 5 мин)
    gross_profit DECIMAL(10,2), -- вывод - депозит
    is_completed BOOLEAN DEFAULT FALSE, -- завершена ли сессия (есть ли вывод)
    month VARCHAR(7) NOT NULL, -- формат "2024-08"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Создаем индексы для оптимизации
CREATE INDEX idx_transactions_month ON transactions(month);
CREATE INDEX idx_transactions_employee ON transactions(employee_id);
CREATE INDEX idx_expenses_month ON expenses(month);
CREATE INDEX idx_cards_status ON cards(status);
CREATE INDEX idx_salaries_month ON salaries(month);
CREATE INDEX idx_salaries_employee ON salaries(employee_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_employee ON sessions(employee_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_work_sessions_employee ON work_sessions(employee_id);
CREATE INDEX idx_work_sessions_month ON work_sessions(month);
CREATE INDEX idx_work_sessions_casino ON work_sessions(casino_name);
CREATE INDEX idx_work_sessions_deposit_time ON work_sessions(deposit_time);
CREATE INDEX idx_work_sessions_completed ON work_sessions(is_completed);

-- Вставляем начальные данные для сотрудников
INSERT INTO employees (username, is_manager, manager_type, profit_percentage) VALUES
    ('@sobroffice', TRUE, 'test_manager', 10.00),
    ('@vladsohr', TRUE, 'profit_manager', 5.00),
    ('@n1mbo', TRUE, 'profit_manager', 10.00),
    ('@i88jU', TRUE, 'profit_manager', 5.00)
ON CONFLICT (username) DO NOTHING;

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Создаем триггеры для автоматического обновления updated_at
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salaries_updated_at BEFORE UPDATE ON salaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Включаем Row Level Security (RLS)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;

-- Создаем политики для публичного доступа (временно, потом настроим авторизацию)
CREATE POLICY "Enable read access for all users" ON employees
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON transactions
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON expenses
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON cards
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON salaries
    FOR SELECT USING (true);

-- Политики для записи (только через service role)
CREATE POLICY "Enable insert for service role" ON employees
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable insert for service role" ON transactions
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable insert for service role" ON expenses
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable insert for service role" ON cards
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable insert for service role" ON salaries
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable update for service role" ON employees
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Enable update for service role" ON transactions
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Enable update for service role" ON expenses
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Enable update for service role" ON cards
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Enable update for service role" ON salaries
    FOR UPDATE USING (auth.role() = 'service_role');

-- Политики для sessions
CREATE POLICY "Enable read access for all users" ON sessions
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for service role" ON sessions
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable update for service role" ON sessions
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Enable delete for service role" ON sessions
    FOR DELETE USING (auth.role() = 'service_role');

-- Политики для work_sessions
CREATE POLICY "Enable read access for all users" ON work_sessions
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for service role" ON work_sessions
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable update for service role" ON work_sessions
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Enable delete for service role" ON work_sessions
    FOR DELETE USING (auth.role() = 'service_role');
