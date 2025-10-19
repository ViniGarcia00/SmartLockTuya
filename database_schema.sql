-- ========================================
-- SCHEMA DO BANCO DE DADOS
-- ========================================

-- Tabela de Usuários
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    empresa VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    whatsapp VARCHAR(20),
    senha_hash VARCHAR(255) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    email_verificado BOOLEAN DEFAULT false,
    token_verificacao VARCHAR(255),
    token_reset_senha VARCHAR(255),
    token_reset_expira TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Configurações Tuya do Usuário
CREATE TABLE tuya_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    client_id VARCHAR(255) NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    region_host VARCHAR(255) DEFAULT 'openapi.tuyaeu.com',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Tabela de Fechaduras do Usuário
CREATE TABLE locks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    localizacao VARCHAR(255),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Perfis de Usuário (para controle de acesso)
CREATE TABLE user_profiles (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descricao TEXT,
    permissoes JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Logs de Atividades
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    acao VARCHAR(100) NOT NULL,
    detalhes JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Senhas Temporárias (histórico local)
CREATE TABLE temp_passwords_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lock_id INTEGER REFERENCES locks(id) ON DELETE CASCADE,
    password_id VARCHAR(255),
    nome VARCHAR(255),
    senha_cripto VARCHAR(255),
    data_inicio TIMESTAMP NOT NULL,
    data_fim TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'ativa',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_tuya_configs_user ON tuya_configs(user_id);
CREATE INDEX idx_locks_user ON locks(user_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_date ON activity_logs(created_at DESC);
CREATE INDEX idx_temp_passwords_user ON temp_passwords_history(user_id);
CREATE INDEX idx_temp_passwords_lock ON temp_passwords_history(lock_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tuya_configs_updated_at BEFORE UPDATE ON tuya_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locks_updated_at BEFORE UPDATE ON locks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir perfis padrão
INSERT INTO user_profiles (nome, descricao, permissoes) VALUES
('admin', 'Administrador com acesso total', '{"all": true}'),
('usuario', 'Usuário padrão com acesso básico', '{"locks": ["view", "create"], "passwords": ["view", "create", "delete"]}'),
('visualizador', 'Apenas visualização', '{"locks": ["view"], "passwords": ["view"]}');

-- Comentários nas tabelas
COMMENT ON TABLE users IS 'Tabela de usuários do sistema';
COMMENT ON TABLE tuya_configs IS 'Configurações de API Tuya por usuário';
COMMENT ON TABLE locks IS 'Fechaduras cadastradas por usuário';
COMMENT ON TABLE user_profiles IS 'Perfis de acesso do sistema';
COMMENT ON TABLE activity_logs IS 'Logs de todas as atividades do sistema';
COMMENT ON TABLE temp_passwords_history IS 'Histórico de senhas temporárias criadas';
