const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/database');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');

// Configurar transporte de email
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

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
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email já cadastrado'
      });
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);
    
    // Token de verificação de email
    const tokenVerificacao = crypto.randomBytes(32).toString('hex');

    // Insere usuário
    const result = await query(
      `INSERT INTO users (nome, empresa, email, whatsapp, senha_hash, token_verificacao)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nome, email, empresa`,
      [nome, empresa || null, email, whatsapp || null, senhaHash, tokenVerificacao]
    );

    const user = result.rows[0];

    // Envia email de verificação (opcional)
    if (process.env.EMAIL_USER) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Verificação de Email - Tuya Locks',
          html: `
            <h2>Bem-vindo ao Sistema Tuya Locks!</h2>
            <p>Olá ${nome},</p>
            <p>Para verificar seu email, clique no link abaixo:</p>
            <a href="${process.env.APP_URL}/api/auth/verify-email/${tokenVerificacao}">Verificar Email</a>
          `
        });
      } catch (emailError) {
        console.error('Erro ao enviar email:', emailError);
        // Continua mesmo se o email falhar
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

    // Gera token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Log de atividade
    await query(
      `INSERT INTO activity_logs (user_id, acao, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4)`,
      [user.id, 'login', req.ip, req.headers['user-agent']]
    );

    res.json({
      success: true,
      token,
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

    const result = await query(
      'SELECT id, nome FROM users WHERE email = $1 AND ativo = true',
      [email]
    );

    // Por segurança, sempre retorna sucesso mesmo se email não existir
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Se o email existir, você receberá instruções para redefinir a senha'
      });
    }

    const user = result.rows[0];
    const tokenReset = crypto.randomBytes(32).toString('hex');
    const tokenExpira = new Date(Date.now() + 3600000); // 1 hora

    // Salva token
    await query(
      'UPDATE users SET token_reset_senha = $1, token_reset_expira = $2 WHERE id = $3',
      [tokenReset, tokenExpira, user.id]
    );

    // Envia email
    if (process.env.EMAIL_USER) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Redefinição de Senha - Tuya Locks',
        html: `
          <h2>Redefinição de Senha</h2>
          <p>Olá ${user.nome},</p>
          <p>Você solicitou a redefinição de senha. Clique no link abaixo:</p>
          <a href="${process.env.APP_URL}/reset-password.html?token=${tokenReset}">Redefinir Senha</a>
          <p>Este link expira em 1 hora.</p>
          <p>Se você não solicitou, ignore este email.</p>
        `
      });
    }

    res.json({
      success: true,
      message: 'Se o email existir, você receberá instruções para redefinir a senha'
    });

  } catch (error) {
    console.error('Erro ao solicitar reset:', error);
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

module.exports = router;