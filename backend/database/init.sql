-- Инициализация базы данных для системы RFM-анализа
-- Выполните этот скрипт в PostgreSQL перед запуском приложения

-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы клиентов
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    client_external_id VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    client_type VARCHAR(50) DEFAULT 'individual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы транзакций
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    transaction_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    items_count INTEGER DEFAULT 1,
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transactions_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Создание таблицы конфигураций анализа
CREATE TABLE IF NOT EXISTS analysis_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    config_name VARCHAR(255) NOT NULL,
    analysis_period INTEGER NOT NULL,
    quartiles_count INTEGER DEFAULT 5,
    r_weights JSONB,
    f_weights JSONB,
    m_weights JSONB,
    ai_interpretation JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_analysis_configs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Создание таблицы сегментов
CREATE TABLE IF NOT EXISTS segments (
    id SERIAL PRIMARY KEY,
    segment_name VARCHAR(255) UNIQUE NOT NULL,
    rfm_pattern VARCHAR(10) UNIQUE NOT NULL,
    description TEXT,
    client_count INTEGER DEFAULT 0,
    avg_monetary DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы RFM-оценок
CREATE TABLE IF NOT EXISTS rfm_scores (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    analysis_config_id INTEGER NOT NULL,
    recency_days INTEGER NOT NULL,
    frequency_count INTEGER NOT NULL,
    monetary_value DECIMAL(10, 2) NOT NULL,
    r_score INTEGER NOT NULL,
    f_score INTEGER NOT NULL,
    m_score INTEGER NOT NULL,
    rfm_segment VARCHAR(10) NOT NULL,
    analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rfm_scores_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    CONSTRAINT fk_rfm_scores_config FOREIGN KEY (analysis_config_id) REFERENCES analysis_configs(id) ON DELETE CASCADE
);

-- Создание таблицы связи сегментов и RFM-оценок
CREATE TABLE IF NOT EXISTS segment_rfm_scores (
    rfm_score_id INTEGER NOT NULL,
    segment_id INTEGER NOT NULL,
    PRIMARY KEY (rfm_score_id, segment_id),
    CONSTRAINT fk_segment_rfm_scores_rfm FOREIGN KEY (rfm_score_id) REFERENCES rfm_scores(id) ON DELETE CASCADE,
    CONSTRAINT fk_segment_rfm_scores_segment FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE
);

-- Создание индексов для улучшения производительности
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_rfm_scores_client_id ON rfm_scores(client_id);
CREATE INDEX IF NOT EXISTS idx_rfm_scores_config_id ON rfm_scores(analysis_config_id);
CREATE INDEX IF NOT EXISTS idx_rfm_scores_segment ON rfm_scores(rfm_segment);
CREATE INDEX IF NOT EXISTS idx_clients_external_id ON clients(client_external_id);

-- Создание функции для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Создание триггеров для автоматического обновления updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
