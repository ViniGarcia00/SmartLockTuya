/**
 * =========================================================
 * SCHEMA DO BANCO DE DADOS - SmartLock Tuya
 * =========================================================
 * 
 * Cria todas as tabelas necessárias para o sistema funcionar.
 * Executa as migrações em ordem:
 * 
 * 1. users - Usuários do sistema
 * 2. user_sessions - Sessões ativas dos usuários
 * 3. activity_logs - Log de atividades/auditorias
 * 
 * Execução:
 * psql -U tuya_admin -d tuya_locks_db -f database_schema.sql
 * =========================================================
 */

-- =========================================================
-- TABELA: users
-- =========================================================
-- Armazena informações dos usuários do sistema
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    empresa VARCHAR(255),
    email VARCHAR(255) NOT NULL UNIQUE,
    whatsapp VARCHAR(20) UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    
    -- Email verification
    email_verificado BOOLEAN DEFAULT false,
    token_verificacao VARCHAR(255) UNIQUE,
    data_verificacao TIMESTAMP,
    
    -- Password reset
    token_reset_senha VARCHAR(255) UNIQUE,
    token_reset_expira TIMESTAMP,
    
    -- Account status
    ativo BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para queries frequentes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_whatsapp ON users(whatsapp);
CREATE INDEX IF NOT EXISTS idx_users_ativo ON users(ativo);
CREATE INDEX IF NOT EXISTS idx_users_token_verificacao ON users(token_verificacao);
CREATE INDEX IF NOT EXISTS idx_users_token_reset_senha ON users(token_reset_senha);

-- =========================================================
-- TABELA: user_sessions
-- =========================================================
-- Gerencia as sessões ativas dos usuários
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    device_info TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    ativo BOOLEAN DEFAULT true,
    
    CONSTRAINT fk_user_sessions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ativo ON user_sessions(ativo);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- =========================================================
-- TABELA: activity_logs
-- =========================================================
-- Rastreia todas as ações dos usuários (auditorias)
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    acao VARCHAR(255) NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    detalhes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_activity_logs_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_acao ON activity_logs(acao);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_acao ON activity_logs(user_id, acao);

-- =========================================================
-- FUNCTIONS
-- =========================================================

-- Função para limpar sessões expiradas
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

-- Função para limpar logs antigos (manter 90 dias)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM activity_logs 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- TABELA: accommodations (Acomodações da API Stays)
-- =========================================================
CREATE TABLE IF NOT EXISTS accommodations (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accommodations_status ON accommodations(status);
CREATE INDEX IF NOT EXISTS idx_accommodations_name ON accommodations(name);

-- =========================================================
-- TABELA: locks (Fechaduras Tuya)
-- =========================================================
CREATE TABLE IF NOT EXISTS locks (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    device_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_locks_user_id ON locks(user_id);
CREATE INDEX IF NOT EXISTS idx_locks_device_id ON locks(device_id);

-- =========================================================
-- TABELA: accommodation_lock_mappings (Mapeamento Acomodação <-> Fechadura)
-- =========================================================
CREATE TABLE IF NOT EXISTS accommodation_lock_mappings (
    id SERIAL PRIMARY KEY,
    accommodation_id VARCHAR(255) NOT NULL UNIQUE,
    lock_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (accommodation_id) REFERENCES accommodations(id) ON DELETE CASCADE,
    FOREIGN KEY (lock_id) REFERENCES locks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mappings_accommodation ON accommodation_lock_mappings(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_mappings_lock ON accommodation_lock_mappings(lock_id);

-- =========================================================
-- TABELA: temp_passwords_history (Histórico de Senhas Temporárias)
-- =========================================================
CREATE TABLE IF NOT EXISTS temp_passwords_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    lock_id VARCHAR(255) NOT NULL,
    password_id VARCHAR(255) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    senha_cripto VARCHAR(255) NOT NULL,
    data_inicio TIMESTAMP NOT NULL,
    data_fim TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'ativa',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lock_id) REFERENCES locks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_temp_passwords_user_id ON temp_passwords_history(user_id);
CREATE INDEX IF NOT EXISTS idx_temp_passwords_lock_id ON temp_passwords_history(lock_id);
CREATE INDEX IF NOT EXISTS idx_temp_passwords_password_id ON temp_passwords_history(password_id);
CREATE INDEX IF NOT EXISTS idx_temp_passwords_status ON temp_passwords_history(status);

-- =========================================================
-- MENSAGEM FINAL
-- =========================================================
\echo 'Schema criado com sucesso!'
\echo 'Tabelas criadas:'
\echo '  ✓ users'
\echo '  ✓ user_sessions'
\echo '  ✓ activity_logs'
\echo '  ✓ accommodations'
\echo '  ✓ locks'
\echo '  ✓ accommodation_lock_mappings'
\echo '  ✓ temp_passwords_history'
\echo 'Próximo passo: Insira um usuário de teste para fazer login'
