-- Migration: Add comissao_porcentagem column to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS comissao_porcentagem integer NOT NULL DEFAULT 0;
