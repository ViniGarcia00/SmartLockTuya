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
 * 3. Busca usuário no banco de dados
 * 4. Popula req.user com dados do usuário
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

/**
 * Middleware: Verifica se usuário possui configuração Tuya ativa
 * 
 * Função:
 * 1. Busca configurações Tuya do usuário autenticado
 * 2. Verifica se estão ativas
 * 3. Popula req.tuyaConfig com os dados
 * 
 * Usado em: Rotas que necessitam acessar API Tuya
 * Deve ser usado APÓS authenticateToken
 * 
 * @middleware requireTuyaConfig
 */
// Middleware para verificar se usuário tem configuração Tuya
const requireTuyaConfig = async (req, res, next) => {
  try {
    console.log(`🔐 Verificando config Tuya para user_id: ${req.user.id}`);
    
    const result = await query(
      'SELECT * FROM tuya_configs WHERE user_id = $1 AND ativo = true',
      [req.user.id]
    );

    console.log(`📋 Configs Tuya encontradas: ${result.rows.length}`);

    if (result.rows.length === 0) {
      console.log('❌ Nenhuma configuração Tuya encontrada');
      return res.status(400).json({
        success: false,
        error: 'Configure suas credenciais Tuya antes de continuar',
        redirect: '/settings.html#tuya'
      });
    }

    req.tuyaConfig = result.rows[0];
    console.log(`✅ Config Tuya carregada para region: ${req.tuyaConfig.region_host}`);
    next();
  } catch (error) {
    console.error('Erro ao verificar config Tuya:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao verificar configuração Tuya' 
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
  requireTuyaConfig,
  logActivity
};