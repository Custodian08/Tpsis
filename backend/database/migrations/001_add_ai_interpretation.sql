-- Добавляет сохранённый результат интеллектуальной интерпретации к анализу.
ALTER TABLE analysis_configs
    ADD COLUMN IF NOT EXISTS ai_interpretation JSONB;
