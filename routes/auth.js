/**
 * =========================================================
 * ROTAS DE AUTENTICAÇÃO
 * =========================================================
 * Registro, login, verificação de email e reset de senha
 * =========================================================
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/database');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');

// ===== CONFIGURAÇÃO DE EMAIL =====
// Transporte Nodemailer para envio de emails de verificação e reset de senha
// Suporta Gmail, Hostinger e outros SMTP
let transporter;

if (process.env.EMAIL_SERVICE === 'smtp') {
  // Configuração customizada para Hostinger
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.EMAIL_PORT || '465'),
    secure: process.env.EMAIL_SECURE === 'true' || true, // true para 465, false para outras portas
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
} else {
  // Configuração de serviço (Gmail, Yahoo, etc)
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
}

/**
 * POST /api/auth/register
 * Registra novo usuário no sistema
 * 
 * Validações:
 * - Nome: obrigatório
 * - Email: formato válido e único
 * - Senha: mínimo 6 caracteres
 * - WhatsApp: opcional
 * 
 * Processo:
 * 1. Valida entrada com express-validator
 * 2. Verifica se email já existe
 * 3. Faz hash da senha com bcrypt (10 rounds)
 * 4. Gera token de verificação de email
 * 5. Insere usuário no banco
 * 6. Envia email de verificação (se configurado)
 * 
 * @returns {object} { success, message, user }
 */
