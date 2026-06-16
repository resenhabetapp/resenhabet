-- Criar tabela de pilotos
CREATE TABLE IF NOT EXISTS public.f1_drivers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    code VARCHAR(3) NOT NULL UNIQUE,
    team TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (acesso público apenas para leitura)
ALTER TABLE public.f1_drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura pública de pilotos" ON public.f1_drivers;
CREATE POLICY "Permitir leitura pública de pilotos" ON public.f1_drivers
    FOR SELECT TO public USING (true);

-- Limpar e popular grid inicial de pilotos
TRUNCATE TABLE public.f1_drivers;
INSERT INTO public.f1_drivers (name, code, team) VALUES
('Max Verstappen', 'VER', 'Red Bull Racing'),
('Lando Norris', 'NOR', 'McLaren'),
('Oscar Piastri', 'PIA', 'McLaren'),
('Lewis Hamilton', 'HAM', 'Ferrari'),
('Charles Leclerc', 'LEC', 'Ferrari'),
('George Russell', 'RUS', 'Mercedes'),
('Kimi Antonelli', 'ANT', 'Mercedes'),
('Fernando Alonso', 'ALO', 'Aston Martin'),
('Lance Stroll', 'STR', 'Aston Martin'),
('Pierre Gasly', 'GAS', 'Alpine'),
('Jack Doohan', 'DOO', 'Alpine'),
('Alex Albon', 'ALB', 'Williams'),
('Carlos Sainz', 'SAI', 'Williams'),
('Yuki Tsunoda', 'TSU', 'RB'),
('Liam Lawson', 'LAW', 'RB'),
('Nico Hulkenberg', 'HUL', 'Haas'),
('Esteban Ocon', 'OCO', 'Haas'),
('Gabriel Bortoleto', 'BOR', 'Sauber'),
('Valtteri Bottas', 'BOT', 'Sauber');
