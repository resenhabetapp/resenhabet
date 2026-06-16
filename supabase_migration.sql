-- Rename quota column and add new fields
ALTER TABLE rooms RENAME COLUMN min_quota_value TO valor_da_cota;
ALTER TABLE rooms ALTER COLUMN valor_da_cota TYPE numeric(10,2) USING valor_da_cota::numeric;

-- Add deadline column
ALTER TABLE rooms ADD COLUMN horario_limite timestamptz NULL;

-- Add betting rules columns
ALTER TABLE rooms ADD COLUMN regra_empate text NOT NULL DEFAULT 'acumular';
ALTER TABLE rooms ADD COLUMN regra_banca_comissionada boolean NOT NULL DEFAULT false;

-- Add pix key type column
ALTER TABLE rooms ADD COLUMN pix_key_type text NOT NULL DEFAULT 'email';

-- Add user_id column to guesses table
ALTER TABLE guesses ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create policy to allow users to select their own guesses
CREATE POLICY "Allow users to select their own guesses" 
ON guesses FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Create policy to allow users to update anonymous guesses to their ID
CREATE POLICY "Allow users to update anonymous guesses to their ID" 
ON guesses FOR UPDATE 
TO authenticated 
USING (user_id IS NULL) 
WITH CHECK (auth.uid() = user_id);

-- Add bet_type and event_data to rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS bet_type TEXT NOT NULL DEFAULT 'placar_exato';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS event_data JSONB NULL;

-- Add guess_data to guesses
ALTER TABLE guesses ADD COLUMN IF NOT EXISTS guess_data JSONB NULL;

-- Backfill compatibility for legacy football data
UPDATE rooms 
SET event_data = jsonb_build_object('home_team', home_team, 'away_team', away_team) 
WHERE event_data IS NULL AND home_team IS NOT NULL;

UPDATE guesses 
SET guess_data = jsonb_build_object('home_score', home_score, 'away_score', away_score) 
WHERE guess_data IS NULL AND home_score IS NOT NULL;

-- Make home_score and away_score nullable on guesses table to support other sports
ALTER TABLE guesses ALTER COLUMN home_score DROP NOT NULL;
ALTER TABLE guesses ALTER COLUMN away_score DROP NOT NULL;

-- Remove check constraint check_scores_if_settled or update it to allow null scores for Formula 1
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS check_scores_if_settled;
ALTER TABLE rooms ADD CONSTRAINT check_scores_if_settled CHECK (
  (status <> 'settled') OR 
  (sport = 'Fórmula 1') OR 
  (home_score IS NOT NULL AND away_score IS NOT NULL)
);

-- Enable RLS and add policies for token_transactions
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own transactions" ON token_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own transactions" ON token_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