// ==================== REGISTRO ====================
router.post('/register', [
  body('nome').trim().notEmpty().withMessage('Nome é obrigatório'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('senha').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
  body('whatsapp').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { nome, empresa, email, whatsapp, senha } = req.body;

    // Verifica se email já existe
    const existingEmail = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingEmail.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Este email já está cadastrado em nossa plataforma'
      });
    }

    // Verifica se whatsapp já existe (se fornecido e não vazio)
    if (whatsapp && whatsapp.trim()) {
      const existingWhatsapp = await query(
        'SELECT id FROM users WHERE whatsapp = $1',
        [whatsapp]
      );

      if (existingWhatsapp.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Este número de WhatsApp já está associado a outra conta'
        });
      }
    }

    // Hash da senha com bcrypt - padrão: 10 rounds
    const senhaHash = await bcrypt.hash(senha, 10);
    
    // Gera token aleatório para verificação de email
    const tokenVerificacao = crypto.randomBytes(32).toString('hex');

    // Insere novo usuário no banco
    const result = await query(
      `INSERT INTO users (nome, empresa, email, whatsapp, senha_hash, token_verificacao)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nome, email, empresa`,
      [nome, empresa || null, email, whatsapp || null, senhaHash, tokenVerificacao]
    );

    const user = result.rows[0];

    // Envia email de verificação (opcional - requer configuração)
    if (process.env.EMAIL_USER) {
      try {
        const verifyLink = `${process.env.APP_URL}/verify-email.html?token=${tokenVerificacao}`;
        
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: '✅ Confirme seu Email - SmartLock Tuya',
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0;">🔐 SmartLock Tuya</h1>
              </div>
              
              <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-top: 0;">Bem-vindo, ${nome}!</h2>
                
                <p style="color: #666; line-height: 1.6;">
                  Sua conta foi criada com sucesso no sistema SmartLock Tuya. 
                  Para ativar sua conta e começar a usar o sistema, confirme seu email clicando no botão abaixo:
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${verifyLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; display: inline-block;">
                    ✅ Confirmar Email
                  </a>
                </div>
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                  Ou copie e cole este link em seu navegador:<br>
                  <code style="background: #f5f5f5; padding: 5px 10px; border-radius: 3px;">${verifyLink}</code>
                </p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <p style="color: #999; font-size: 12px;">
                  <strong>Informações da conta:</strong><br>
                  Email: ${email}<br>
                  Empresa: ${empresa || 'Não informado'}<br>
                  Data de criação: ${new Date().toLocaleDateString('pt-BR')}
                </p>
              </div>
              
              <p style="color: #999; font-size: 11px; text-align: center; margin-top: 20px;">
                Se você não criou esta conta, ignore este email.<br>
                Este é um email automático, por favor não responda.
              </p>
            </div>
          `
        });
        
        console.log(`📧 Email de confirmação enviado para: ${email}`);
      } catch (emailError) {
        console.error('Erro ao enviar email de confirmação:', emailError);
        // Continua mesmo se o email falhar - não bloqueia registro
      }
    }

    res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso!',
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        empresa: user.empresa
      }
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao cadastrar usuário'
    });
  }
});

// ==================== LOGIN ====================
/**
 * POST /api/auth/login
 * Autentica usuário e retorna JWT token com gestão de sessões
 * 
 * Validações:
 * - Email deve ser formato válido
 * - Senha não pode estar vazia
 * 
 * Processo:
 * 1. Busca usuário no banco pelo email
 * 2. Compara senha com hash usando bcrypt
 * 3. Invalida outras sessões ativas do usuário (segurança multi-device)
 * 4. Cria nova sessão no banco com expiração de 12h
 * 5. Gera JWT token com expiração de 12h
 * 6. Retorna token + session_id + dados do usuário
 * 
 * Token deve ser enviado em requisições subsequentes:
 * Header: Authorization: Bearer <token>
 * 
 * Session ID deve ser armazenado no localStorage e validado em req.headers
 * 
 * @returns {object} { success, token, session_id, expiresIn, id, nome }
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('senha').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email ou senha inválidos' 
      });
    }

    const { email, senha } = req.body;

    // Busca usuário
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND ativo = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Email ou senha incorretos'
      });
    }

    const user = result.rows[0];

    // Verifica senha
    const senhaValida = await bcrypt.compare(senha, user.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({
        success: false,
        error: 'Email ou senha incorretos'
      });
    }

    // Verifica se o email foi confirmado
    if (!user.email_verificado) {
      return res.status(403).json({
        success: false,
        error: 'Por favor, confirme seu email antes de fazer login',
        requiresEmailVerification: true,
        email: user.email
      });
    }

    // ===== GESTÃO DE SESSÕES =====
    // Invalida todas as sessões anteriores deste usuário
    await query(
      'UPDATE user_sessions SET ativo = false WHERE user_id = $1 AND ativo = true',
      [user.id]
    );

    // Gera um ID único para a sessão
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    // Define expiração em 12 horas
    const expiresIn = 43200; // 12 horas em segundos
    const expiryTime = new Date(Date.now() + expiresIn * 1000);

    // Extrai informações do dispositivo do header User-Agent
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';

    // Registra a nova sessão no banco
    await query(
      `INSERT INTO user_sessions (user_id, session_id, device_info, ip_address, expires_at, ativo)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [user.id, sessionId, userAgent, ipAddress, expiryTime]
    );

    // Gera token JWT com expiração de 12h
    const token = jwt.sign(
      { userId: user.id, email: user.email, sessionId: sessionId },
      process.env.JWT_SECRET,
      { expiresIn: `${expiresIn}s` }
    );

    // Log de atividade
    await query(
      `INSERT INTO activity_logs (user_id, acao, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4)`,
      [user.id, 'login', ipAddress, userAgent]
    );

    res.json({
      success: true,
      token,
      session_id: sessionId,
      expiresIn: expiresIn,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        empresa: user.empresa,
        whatsapp: user.whatsapp
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao fazer login'
    });
  }
});

