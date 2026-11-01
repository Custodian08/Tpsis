-- Add per-user ownership to client datasets.
-- Existing rows stay ownerless because their original account cannot be inferred safely.
-- They are excluded from user-facing queries until an administrator assigns an owner.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS owner_user_id INTEGER;

-- A single-account installation has an unambiguous owner. On multi-account legacy
-- databases leave old rows ownerless so they cannot be exposed to the wrong account.
DO $$
DECLARE
  account_count INTEGER;
  sole_user_id INTEGER;
BEGIN
  SELECT COUNT(*), MIN(id) INTO account_count, sole_user_id FROM users;
  IF account_count = 1 THEN
    UPDATE clients SET owner_user_id = sole_user_id WHERE owner_user_id IS NULL;
  END IF;
END $$;

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

-- The old global unique constraint prevents different users from importing the same
-- external client ID. Replace it with a per-user unique index; NULL legacy owners are
-- intentionally allowed until ownership is assigned.
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_client_external_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_owner_external_id
  ON clients(owner_user_id, client_external_id);

CREATE INDEX IF NOT EXISTS idx_clients_owner_user_id ON clients(owner_user_id);
