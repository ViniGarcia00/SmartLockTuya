/**
 * =========================================================
 * MIGRATION: Criar tabela de sessões de usuário
 * =========================================================
 * 
 * Esta tabela rastreia as sessões ativas de cada usuário
 * e permite:
 * - Expiração automática de sessões após 12 horas
 * - Invalidação de sessões anteriores ao fazer novo login
 * - Detecção de login em outro dispositivo
 * 
 * Execução:
 * psql -U tuya_admin -d tuya_locks_db -f migrations/001_create_user_sessions.sql
 * =========================================================
 */

-- Criar tabela user_sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    device_info TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    ativo BOOLEAN DEFAULT true,
    
    -- Índices para melhor performance
    CONSTRAINT fk_user_sessions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Criar índices para queries frequentes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ativo ON user_sessions(ativo);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Criar função para limpar sessões expiradas automaticamente
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    UPDATE user_sessions 
    SET ativo = false 
    WHERE expires_at < CURRENT_TIMESTAMP AND ativo = true;
    
    DELETE FROM user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para limpar sessões expiradas (executa a cada hora)
-- Nota: Será necessário usar uma tarefa cron ou application-level cleanup

-- Adicionar coluna à tabela users para controlar versão de sessão (opcional)
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER DEFAULT 1;

COMMIT;

-- Descrição das colunas:
-- id: Identificador único da sessão
-- user_id: Referência ao usuário que criou a sessão
-- session_id: Token único de 64 caracteres em hexadecimal (gerado por crypto.randomBytes(32).toString('hex'))
-- device_info: Informações do User-Agent (para identificar o dispositivo)
-- ip_address: Endereço IP da requisição
-- created_at: Timestamp de criação da sessão
-- expires_at: Timestamp de expiração (created_at + 12 horas)
-- ativo: Boolean para indicar se a sessão ainda é válida

-- Exemplo de uso (após migração):
-- INSERT INTO user_sessions (user_id, session_id, device_info, ip_address, expires_at)
-- VALUES (1, 'abc123...', 'Mozilla/5.0...', '192.168.1.1', NOW() + INTERVAL '12 hours');
