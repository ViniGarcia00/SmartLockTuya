#!/usr/bin/env node

/**
 * =========================================================
 * Database Setup Script
 * =========================================================
 * 
 * Este script cria todas as tabelas necessárias no PostgreSQL
 * e insere um usuário de teste para fazer login.
 * 
 * Uso:
 * npm run db:setup
 * node scripts/setup-db.js
 * =========================================================
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tuya_locks_db',
  user: process.env.DB_USER || 'tuya_admin',
  password: process.env.DB_PASSWORD,
});

async function setupDatabase() {
  const client = await pool.connect();

  try {
    console.log('🔄 Iniciando setup do banco de dados...\n');

    // 1. Criar tabela users
    console.log('📝 Criando tabela users...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        empresa VARCHAR(255),
        email VARCHAR(255) NOT NULL UNIQUE,
        whatsapp VARCHAR(20) UNIQUE,
        senha_hash VARCHAR(255) NOT NULL,
        email_verificado BOOLEAN DEFAULT false,
        token_verificacao VARCHAR(255) UNIQUE,
        data_verificacao TIMESTAMP,
        token_reset_senha VARCHAR(255) UNIQUE,
        token_reset_expira TIMESTAMP,
        ativo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_whatsapp ON users(whatsapp);
      CREATE INDEX IF NOT EXISTS idx_users_ativo ON users(ativo);
    `);
    console.log('✅ Tabela users criada\n');

    // 2. Criar tabela user_sessions
    console.log('📝 Criando tabela user_sessions...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id VARCHAR(255) NOT NULL UNIQUE,
        device_info TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        ativo BOOLEAN DEFAULT true
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_ativo ON user_sessions(ativo);
    `);
    console.log('✅ Tabela user_sessions criada\n');

    // 3. Criar tabela activity_logs
    console.log('📝 Criando tabela activity_logs...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        acao VARCHAR(255) NOT NULL,
        ip_address VARCHAR(50),
        user_agent TEXT,
        detalhes JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_acao ON activity_logs(acao);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
    `);
    console.log('✅ Tabela activity_logs criada\n');

    // 4. Inserir usuário de teste
    console.log('📝 Criando usuário de teste...');
    const testEmail = 'teste@example.com';
    const testSenha = 'senha123';
    const senhaHash = await bcrypt.hash(testSenha, 10);
    const tokenVerificacao = crypto.randomBytes(32).toString('hex');

    try {
      await client.query(
        `INSERT INTO users (nome, empresa, email, senha_hash, email_verificado, token_verificacao)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO NOTHING`,
        [
          'Usuário Teste',
          'Empresa Teste',
          testEmail,
          senhaHash,
          true, // Email já verificado para teste
          tokenVerificacao
        ]
      );
      console.log('✅ Usuário de teste criado\n');
      console.log('📋 Credenciais de teste:');
      console.log(`   Email: ${testEmail}`);
      console.log(`   Senha: ${testSenha}\n`);
    } catch (err) {
      if (err.code === '23505') {
        console.log('ℹ️  Usuário de teste já existe\n');
      } else {
        throw err;
      }
    }

    console.log('✅ Setup do banco de dados concluído com sucesso!\n');
    console.log('🚀 Agora você pode fazer login com as credenciais de teste.');
    console.log('💡 Acesse: http://localhost:3000/login.html\n');

  } catch (error) {
    console.error('❌ Erro ao configurar banco de dados:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar setup
setupDatabase().catch(console.error);
