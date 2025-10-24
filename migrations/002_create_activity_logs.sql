/**
 * =========================================================
 * MIGRATION: Criar tabela de logs de atividade
 * =========================================================
 * 
 * Esta tabela rastreia todas as ações dos usuários no sistema:
 * - Logins e logouts
 * - Alterações de configuração
 * - Operações com fechaduras
 * - Criação de senhas temporárias
 * 
 * Execução:
 * psql -U tuya_admin -d tuya_locks_db -f migrations/002_create_activity_logs.sql
 * =========================================================
 */

-- Criar tabela activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    acao VARCHAR(255) NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    detalhes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint para garantir referência válida
    CONSTRAINT fk_activity_logs_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_acao ON activity_logs(acao);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_acao ON activity_logs(user_id, acao);

-- Criar função para limpar logs antigos automaticamente (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM activity_logs 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
