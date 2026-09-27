-- Idempotent constraints and indexes for safer imports, reproducible analyses,
-- and bounded queries. Run after init.sql and migrations 001/002.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM transactions WHERE items_count < 1) THEN
    RAISE EXCEPTION 'Cannot apply migration 003: transactions contain items_count < 1';
  END IF;
  IF EXISTS (SELECT 1 FROM rfm_scores WHERE recency_days < 0 OR frequency_count < 1 OR
    r_score NOT BETWEEN 1 AND 10 OR f_score NOT BETWEEN 1 AND 10 OR m_score NOT BETWEEN 1 AND 10) THEN
    RAISE EXCEPTION 'Cannot apply migration 003: existing RFM scores are outside supported ranges';
  END IF;
  IF EXISTS (
    SELECT 1 FROM rfm_scores GROUP BY analysis_config_id, client_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot apply migration 003: duplicate client scores exist in an analysis';
  END IF;
  IF EXISTS (SELECT 1 FROM analysis_configs WHERE quartiles_count NOT BETWEEN 3 AND 10 OR analysis_period < 1) THEN
    RAISE EXCEPTION 'Cannot apply migration 003: analysis configuration values are outside supported ranges';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_transactions_items_count_positive') THEN
    ALTER TABLE transactions ADD CONSTRAINT ck_transactions_items_count_positive CHECK (items_count >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_rfm_scores_metric_ranges') THEN
    ALTER TABLE rfm_scores ADD CONSTRAINT ck_rfm_scores_metric_ranges CHECK (
      recency_days >= 0 AND frequency_count >= 1 AND
      r_score BETWEEN 1 AND 10 AND f_score BETWEEN 1 AND 10 AND m_score BETWEEN 1 AND 10
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_analysis_configs_ranges') THEN
    ALTER TABLE analysis_configs ADD CONSTRAINT ck_analysis_configs_ranges CHECK (
      quartiles_count BETWEEN 3 AND 10 AND analysis_period >= 1 AND
      (period_start IS NULL OR period_end IS NULL OR period_start <= period_end)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_rfm_scores_analysis_client') THEN
    ALTER TABLE rfm_scores ADD CONSTRAINT uq_rfm_scores_analysis_client UNIQUE (analysis_config_id, client_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_analysis_configs_user_created
  ON analysis_configs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_client_date
  ON transactions (client_id, transaction_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_rfm_scores_config_segment_client
  ON rfm_scores (analysis_config_id, rfm_segment, client_id);

COMMIT;
