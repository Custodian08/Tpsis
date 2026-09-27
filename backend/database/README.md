# Инструкция по инициализации базы данных

## Создание базы данных

1. Откройте pgAdmin или командную строку PostgreSQL
2. Выполните команду для создания базы данных:

```sql
CREATE DATABASE rfm_analysis;
```

## Инициализация таблиц

Выполните скрипт `init.sql` в базе данных `rfm_analysis`:

**Через pgAdmin:**
1. Откройте pgAdmin
2. Подключитесь к серверу PostgreSQL
3. Выберите базу данных `rfm_analysis`
4. Нажмите правой кнопкой на базу данных → Query Tool
5. Откройте файл `init.sql`
6. Нажмите Execute (F5)

**Через командную строку:**
```bash
psql -U postgres -d rfm_analysis -f init.sql
```

Для базы, которая была создана до добавления интеллектуальной интерпретации, примените миграцию `migrations/001_add_ai_interpretation.sql`:

```bash
psql -U postgres -d rfm_analysis -f migrations/001_add_ai_interpretation.sql
```

## Добавление тестовых данных

Выполните скрипт `seed_data.sql` в базе данных `rfm_analysis`:

**Через pgAdmin:**
1. В Query Tool откройте файл `seed_data.sql`
2. Нажмите Execute (F5)

**Через командную строку:**
```bash
psql -U postgres -d rfm_analysis -f seed_data.sql
```

## Тестовые пользователи

После выполнения скриптов будут созданы тестовые пользователи:

| Email | Пароль | Роль |
|-------|--------|------|
| admin@example.com | password123 | admin |
| user@example.com | password123 | user |

## Структура базы данных

- **users** - пользователи системы
- **clients** - клиенты компании
- **transactions** - транзакции/покупки
- **analysis_configs** - конфигурации RFM-анализа
- **segments** - сегменты клиентов
- **rfm_scores** - результаты RFM-анализа
- **segment_rfm_scores** - связь сегментов и RFM-оценок

## Проверка данных

После выполнения скриптов вы увидите статистику:

- Users: 2
- Clients: 10
- Transactions: 20
- Segments: 8
- Analysis Configs: 0
- RFM Scores: 0

## Сброс базы данных

Если нужно очистить базу данных и начать заново:

```sql
DROP DATABASE rfm_analysis;
CREATE DATABASE rfm_analysis;
-- Затем снова выполните init.sql и seed_data.sql
```
