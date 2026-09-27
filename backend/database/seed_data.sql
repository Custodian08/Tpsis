-- Тестовые данные для системы RFM-анализа
-- Выполните этот скрипт после init.sql

-- Вставка тестовых пользователей
-- Пароль: password123 (хеширован с bcrypt)
INSERT INTO users (email, password, full_name, role) VALUES
('admin@example.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Администратор', 'admin'),
('user@example.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Тестовый пользователь', 'user')
ON CONFLICT (email) DO NOTHING;

-- Вставка тестовых клиентов
INSERT INTO clients (client_external_id, full_name, email, phone, client_type) VALUES
('1', 'Иванов Иван Иванович', 'ivanov@example.com', '+375291234567', 'individual'),
('2', 'Петров Петр Петрович', 'petrov@example.com', '+375292345678', 'individual'),
('3', 'Сидорова Анна Сергеевна', 'sidorova@example.com', '+375293456789', 'individual'),
('4', 'Козлов Дмитрий Александрович', 'kozlov@example.com', '+375294567890', 'corporate'),
('5', 'Морозова Елена Викторовна', 'morozova@example.com', '+375295678901', 'individual'),
('6', 'Волков Сергей Николаевич', 'volkov@example.com', '+375296789012', 'individual'),
('7', 'Новикова Мария Ивановна', 'novikova@example.com', '+375297890123', 'individual'),
('8', 'Соколов Андрей Петрович', 'sokolov@example.com', '+375298901234', 'individual'),
('9', 'Лебедева Ольга Сергеевна', 'lebedeva@example.com', '+375299012345', 'individual'),
('10', 'Кузнецов Алексей Михайлович', 'kuznetsov@example.com', '+375291234568', 'corporate')
ON CONFLICT (client_external_id) DO NOTHING;

-- Вставка тестовых транзакций
INSERT INTO transactions (client_id, transaction_date, amount, items_count, payment_method) VALUES
-- Клиент 1 (Иванов) - частые покупки
(1, '2024-01-15', 150.50, 2, 'card'),
(1, '2024-04-05', 300.00, 5, 'card'),
(1, '2024-06-15', 220.00, 4, 'card'),

-- Клиент 2 (Петров) - регулярные покупки
(2, '2024-02-20', 200.00, 1, 'card'),
(2, '2024-05-12', 120.00, 2, 'card'),
(2, '2024-07-10', 280.00, 5, 'card'),

-- Клиент 3 (Сидорова) - регулярные покупки
(3, '2024-03-10', 75.25, 3, 'cash'),
(3, '2024-06-01', 250.00, 3, 'card'),
(3, '2024-07-20', 320.00, 6, 'card'),

-- Клиент 4 (Козлов) - крупные корпоративные покупки
(4, '2024-01-25', 500.00, 10, 'card'),
(4, '2024-05-20', 750.00, 15, 'card'),

-- Клиент 5 (Морозова) - регулярные покупки
(5, '2024-02-28', 180.00, 4, 'card'),
(5, '2024-07-01', 190.00, 4, 'card'),

-- Клиент 6 (Волков) - разовые покупки
(6, '2024-03-15', 95.00, 1, 'cash'),
(6, '2024-06-25', 130.00, 2, 'card'),

-- Клиент 7 (Новикова) - разовые покупки
(7, '2024-04-10', 110.00, 2, 'card'),
(7, '2024-05-15', 140.00, 3, 'card'),

-- Клиент 8 (Соколов) - разовые покупки
(8, '2024-02-05', 160.00, 3, 'card'),

-- Клиент 9 (Лебедева) - разовые покупки
(9, '2024-03-25', 85.00, 2, 'cash'),

-- Клиент 10 (Кузнецов) - корпоративная покупка
(10, '2024-04-20', 450.00, 8, 'card');

-- Вставка базовых сегментов
INSERT INTO segments (segment_name, rfm_pattern, description) VALUES
('Лояльные клиенты', '555', 'Покупают часто, много и недавно'),
('В зоне риска', '155', 'Покупали часто и много, но давно'),
('Новые ценные', '515', 'Недавно начали покупать, но много'),
('Потерянные', '111', 'Покупали редко, мало и давно'),
('Частые но мало тратят', '551', 'Покупают часто, но мало тратят'),
('Потерянные но ценные', '151', 'Покупали давно, но много тратили'),
('Новые мало тратят', '511', 'Недавно начали, но мало тратят'),
('Обычный сегмент', '333', 'Средние показатели по всем критериям')
ON CONFLICT (segment_name) DO NOTHING;

-- Отображение статистики
SELECT 'Users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'Clients', COUNT(*) FROM clients
UNION ALL
SELECT 'Transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'Segments', COUNT(*) FROM segments
UNION ALL
SELECT 'Analysis Configs', COUNT(*) FROM analysis_configs
UNION ALL
SELECT 'RFM Scores', COUNT(*) FROM rfm_scores;