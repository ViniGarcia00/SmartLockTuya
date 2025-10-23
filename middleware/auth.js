/**
 * =========================================================
 * MIDDLEWARE DE AUTENTICAÇÃO E AUTORIZAÇÃO
 * =========================================================
 * Validação de tokens JWT, verificação de configurações Tuya
 * e registro de atividades do sistema
 * =========================================================
 */

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

/**
 * Middleware: Valida JWT e carrega dados do usuário
 * 
 * Função:
 * 1. Extrai token do header Authorization (formato: "Bearer TOKEN")
 * 2. Valida assinatura do token com JWT_SECRET
 * 3. Valida session_id da requisição
 * 4. Verifica se a sessão ainda está ativa no banco
 * 5. Verifica se não foi invalidada por novo login em outro lugar
 * 6. Busca usuário no banco de dados
 * 7. Popula req.user com dados do usuário
 * 
 * Rejeita requisição se:
 * - Token não foi fornecido
 * - Token é inválido ou expirou
 * - Session ID não foi fornecido
 * - Sessão foi invalidada (login em outro lugar)
 * - Sessão expirou (12h)
 * - Usuário não existe ou é inativo
 * 
 * Usado em: Todas as rotas protegidas que requerem autenticação
 * 
 * @middleware authenticateToken
 */
// Middleware para verificar autenticação
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    const sessionId = req.headers['x-session-id']; // Session ID do frontend

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token não fornecido' 
      });
    }

    if (!sessionId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Session ID não fornecido' 
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

      // ===== VALIDAÇÃO DE SESSÃO =====
      // Verifica se a sessão está ativa no banco e não foi invalidada
      const sessionResult = await query(
        `SELECT * FROM user_sessions 
         WHERE user_id = $1 AND session_id = $2 AND ativo = true`,
        [decoded.userId, sessionId]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(403).json({ 
          success: false, 
          error: 'Sessão inválida. Você foi desconectado de outro dispositivo ou a sessão expirou.',
          code: 'SESSION_INVALIDATED'
        });
      }

      const session = sessionResult.rows[0];
      const now = new Date();
      const expiryTime = new Date(session.expires_at);

      // Verifica se a sessão expirou
      if (now > expiryTime) {
        await query(
          'UPDATE user_sessions SET ativo = false WHERE session_id = $1',
          [sessionId]
        );

        return res.status(403).json({ 
          success: false, 
          error: 'Sessão expirada. Por favor, faça login novamente.',
          code: 'SESSION_EXPIRED'
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
      req.sessionId = sessionId;
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

/**
 * Middleware: Registra atividades do usuário no banco de dados
 * 
 * Função:
 * 1. Extrai dados do usuário (se autenticado)
 * 2. Captura IP da requisição
 * 3. Captura User-Agent (navegador/cliente)
 * 4. Insere registro na tabela activity_logs
 * 
 * Uso: logActivity('NOME_ACAO', { detalhes: 'opcionais' })
 * 
 * Exemplo:
 *   app.post('/api/locks', authenticateToken, logActivity('CREATE_LOCK'), (req, res) => {...})
 * 
 * @middleware logActivity
 */
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
  logActivity
};