// ==================== ESQUECI A SENHA ====================
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const { email } = req.body;

    console.log(`\n📨 [FORGOT-PASSWORD] Solicitação recebida para: ${email}`);

    const result = await query(
      'SELECT id, nome FROM users WHERE email = $1 AND ativo = true',
      [email]
    );

    // Por segurança, sempre retorna sucesso mesmo se email não existir
    if (result.rows.length === 0) {
      console.log(`⚠️  [FORGOT-PASSWORD] Email não encontrado ou usuário inativo: ${email}`);
      return res.json({
        success: true,
        message: 'Se o email existir, você receberá instruções para redefinir a senha'
      });
    }

    const user = result.rows[0];
    const tokenReset = crypto.randomBytes(32).toString('hex');
    const tokenExpira = new Date(Date.now() + 3600000); // 1 hora

    console.log(`✓ [FORGOT-PASSWORD] Usuário encontrado: ${user.nome} (ID: ${user.id})`);
    console.log(`✓ [FORGOT-PASSWORD] Token gerado: ${tokenReset.substring(0, 10)}...`);

    // Salva token
    await query(
      'UPDATE users SET token_reset_senha = $1, token_reset_expira = $2 WHERE id = $3',
      [tokenReset, tokenExpira, user.id]
    );

    console.log(`✓ [FORGOT-PASSWORD] Token salvo no banco de dados`);

    // Envia email
    if (process.env.EMAIL_USER) {
      console.log(`📧 [FORGOT-PASSWORD] Iniciando envio de email...`);
      console.log(`   - Remetente: ${process.env.EMAIL_USER}`);
      console.log(`   - Destinatário: ${email}`);
      console.log(`   - Serviço: ${process.env.EMAIL_SERVICE}`);
      
      try {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: '🔐 Redefinição de Senha - Tuya Locks',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                <h2 style="color: white; margin: 0;">🔐 Tuya Locks</h2>
                <p style="color: rgba(255,255,255,0.9); margin: 0;">Redefinir Senha</p>
              </div>
              
              <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                <h3 style="color: #333;">Olá ${user.nome},</h3>
                
                <p style="color: #666; line-height: 1.6;">
                  Você solicitou a redefinição de sua senha. Clique no botão abaixo para criar uma nova senha:
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.APP_URL}/reset-password.html?token=${tokenReset}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                    Redefinir Minha Senha
                  </a>
                </div>
                
                <p style="color: #999; font-size: 12px;">
                  Ou copie e cole este link no seu navegador:<br>
                  <span style="word-break: break-all; color: #667eea;">${process.env.APP_URL}/reset-password.html?token=${tokenReset}</span>
                </p>
                
                <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #666; font-size: 13px;">
                    <strong>⏰ Atenção:</strong> Este link expira em <strong>1 hora</strong>. Se você não solicitou, ignore este email e sua senha permanecerá segura.
                  </p>
                </div>
                
                <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
                  Este é um email automático. Não responda a este email.
                </p>
              </div>
            </div>
          `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ [FORGOT-PASSWORD] Email enviado com sucesso!`);
        console.log(`   - Message ID: ${info.messageId}`);
        console.log(`   - Response: ${info.response}`);

      } catch (emailError) {
        console.error(`❌ [FORGOT-PASSWORD] Erro ao enviar email:`);
        console.error(`   - Mensagem: ${emailError.message}`);
        console.error(`   - Code: ${emailError.code}`);
        console.error(`   - Stack:`, emailError.stack);
        
        // Log completo para debug
        console.error(`\n🔍 Debug Info:`);
        console.error(`   - EMAIL_SERVICE: ${process.env.EMAIL_SERVICE}`);
        console.error(`   - EMAIL_HOST: ${process.env.EMAIL_HOST}`);
        console.error(`   - EMAIL_PORT: ${process.env.EMAIL_PORT}`);
        console.error(`   - EMAIL_USER: ${process.env.EMAIL_USER}`);
        console.error(`   - APP_URL: ${process.env.APP_URL}`);
        
        // Mesmo com erro, retorna sucesso por segurança
        return res.json({
          success: true,
          message: 'Se o email existir, você receberá instruções para redefinir a senha',
          debug: process.env.NODE_ENV === 'development' ? {
            emailError: emailError.message,
            note: 'Email não foi enviado - verifique logs do servidor'
          } : undefined
        });
      }
    } else {
      console.warn(`⚠️  [FORGOT-PASSWORD] EMAIL_USER não configurado - email não será enviado`);
    }

    res.json({
      success: true,
      message: 'Se o email existir, você receberá instruções para redefinir a senha'
    });

  } catch (error) {
    console.error('❌ [FORGOT-PASSWORD] Erro geral ao processar solicitação:');
    console.error(`   - Erro: ${error.message}`);
    console.error(`   - Stack:`, error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Erro ao processar solicitação'
    });
  }
});

// ==================== RESET DE SENHA ====================
router.post('/reset-password', [
  body('token').notEmpty(),
  body('senha').isLength({ min: 6 })
], async (req, res) => {
  try {
    const { token, senha } = req.body;

    const result = await query(
      `SELECT id FROM users 
       WHERE token_reset_senha = $1 
       AND token_reset_expira > NOW() 
       AND ativo = true`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Token inválido ou expirado'
      });
    }

    const userId = result.rows[0].id;
    const senhaHash = await bcrypt.hash(senha, 10);

    await query(
      `UPDATE users 
       SET senha_hash = $1, token_reset_senha = NULL, token_reset_expira = NULL 
       WHERE id = $2`,
      [senhaHash, userId]
    );

    res.json({
      success: true,
      message: 'Senha redefinida com sucesso!'
    });

  } catch (error) {
    console.error('Erro ao resetar senha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao redefinir senha'
    });
  }
});

