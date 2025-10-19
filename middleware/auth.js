const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Middleware para verificar autenticação
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token não fornecido' 
      });
    }

    // Verifica o token
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ 
          success: false, 
          error: 'Token inválido ou expirado' 
        });
      }

      // Busca o usuário no banco
      const result = await query(
        'SELECT id, nome, email, empresa, ativo FROM users WHERE id = $1 AND ativo = true',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ 
          success: false, 
          error: 'Usuário não encontrado ou inativo' 
        });
      }

      req.user = result.rows[0];
      next();
    });
  } catch (error) {
    console.error('Erro na autenticação:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao verificar autenticação' 
    });
  }
};

// Middleware para verificar se usuário tem configuração Tuya
const requireTuyaConfig = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM tuya_configs WHERE user_id = $1 AND ativo = true',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Configure suas credenciais Tuya antes de continuar',
        redirect: '/settings.html#tuya'
      });
    }

    req.tuyaConfig = result.rows[0];
    next();
  } catch (error) {
    console.error('Erro ao verificar config Tuya:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao verificar configuração Tuya' 
    });
  }
};

// Log de atividades
const logActivity = (action, details = {}) => {
  return async (req, res, next) => {
    try {
      const userId = req.user ? req.user.id : null;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await query(
        `INSERT INTO activity_logs (user_id, acao, detalhes, ip_address, user_agent) 
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, action, JSON.stringify(details), ipAddress, userAgent]
      );
    } catch (error) {
      console.error('Erro ao registrar log:', error);
      // Não bloqueia a requisição se o log falhar
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  requireTuyaConfig,
  logActivity
};