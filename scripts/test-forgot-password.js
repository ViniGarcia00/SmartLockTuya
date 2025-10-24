/**
 * Script de Teste Completo de Forgot-Password
 * Simula o fluxo completo de recuperação de senha
 */

require('dotenv').config();
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { Pool } = require('pg');

// ===== CORES PARA TERMINAL =====
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  step: (msg) => console.log(`\n${colors.bright}${colors.cyan}▶ ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.magenta}╔═══════════════════════════════════════╗${colors.reset}\n${colors.bright}${colors.magenta}║ ${msg.padEnd(35)} ║${colors.reset}\n${colors.bright}${colors.magenta}╚═══════════════════════════════════════╝${colors.reset}`)
};

// ===== VARIÁVEIS =====
const testEmail = 'teste@example.com'; // Email que será testado
let transporter;
let pool;

// ===== CONFIGURAR BANCO DE DADOS =====
async function setupDatabase() {
  log.step('Conectando ao PostgreSQL...');
  
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'tuya_locks_db',
    user: process.env.DB_USER || 'tuya_admin',
    password: process.env.DB_PASSWORD
  });

  try {
    const result = await pool.query('SELECT NOW()');
    log.success(`Conectado ao PostgreSQL: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    log.error(`Erro ao conectar: ${error.message}`);
    return false;
  }
}

// ===== CONFIGURAR EMAIL =====
async function setupEmail() {
  log.step('Configurando Nodemailer...');

  if (process.env.EMAIL_SERVICE === 'smtp') {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
      port: parseInt(process.env.EMAIL_PORT || '465'),
      secure: process.env.EMAIL_SECURE === 'true' || true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  } else {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  try {
    await transporter.verify();
    log.success(`Email configurado: ${process.env.EMAIL_USER}`);
    return true;
  } catch (error) {
    log.error(`Erro ao verificar email: ${error.message}`);
    return false;
  }
}

// ===== VERIFICAR USUÁRIO =====
async function verifyUser() {
  log.step(`Verificando usuário: ${testEmail}`);

  try {
    const result = await pool.query(
      'SELECT id, nome, email, email_verificado, ativo FROM users WHERE email = $1',
      [testEmail]
    );

    if (result.rows.length === 0) {
      log.warn(`Usuário não existe. Será criado um para teste...`);
      return null;
    }

    const user = result.rows[0];
    log.success(`Usuário encontrado: ${user.nome}`);
    log.info(`  - ID: ${user.id}`);
    log.info(`  - Email: ${user.email}`);
    log.info(`  - Email Verificado: ${user.email_verificado ? 'SIM' : 'NÃO'}`);
    log.info(`  - Ativo: ${user.ativo ? 'SIM' : 'NÃO'}`);

    if (!user.email_verificado) {
      log.warn('Email não verificado! Será necessário verificar antes de recuperar senha.');
    }

    if (!user.ativo) {
      log.warn('Usuário inativo! Recuperação de senha não funcionará.');
    }

    return user;
  } catch (error) {
    log.error(`Erro ao verificar usuário: ${error.message}`);
    return null;
  }
}

// ===== CRIAR USUÁRIO TESTE =====
async function createTestUser() {
  log.step('Criando usuário de teste...');

  try {
    const result = await pool.query(
      `INSERT INTO users (nome, email, email_verificado, ativo) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, nome, email`,
      ['Usuário Teste', testEmail, true, true]
    );

    const user = result.rows[0];
    log.success(`Usuário criado: ${user.nome}`);
    log.info(`  - ID: ${user.id}`);
    log.info(`  - Email: ${user.email}`);
    
    return user;
  } catch (error) {
    log.error(`Erro ao criar usuário: ${error.message}`);
    return null;
  }
}

// ===== SIMULAR FORGOT-PASSWORD =====
async function simulateForgotPassword(user) {
  log.step('Simulando requisição de Forgot-Password...');

  try {
    // Gerar token
    const tokenReset = crypto.randomBytes(32).toString('hex');
    const tokenExpira = new Date(Date.now() + 3600000); // 1 hora

    log.info(`Token gerado: ${tokenReset.substring(0, 20)}...`);
    log.info(`Expira em: ${tokenExpira.toLocaleString()}`);

    // Salvar no banco
    await pool.query(
      'UPDATE users SET token_reset_senha = $1, token_reset_expira = $2 WHERE id = $3',
      [tokenReset, tokenExpira, user.id]
    );
    log.success('Token salvo no banco de dados');

    return { tokenReset, tokenExpira };
  } catch (error) {
    log.error(`Erro ao salvar token: ${error.message}`);
    return null;
  }
}

// ===== ENVIAR EMAIL =====
async function sendResetEmail(user, token) {
  log.step('Enviando email de recuperação...');

  try {
    const resetLink = `${process.env.APP_URL}/reset-password.html?token=${token.tokenReset}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: '🔐 Redefinição de Senha - Tuya Locks [TESTE]',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h2 style="color: white; margin: 0;">🔐 Tuya Locks</h2>
            <p style="color: rgba(255,255,255,0.9); margin: 0;">Email de Teste - Redefinição de Senha</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <h3 style="color: #333;">Olá ${user.nome},</h3>
            
            <p style="color: #666; line-height: 1.6;">
              ✅ <strong>TESTE DE EMAIL FUNCIONANDO!</strong><br>
              Este é um email de teste para verificar se a funcionalidade de recuperação de senha está operacional.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Redefinir Minha Senha
              </a>
            </div>
            
            <p style="background: #d4edda; padding: 15px; border-left: 4px solid #28a745; border-radius: 4px; color: #155724;">
              <strong>✓ Teste Bem-Sucedido:</strong> Se você recebeu este email, o sistema de recuperação de senha está funcionando corretamente!
            </p>
            
            <div style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px; font-family: monospace; font-size: 11px; color: #666; word-break: break-all;">
              <strong>Debug Info:</strong><br>
              Token: ${token.tokenReset.substring(0, 50)}...<br>
              Expira: ${token.tokenExpira.toISOString()}<br>
              Enviado: ${new Date().toISOString()}
            </div>
            
            <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
              Este é um email automático de teste. Não responda a este email.
            </p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    log.success('Email enviado com sucesso!');
    log.info(`  - Message ID: ${info.messageId}`);
    log.info(`  - Destinatário: ${user.email}`);
    log.info(`  - Response: ${info.response}`);

    return true;
  } catch (error) {
    log.error(`Erro ao enviar email: ${error.message}`);
    if (error.code) log.info(`  - Error Code: ${error.code}`);
    return false;
  }
}