// ==================== VERIFICAR EMAIL ====================
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await query(
      'UPDATE users SET email_verificado = true, token_verificacao = NULL WHERE token_verificacao = $1 RETURNING id',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).send('Token inválido ou expirado');
    }

    res.send('<h2>Email verificado com sucesso! Você já pode fazer login.</h2>');

  } catch (error) {
    console.error('Erro ao verificar email:', error);
    res.status(500).send('Erro ao verificar email');
  }
});

/**
 * POST /api/auth/verify-email
 * Verifica email via POST (para requisição JSON)
 * 
 * Body: { token }
 * 
 * @returns {object} { success, message, user }
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token não fornecido'
      });
    }

    const result = await query(
      'UPDATE users SET email_verificado = true, token_verificacao = NULL WHERE token_verificacao = $1 RETURNING id, nome, email',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Token inválido, expirado ou já utilizado'
      });
    }

    const user = result.rows[0];

    // Log de atividade
    await query(
      `INSERT INTO activity_logs (user_id, acao, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4)`,
      [user.id, 'email_confirmado', req.ip, req.headers['user-agent']]
    );

    console.log(`✅ Email confirmado para usuário: ${user.email}`);

    res.json({
      success: true,
      message: 'Email confirmado com sucesso! Sua conta foi ativada.',
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Erro ao verificar email (POST):', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao confirmar email'
    });
  }
});

// ==================== LOGOUT ====================
/**
 * POST /api/auth/logout
 * Invalida a sessão do usuário no banco de dados
 * 
 * Requer:
 * - Header: Authorization: Bearer <token>
 * - Header: X-Session-Id: <session_id>
 * 
 * @returns {object} { success, message }
 */
const { authenticateToken } = require('../middleware/auth');

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID não fornecido'
      });
    }

    // Invalida a sessão no banco
    const result = await query(
      'UPDATE user_sessions SET ativo = false WHERE user_id = $1 AND session_id = $2',
      [userId, sessionId]
    );

    // Log de atividade
    await query(
      `INSERT INTO activity_logs (user_id, acao, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4)`,
      [userId, 'logout', req.ip, req.headers['user-agent']]
    );

    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });

  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao fazer logout'
    });
  }
});

// ==================== VALIDAR SESSÃO ====================
/**
 * GET /api/auth/validate-session
 * Verifica se a sessão do usuário ainda está ativa e válida
 * 
 * Requer:
 * - Header: Authorization: Bearer <token>
 * - Header: X-Session-Id: <session_id>
 * 
 * Valida:
 * - Se session_id ainda existe no banco
 * - Se não foi expirada (12h)
 * - Se não foi invalidada por novo login
 * 
 * @returns {object} { success, valid: boolean, message? }
 */
router.get('/validate-session', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    const userId = req.user.id;

    if (!sessionId) {
      return res.json({
        success: true,
        valid: false,
        message: 'Session ID não fornecido'
      });
    }

    // Busca a sessão no banco
    const result = await query(
      `SELECT * FROM user_sessions 
       WHERE user_id = $1 AND session_id = $2 AND ativo = true`,
      [userId, sessionId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        valid: false,
        message: 'Sessão não encontrada ou foi invalidada'
      });
    }

    const session = result.rows[0];
    const now = new Date();
    const expiryTime = new Date(session.expires_at);

    // Verifica se a sessão expirou
    if (now > expiryTime) {
      await query(
        'UPDATE user_sessions SET ativo = false WHERE session_id = $1',
        [sessionId]
      );
      
      return res.json({
        success: true,
        valid: false,
        message: 'Sessão expirada'
      });
    }

    res.json({
      success: true,
      valid: true,
      expiresAt: expiryTime
    });

  } catch (error) {
    console.error('Erro ao validar sessão:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao validar sessão'
    });
  }
});

module.exports = router;