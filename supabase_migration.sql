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