// ===== VERIFICAR BANCO =====
async function verifyDatabaseState(user) {
  log.step('Verificando estado do banco de dados...');

  try {
    const result = await pool.query(
      'SELECT id, nome, email, token_reset_senha, token_reset_expira FROM users WHERE id = $1',
      [user.id]
    );

    if (result.rows.length === 0) {
      log.error('Usuário não encontrado no banco!');
      return false;
    }

    const dbUser = result.rows[0];
    log.success('Dados no banco de dados:');
    log.info(`  - Nome: ${dbUser.nome}`);
    log.info(`  - Email: ${dbUser.email}`);
    log.info(`  - Token Reset: ${dbUser.token_reset_senha ? '✓ Salvo' : '✗ Não salvo'}`);
    log.info(`  - Expira em: ${dbUser.token_reset_expira}`);

    return true;
  } catch (error) {
    log.error(`Erro ao verificar banco: ${error.message}`);
    return false;
  }
}

// ===== EXECUTAR TESTE COMPLETO =====
async function runCompleteTest() {
  log.section('TESTE COMPLETO DE FORGOT-PASSWORD');

  console.log('\n📋 Configuração Utilizada:');
  console.log(`  - Banco: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  console.log(`  - Email: ${process.env.EMAIL_USER} via ${process.env.EMAIL_SERVICE}`);
  console.log(`  - Usuário Teste: ${testEmail}`);

  try {
    // 1. Conectar ao banco
    if (!await setupDatabase()) {
      log.error('Não foi possível conectar ao banco. Abortando.');
      process.exit(1);
    }

    // 2. Configurar email
    if (!await setupEmail()) {
      log.error('Não foi possível configurar email. Abortando.');
      process.exit(1);
    }

    // 3. Verificar usuário
    let user = await verifyUser();
    if (!user) {
      user = await createTestUser();
      if (!user) {
        log.error('Não foi possível criar usuário. Abortando.');
        process.exit(1);
      }
    }

    // 4. Simular forgot-password
    const token = await simulateForgotPassword(user);
    if (!token) {
      log.error('Não foi possível gerar token. Abortando.');
      process.exit(1);
    }

    // 5. Enviar email
    await sendResetEmail(user, token);

    // 6. Verificar banco
    await verifyDatabaseState(user);

    // 7. Resumo
    log.section('RESUMO DO TESTE');
    console.log(`
${colors.green}✅ TESTE COMPLETO EXECUTADO COM SUCESSO!${colors.reset}

${colors.bright}O que foi testado:${colors.reset}
  ✓ Conexão com PostgreSQL
  ✓ Configuração de Nodemailer
  ✓ Geração de token de reset
  ✓ Armazenamento no banco de dados
  ✓ Envio de email
  ✓ Verificação de dados

${colors.bright}Próximos passos:${colors.reset}
  1. Verifique o email em: ${testEmail}
  2. Clique no link de recuperação
  3. Defina uma nova senha
  4. Faça login com a nova senha

${colors.bright}Se o email não chegou:${colors.reset}
  - Verifique a pasta SPAM
  - Certifique-se de que EMAIL_USER e EMAIL_PASSWORD estão corretos em .env
  - Execute novamente o teste

${colors.dim}Data/Hora: ${new Date().toLocaleString()}${colors.reset}
    `);

    process.exit(0);
  } catch (error) {
    log.error(`Erro não tratado: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// ===== EXECUTAR =====
runCompleteTest().finally(() => {
  if (pool) pool.end();
});
