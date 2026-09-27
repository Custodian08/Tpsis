-- Сохраняет даты периода и версию алгоритма для воспроизводимости новых анализов.
ALTER TABLE analysis_configs
    ADD COLUMN IF NOT EXISTS period_start DATE,
    ADD COLUMN IF NOT EXISTS period_end DATE,
    ADD COLUMN IF NOT EXISTS reference_date DATE,
    ADD COLUMN IF NOT EXISTS scoring_method_version VARCHAR(50);

-- Mark pre-existing analyses as legacy instead of claiming they used the new scoring rule.
UPDATE analysis_configs
SET scoring_method_version = 'legacy-quantile-v0'
WHERE scoring_method_version IS NULL;

ALTER TABLE analysis_configs
    ALTER COLUMN scoring_method_version SET DEFAULT 'midpoint-rank-v1',
    ALTER COLUMN scoring_method_version SET NOT NULL;
