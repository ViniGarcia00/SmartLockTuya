-- ========================================
-- MIGRATION: Adicionar campo accommodation_id
-- ========================================

-- Adiciona a coluna accommodation_id na tabela locks
ALTER TABLE locks ADD COLUMN IF NOT EXISTS accommodation_id VARCHAR(50);

-- Adiciona comentário explicativo
COMMENT ON COLUMN locks.accommodation_id IS 'ID da acomodação associada à fechadura';

-- Verificar a estrutura atualizada
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'locks';
