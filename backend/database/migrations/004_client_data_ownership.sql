-- Assign private ownership to new datasets. Legacy shared data is copied to each
-- existing account so every account retains the data it could see before migration.
BEGIN;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_user_id INTEGER;

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_client_external_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_clients_owner_user'
      AND conrelid = 'clients'::regclass
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT fk_clients_owner_user
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TEMP TABLE legacy_client_ids (
  client_id INTEGER PRIMARY KEY
) ON COMMIT DROP;
INSERT INTO legacy_client_ids(client_id)
SELECT id FROM clients WHERE owner_user_id IS NULL;

CREATE TEMP TABLE client_owner_map (
  original_client_id INTEGER NOT NULL,
  owner_user_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  PRIMARY KEY (original_client_id, owner_user_id)
) ON COMMIT DROP;

DO $$
DECLARE
  account_count INTEGER;
  first_user_id INTEGER;
BEGIN
  SELECT COUNT(*), MIN(id) INTO account_count, first_user_id FROM users;

  IF account_count = 1 THEN
    UPDATE clients SET owner_user_id = first_user_id WHERE owner_user_id IS NULL;
  ELSIF account_count > 1 THEN
    -- Preserve original IDs for the first account, then copy the legacy clients
    -- and their transactions for every other account.
    UPDATE clients SET owner_user_id = first_user_id
    WHERE id IN (SELECT client_id FROM legacy_client_ids);

    INSERT INTO client_owner_map(original_client_id, owner_user_id, client_id)
    SELECT client.id, first_user_id, client.id
    FROM clients client
    JOIN legacy_client_ids legacy ON legacy.client_id = client.id;

    WITH source AS MATERIALIZED (
      SELECT client.*
      FROM clients client
      JOIN legacy_client_ids legacy ON legacy.client_id = client.id
    ), cloned AS (
      INSERT INTO clients (
        client_external_id, owner_user_id, full_name, email, phone, client_type, created_at, updated_at
      )
      SELECT source.client_external_id, target_user.id, source.full_name, source.email,
        source.phone, source.client_type, source.created_at, source.updated_at
      FROM source
      CROSS JOIN users target_user
      WHERE target_user.id <> first_user_id
      RETURNING id, owner_user_id, client_external_id
    )
    INSERT INTO client_owner_map(original_client_id, owner_user_id, client_id)
    SELECT source.id, cloned.owner_user_id, cloned.id
    FROM cloned
    JOIN source ON source.client_external_id = cloned.client_external_id;

    INSERT INTO transactions (
      client_id, transaction_date, amount, items_count, payment_method, created_at
    )
    SELECT mapping.client_id, transaction.transaction_date, transaction.amount,
      transaction.items_count, transaction.payment_method, transaction.created_at
    FROM transactions transaction
    JOIN client_owner_map mapping ON mapping.original_client_id = transaction.client_id
    WHERE mapping.client_id <> mapping.original_client_id;

    -- Keep each historical analysis attached to that account's copy of the
    -- client record. Score IDs and segment links stay intact.
    UPDATE rfm_scores score
    SET client_id = mapping.client_id
    FROM analysis_configs config
    JOIN client_owner_map mapping ON mapping.owner_user_id = config.user_id
    WHERE config.id = score.analysis_config_id
      AND mapping.original_client_id = score.client_id;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_owner_external_id
  ON clients(owner_user_id, client_external_id);
CREATE INDEX IF NOT EXISTS idx_clients_owner_user_id ON clients(owner_user_id);

COMMENT ON COLUMN clients.owner_user_id IS
  'Account that owns this client dataset; new imports always set this field.';

COMMIT;
