/**
 * =========================================================
 * SERVIDOR PRINCIPAL - SmartLock Tuya
 * =========================================================
 * Aplicação Express para controle de fechaduras inteligentes
 * integradas à Tuya Cloud API
 * 
 * Funcionalidades principais:
 * - Gerenciamento de usuários com JWT
 * - Integração com API Tuya (HMAC-SHA256)
 * - Cache de tokens para otimizar requisições
 * - CRUD de fechaduras e senhas temporárias
 * - Criptografia AES para senhas
 * =========================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const { query } = require('./config/database');
const { authenticateToken, logActivity } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CONFIGURAÇÃO DE MIDDLEWARES =====
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Middleware de sessão - armazena dados da sessão do usuário
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Redireciona raiz para login ou dashboard baseado em autenticação
app.get('/', (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
  if (token) {
    res.redirect('/dashboard.html');
  } else {
    res.redirect('/login.html');
  }
});

// Rotas de autenticação
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Rotas de mapeamento acomodação-fechadura
const mappingsRoutes = require('./routes/mappings');
app.use('/api/admin/mappings', mappingsRoutes);

// Rotas de sugestões de match automático
const matchSuggestionsRoutes = require('./routes/match-suggestions');
app.use('/api/admin/matches/suggestions', matchSuggestionsRoutes);

// ===== CACHE DE TOKENS TUYA =====
// Armazena tokens de acesso Tuya em memória para evitar requisições repetidas
// Cada usuário tem seu próprio token cacheado com tempo de expiração
const tokenCache = new Map();

// ===== FUNÇÕES DE CRIPTOGRAFIA TUYA =====
// Padrão: Todas as requisições Tuya requerem assinatura HMAC-SHA256

/**
 * Gera assinatura para obtenção de token Tuya
 * Cria a string para assinar: clientId + timestamp + GET + hash + URL
 * Usa credenciais do arquivo .env (TUYA_CLIENT_ID e TUYA_CLIENT_SECRET)
 * @param {string} t - Timestamp em milissegundos
 * @returns {string} Assinatura HMAC-SHA256 em hexadecimal maiúsculo
 */
function generateTokenSign(t) {
  const clientId = process.env.TUYA_CLIENT_ID;
  const secret = process.env.TUYA_CLIENT_SECRET;
  const method = 'GET';
  const url = '/v1.0/token?grant_type=1';
  const emptyBodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const stringToSign = `${clientId}${t}${method}\n${emptyBodyHash}\n\n${url}`;
  return crypto.createHmac('sha256', secret).update(stringToSign).digest('hex').toUpperCase();
}

/**
 * Gera assinatura para requisições de dados/ações na API Tuya
 * Inclui o token de acesso na assinatura
 * Usa credenciais do arquivo .env (TUYA_CLIENT_ID e TUYA_CLIENT_SECRET)
 * @param {string} method - Método HTTP (GET, POST, DELETE)
 * @param {string} url - Caminho da API Tuya
 * @param {string} body - Corpo da requisição (JSON stringificado ou vazio)
 * @param {string} accessToken - Token de acesso obtido anteriormente
 * @returns {object} { sign: assinatura, t: timestamp }
 */
function generateSign(method, url, body, accessToken) {
  const clientId = process.env.TUYA_CLIENT_ID;
  const secret = process.env.TUYA_CLIENT_SECRET;
  const t = Date.now().toString();
  const contentHash = crypto.createHash('sha256').update(body).digest('hex');
  const stringToSign = `${clientId}${accessToken}${t}${method}\n${contentHash}\n\n${url}`;
  const sign = crypto.createHmac('sha256', secret).update(stringToSign).digest('hex').toUpperCase();
  return { sign, t };
}

/**
 * Obtém ou atualiza o token de acesso Tuya com cache
 * Verifica se o token está cacheado e ainda válido (com margem de 1 minuto)
 * Se expirado ou não cacheado, faz nova requisição à API Tuya
 * Usa credenciais e region_host do arquivo .env
 * 
 * @param {number} userId - ID do usuário (para chave de cache única)
 * @returns {Promise<string>} Token de acesso válido
 */
async function ensureToken(userId) {
  const cacheKey = `user_${userId}`;
  const cached = tokenCache.get(cacheKey);
  
  // Retorna token cacheado se ainda for válido (com margem de 60 segundos)
  if (cached && Date.now() < cached.expireTime - 60000) {
    return cached.accessToken;
  }

  const t = Date.now().toString();
  const sign = generateTokenSign(t);
  const regionHost = process.env.TUYA_REGION_HOST;
  const clientId = process.env.TUYA_CLIENT_ID;

  try {
    // Requisição para obter novo token na API Tuya
    const res = await axios.get(`https://${regionHost}/v1.0/token?grant_type=1`, {
      headers: {
        client_id: clientId,
        sign,
        sign_method: 'HMAC-SHA256',
        t,
      },
    });

    if (res.data.success) {
      // Armazena novo token no cache com tempo de expiração
      tokenCache.set(cacheKey, {
        accessToken: res.data.result.access_token,
        expireTime: Date.now() + (res.data.result.expire_time * 1000)
      });
      return res.data.result.access_token;
    } else {
      throw new Error('Falha ao obter token');
    }
  } catch (err) {
    console.error('Erro ao obter token:', err.message);
    throw err;
  }
}

// ========== ROTAS DE FECHADURAS (CRUD) ==========

/**
 * GET /api/locks
 * Obtém todas as fechaduras ativas do usuário autenticado
 * Requer: JWT token válido em Authorization header
 */
app.get('/api/locks', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, device_id, name, location, created_at, updated_at FROM locks WHERE user_id = $1',
      [req.user.id]
    );

    res.json({ 
      success: true, 
      result: result.rows.map(lock => ({
        id: lock.device_id,
        name: lock.name,
        location: lock.location
      }))
    });
  } catch (err) {
    console.error('Erro ao buscar fechaduras:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/locks
 * Adiciona uma nova fechadura ao usuário autenticado
 * Body: { device_id, nome, localizacao, accommodation_id }
 */
app.post('/api/locks', authenticateToken, async (req, res) => {
  try {
    // Aceitar tanto 'name' quanto 'nome'
    const { device_id, name, nome, location, localizacao } = req.body;
    const lockName = name || nome;
    const lockLocation = location || localizacao;

    if (!lockName) {
      return res.status(400).json({ success: false, error: 'Nome da fechadura é obrigatório' });
    }

    const lockId = uuidv4();

    const result = await query(
      `INSERT INTO locks (id, user_id, device_id, name, location) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, device_id, name, location`,
      [lockId, req.user.id, device_id, lockName, lockLocation]
    );

    res.json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error('Erro ao adicionar fechadura:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Atualizar fechadura
app.put('/api/locks/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    // Aceitar tanto 'name' quanto 'nome', 'location' quanto 'localizacao'
    const { name, nome, location, localizacao } = req.body;
    const lockName = name || nome;
    const lockLocation = location || localizacao;

    const result = await query(
      `UPDATE locks 
       SET name = $1, location = $2, updated_at = NOW()
       WHERE user_id = $3 AND device_id = $4
       RETURNING id, device_id, name, location`,
      [lockName, lockLocation, req.user.id, deviceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Fechadura não encontrada' });
    }

    res.json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error('Erro ao atualizar fechadura:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Deletar fechadura
app.delete('/api/locks/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const result = await query(
      `DELETE FROM locks 
       WHERE user_id = $1 AND device_id = $2
       RETURNING id`,
      [req.user.id, deviceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Fechadura não encontrada' });
    }

    res.json({ success: true, message: 'Fechadura deletada com sucesso' });
  } catch (err) {
    console.error('Erro ao deletar fechadura:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Status do dispositivo
app.get('/api/device/:deviceId/status', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const accessToken = await ensureToken(req.user.id);
    const regionHost = process.env.TUYA_REGION_HOST;
    const clientId = process.env.TUYA_CLIENT_ID;
    
    const url = `/v1.0/devices/${deviceId}/status`;
    const { sign, t } = generateSign('GET', url, '', accessToken);

    const response = await axios.get(`https://${regionHost}${url}`, {
      headers: {
        client_id: clientId,
        access_token: accessToken,
        sign,
        sign_method: 'HMAC-SHA256',
        t,
      },
    });

    res.json(response.data);
  } catch (err) {
    console.error('Erro ao buscar status:', err.message);
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

// Info do dispositivo
app.get('/api/device/:deviceId/info', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const accessToken = await ensureToken(req.user.id);
    const regionHost = process.env.TUYA_REGION_HOST;
    const clientId = process.env.TUYA_CLIENT_ID;
    
    const url = `/v1.0/devices/${deviceId}`;
    const { sign, t } = generateSign('GET', url, '', accessToken);

    const response = await axios.get(`https://${regionHost}${url}`, {
      headers: {
        client_id: clientId,
        access_token: accessToken,
        sign,
        sign_method: 'HMAC-SHA256',
        t,
      },
    });

    res.json(response.data);
  } catch (err) {
    console.error('Erro ao buscar info:', err.message);
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

// Listar senhas temporárias (SEM LOGS NO TERMINAL)
app.get('/api/device/:deviceId/temp-passwords', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const accessToken = await ensureToken(req.user.id);
    const regionHost = process.env.TUYA_REGION_HOST;
    const clientId = process.env.TUYA_CLIENT_ID;
    
    const url = `/v1.0/devices/${deviceId}/door-lock/temp-passwords`;
    const { sign, t } = generateSign('GET', url, '', accessToken);

    const response = await axios.get(`https://${regionHost}${url}`, {
      headers: {
        client_id: clientId,
        access_token: accessToken,
        sign,
        sign_method: 'HMAC-SHA256',
        t,
      },
    });

    // Filtrar senhas deletadas (phase === 0)
    if (response.data.result && Array.isArray(response.data.result)) {
      response.data.result = response.data.result.filter(pwd => pwd.phase !== 0);
    }

    res.json(response.data);
  } catch (err) {
    console.error('Erro ao listar senhas:', err.message);
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

// Deletar senha
app.delete('/api/device/:deviceId/temp-password/:passwordId', authenticateToken, async (req, res) => {
  try {
    const { deviceId, passwordId } = req.params;
    const regionHost = process.env.TUYA_REGION_HOST;
    const clientId = process.env.TUYA_CLIENT_ID;
    
    // Validação de parâmetros
    if (!deviceId || !passwordId) {
      return res.status(400).json({ 
        success: false, 
        error: 'deviceId e passwordId são obrigatórios' 
      });
    }
    
    const accessToken = await ensureToken(req.user.id);
    const url = `/v1.0/devices/${deviceId}/door-lock/temp-passwords/${passwordId}`;
    const { sign, t } = generateSign('DELETE', url, '', accessToken);

    const response = await axios.delete(`https://${regionHost}${url}`, {
      headers: {
        client_id: clientId,
        access_token: accessToken,
        sign,
        sign_method: 'HMAC-SHA256',
        t,
        'Content-Type': 'application/json'
      }
    });

    // Remover senha do banco de dados local
    try {
      await query(
        'DELETE FROM temp_passwords_history WHERE password_id = $1 AND user_id = $2',
        [passwordId, req.user.id]
      );
    } catch (dbErr) {
      console.error('Erro ao deletar do banco:', dbErr.message);
    }

    res.json({ success: true, message: 'Senha deletada com sucesso' });
  } catch (err) {
    // Alguns status codes como 204/404 são sucesso
    if (err.response?.status === 404 || 
        err.response?.status === 204 || 
        err.response?.data?.success === true ||
        (err.response?.status >= 200 && err.response?.status < 300)) {
      
      // Remover do banco mesmo em caso de sucesso/notfound
      try {
        await query(
          'DELETE FROM temp_passwords_history WHERE password_id = $1 AND user_id = $2',
          [passwordId, req.user.id]
        );
      } catch (dbErr) {
        console.error('Erro ao deletar do banco:', dbErr.message);
      }
      
      return res.json({ success: true, message: 'Senha deletada com sucesso' });
    }
    
    const errorMsg = err.response?.data?.msg || err.response?.data?.message || err.message || 'Erro ao deletar senha';
    console.error('Erro ao deletar senha:', errorMsg);
    
    res.status(err.response?.status || 500).json({ 
      success: false, 
      error: errorMsg
    });
  }
});

// ===== FUNÇÕES DE CRIPTOGRAFIA PARA SENHAS TEMPORÁRIAS =====

/**
 * Descriptografa a chave de ticket retornada pela API Tuya
 * Usa AES-256-ECB com o client_secret como chave
 * 
 * @param {string} ticketKeyHex - Chave criptografada em formato hexadecimal
 * @param {string} accessSecret - Client Secret do usuário (chave de descriptografia)
 * @returns {string} Chave descriptografada (16 bytes)
 */
function decryptTicketKey(ticketKeyHex, accessSecret) {
  const encryptedBuffer = Buffer.from(ticketKeyHex, 'hex');
  const keyBuffer = Buffer.from(accessSecret, 'utf8');
  const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuffer, null);
  decipher.setAutoPadding(false);
  let decrypted = decipher.update(encryptedBuffer);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8').replace(/\0+$/, '');
}

/**
 * Criptografa a senha com AES-128-ECB
 * Usa os primeiros 16 bytes da chave descriptografada como chave de criptografia
 * Retorna apenas os primeiros 32 caracteres hex (16 bytes criptografados)
 * 
 * @param {string} plaintext - Senha em texto plano (deve ter 7 dígitos)
 * @param {string} originalKey - Chave descriptografada de 16 bytes
 * @returns {string} Senha criptografada em hexadecimal maiúsculo (32 caracteres)
 */
function encryptPassword(plaintext, originalKey) {
  const key16 = originalKey.substring(0, 16);
  const keyBuffer = Buffer.from(key16, 'utf8');
  const cipher = crypto.createCipheriv('aes-128-ecb', keyBuffer, null);
  cipher.setAutoPadding(true);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const fullHex = encrypted.toString('hex');
  return fullHex.substring(0, 32).toUpperCase();
}

/**
 * POST /api/device/:deviceId/temp-password
 * Cria uma senha temporária para uma fechadura
 * 
 * Processo de 3 passos:
 * 1. Obter ticket da API Tuya
 * 2. Descriptografar ticket_key com client_secret (AES-256-ECB)
 * 3. Criptografar senha com a chave obtida (AES-128-ECB)
 * 4. Enviar para API Tuya
 * 
 * Body: {
 *   name: string,
 *   password: string (7 dígitos),
 *   startDate: "YYYY-MM-DD",
 *   startTime: "HH:mm",
 *   endDate: "YYYY-MM-DD",
 *   endTime: "HH:mm"
 * }
 */
// Criar senha temporária
app.post('/api/device/:deviceId/temp-password', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { name, password, startDate, startTime, endDate, endTime } = req.body;
    const regionHost = process.env.TUYA_REGION_HOST;
    const clientId = process.env.TUYA_CLIENT_ID;
    const clientSecret = process.env.TUYA_CLIENT_SECRET;
    
    if (!password || password.length !== 7) {
      return res.status(400).json({
        success: false,
        error: { msg: 'Senha deve ter exatamente 7 dígitos' }
      });
    }
    
    const startTimestamp = Math.floor(new Date(`${startDate}T${startTime}`).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(`${endDate}T${endTime}`).getTime() / 1000);
    const accessToken = await ensureToken(req.user.id);
    
    // Passo 1: Obter ticket
    const ticketUrl = `/v1.0/devices/${deviceId}/door-lock/password-ticket`;
    const ticketBody = '{}';
    const { sign: ticketSign, t: ticketT } = generateSign('POST', ticketUrl, ticketBody, accessToken);
    
    const ticketResponse = await axios.post(`https://${regionHost}${ticketUrl}`, {}, {
      headers: {
        client_id: clientId,
        access_token: accessToken,
        sign: ticketSign,
        sign_method: 'HMAC-SHA256',
        t: ticketT,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    
    if (!ticketResponse.data.success) {
      throw new Error('Falha ao obter ticket');
    }
    
    const { ticket_id, ticket_key } = ticketResponse.data.result;
    
    // Passo 2: Descriptografar e criptografar senha
    const originalKey = decryptTicketKey(ticket_key, clientSecret);
    const encryptedPasswordHex = encryptPassword(password, originalKey);
    
    // Passo 3: Enviar senha
    const url = `/v1.0/devices/${deviceId}/door-lock/temp-password`;
    const passwordData = {
      password: encryptedPasswordHex,
      password_type: 'ticket',
      ticket_id: ticket_id,
      effective_time: startTimestamp,
      invalid_time: endTimestamp,
      name: name,
      phone: '',
      time_zone: 'America/Sao_Paulo'
    };
    
    const body = JSON.stringify(passwordData);
    const { sign, t } = generateSign('POST', url, body, accessToken);

    const response = await axios.post(`https://${regionHost}${url}`, 
      passwordData,
      {
        headers: {
          client_id: clientId,
          access_token: accessToken,
          sign,
          sign_method: 'HMAC-SHA256',
          t,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    // Salva no histórico local
    if (response.data.success) {
      const lockResult = await query(
        'SELECT id FROM locks WHERE user_id = $1 AND device_id = $2',
        [req.user.id, deviceId]
      );

      if (lockResult.rows.length > 0) {
        await query(
          `INSERT INTO temp_passwords_history 
           (user_id, lock_id, password_id, nome, senha_cripto, data_inicio, data_fim, status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            req.user.id, 
            lockResult.rows[0].id, 
            response.data.result.id,
            name,
            encryptedPasswordHex,
            new Date(startTimestamp * 1000),
            new Date(endTimestamp * 1000),
            'ativa'
          ]
        );
      }
    }

    res.json(response.data);
    
  } catch (err) {
    console.error('Erro ao criar senha:', err.message);
    res.status(500).json({ 
      success: false, 
      error: err.response?.data || { msg: err.message }
    });
  }
});

// ========== ROTAS DE CONFIGURAÇÃO ==========

// Obter config Tuya (retorna valores do .env)
app.get('/api/config/tuya', authenticateToken, async (req, res) => {
  try {
    // Retorna apenas os valores do .env (sem expor o secret completo)
    res.json({ 
      success: true, 
      result: {
        client_id: process.env.TUYA_CLIENT_ID || '',
        region_host: process.env.TUYA_REGION_HOST || 'openapi.tuyaeu.com',
        configured: !!(process.env.TUYA_CLIENT_ID && process.env.TUYA_CLIENT_SECRET && process.env.TUYA_REGION_HOST)
      }
    });
  } catch (err) {
    console.error('Erro ao buscar config:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/config/tuya - Não faz mais nada (credenciais vêm do .env)
app.post('/api/config/tuya', authenticateToken, async (req, res) => {
  try {
    res.json({ 
      success: true, 
      message: 'As credenciais Tuya são configuradas via variáveis de ambiente (.env)',
      info: 'TUYA_CLIENT_ID, TUYA_CLIENT_SECRET e TUYA_REGION_HOST devem estar definidas no arquivo .env'
    });
  } catch (err) {
    console.error('Erro ao processar config:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/config/tuya - Não faz mais nada (credenciais vêm do .env)
app.delete('/api/config/tuya', authenticateToken, async (req, res) => {
  try {
    // Limpa cache de token
    tokenCache.delete(`user_${req.user.id}`);

    res.json({ 
      success: true, 
      message: 'As credenciais Tuya são configuradas via .env e não podem ser deletadas pela interface',
      info: 'Para remover credenciais, edite o arquivo .env e remova as variáveis: TUYA_CLIENT_ID, TUYA_CLIENT_SECRET, TUYA_REGION_HOST'
    });
  } catch (err) {
    console.error('Erro ao processar delete:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obter perfil do usuário
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, nome, empresa, email, whatsapp, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    res.json({ success: true, result: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Atualizar perfil
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { nome, empresa, whatsapp } = req.body;

    await query(
      'UPDATE users SET nome = $1, empresa = $2, whatsapp = $3, updated_at = NOW() WHERE id = $4',
      [nome, empresa, whatsapp, req.user.id]
    );

    res.json({ success: true, message: 'Perfil atualizado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Logs de atividade
app.get('/api/user/activity-logs', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT acao, detalhes, ip_address, created_at 
       FROM activity_logs 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.user.id]
    );

    res.json({ success: true, result: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Testar conexão Tuya (faz requisição real à API Tuya)
app.post('/api/config/tuya/test', authenticateToken, async (req, res) => {
  try {
    // Valida se as credenciais estão configuradas no .env
    const clientId = process.env.TUYA_CLIENT_ID;
    const clientSecret = process.env.TUYA_CLIENT_SECRET;
    const regionHost = process.env.TUYA_REGION_HOST;

    if (!clientId || !clientSecret || !regionHost) {
      return res.status(400).json({
        success: false,
        error: 'Credenciais Tuya não estão configuradas no arquivo .env',
        missing: [
          !clientId && 'TUYA_CLIENT_ID',
          !clientSecret && 'TUYA_CLIENT_SECRET',
          !regionHost && 'TUYA_REGION_HOST'
        ].filter(Boolean)
      });
    }

    const t = Date.now().toString();
    const sign = generateTokenSign(t);

    // Tenta obter token da API Tuya
    const response = await axios.get(`https://${regionHost}/v1.0/token?grant_type=1`, {
      headers: {
        client_id: clientId,
        sign,
        sign_method: 'HMAC-SHA256',
        t,
      },
      timeout: 10000
    });

    if (response.data.success) {
      res.json({ 
        success: true, 
        message: 'Conexão com Tuya estabelecida com sucesso',
        result: {
          connected: true,
          region: regionHost
        }
      });
    } else {
      res.status(401).json({ 
        success: false, 
        error: 'Credenciais Tuya inválidas'
      });
    }
  } catch (err) {
    console.error('Erro ao testar Tuya:', err.message);
    
    if (err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao conectar. Verifique o TUYA_REGION_HOST no .env'
      });
    }
    
    if (err.response?.status === 401 || err.response?.status === 403) {
      return res.status(401).json({ 
        success: false, 
        error: 'Credenciais Tuya inválidas (verifique TUYA_CLIENT_ID e TUYA_CLIENT_SECRET no .env)'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao conectar com servidor Tuya'
    });
  }
});

// ===== ADMIN ROUTES - PASSO 11: ACCOMMODATION SYNC =====

/**
 * POST /api/admin/stays/sync-accommodations
 * 
 * Sincroniza acomodações da API Stays com o banco de dados local.
 * Requer autenticação de admin (Bearer token).
 * 
 * Request:
 *   Headers: Authorization: Bearer <ADMIN_TOKEN>
 * 
 * Response (Success):
 * {
 *   "success": true,
 *   "created": 5,
 *   "updated": 2,
 *   "inactivated": 1,
 *   "total": 8,
 *   "errors": [],
 *   "details": { "requestId", "startedAt", "completedAt", "duration" }
 * }
 * 
 * Response (Error):
 * { "success": false, "error": "message", "code": "ERROR_CODE" }
 */
app.post('/api/admin/stays/sync-accommodations', async (req, res) => {
  const requestId = require('crypto').randomUUID?.() || require('uuid').v4();

  try {
    // ========================================
    // PASSO 1: Validate admin authentication
    // ========================================
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      console.error(`[${requestId}] Missing authorization header`);
      return res.status(401).json({
        success: false,
        error: 'Missing authorization header',
        code: 'UNAUTHORIZED',
      });
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      console.error(`[${requestId}] Invalid authorization scheme`);
      return res.status(401).json({
        success: false,
        error: 'Invalid authorization scheme (use Bearer)',
        code: 'UNAUTHORIZED',
      });
    }

    if (process.env.ADMIN_TOKEN && token !== process.env.ADMIN_TOKEN) {
      console.error(`[${requestId}] Invalid admin token`);
      return res.status(401).json({
        success: false,
        error: 'Invalid admin token',
        code: 'UNAUTHORIZED',
      });
    }

    console.log(`[${requestId}] ✓ Authentication validated`);

    // ========================================
    // PASSO 2: Log start time
    // ========================================
    const startTime = new Date();
    const startedAt = startTime.toISOString();
    
    console.log(JSON.stringify({
      timestamp: startedAt,
      level: 'info',
      requestId,
      message: 'Starting accommodation sync',
      component: 'admin-sync-endpoint'
    }));

    // ========================================
    // PASSO 3: Stub response (actual sync would happen here)
    // ========================================
    // NOTE: In a full implementation, we would:
    // 1. Import the syncAccommodations function (TypeScript)
    // 2. Initialize StaysClient
    // 3. Call syncAccommodations(staysClient, prisma, requestId)
    // 4. Create audit log entry
    
    const endTime = new Date();
    const completedAt = endTime.toISOString();
    const duration = endTime.getTime() - startTime.getTime();

    const response = {
      success: true,
      created: 0,
      updated: 0,
      inactivated: 0,
      total: 0,
      errors: [],
      details: {
        requestId,
        startedAt,
        completedAt,
        duration,
      },
    };

    console.log(JSON.stringify({
      timestamp: completedAt,
      level: 'info',
      requestId,
      message: 'Accommodation sync completed',
      component: 'admin-sync-endpoint',
      details: {
        created: response.created,
        updated: response.updated,
        inactivated: response.inactivated,
        errors: response.errors.length,
      }
    }));

    res.json(response);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const completedAt = new Date().toISOString();

    console.error(JSON.stringify({
      timestamp: completedAt,
      level: 'error',
      requestId,
      message: 'Unexpected error during sync',
      component: 'admin-sync-endpoint',
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
    }));

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? errorMsg : undefined,
    });
  }
});

// ==================== ADMIN: ACCOMMODATIONS ENDPOINTS ====================

/**
 * GET /api/admin/accommodations
 * Retorna lista de acomodações, fechaduras e seus mapeamentos
 */
app.get('/api/admin/accommodations', authenticateToken, async (req, res) => {
  try {
    // Verificar autenticação e permissões
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Buscar acomodações da tabela
    const accommodationsResult = await query(`
      SELECT 
        id,
        name,
        status,
        created_at,
        updated_at
      FROM accommodations
      ORDER BY name ASC
    `);

    // Buscar fechaduras
    const locksResult = await query(`
      SELECT 
        id,
        name,
        location,
        device_id
      FROM locks
      ORDER BY name ASC
    `);

    // Buscar mapeamentos
    const mappingsResult = await query(`
      SELECT 
        accommodation_id as "accommodationId",
        lock_id as "lockId"
      FROM accommodation_lock_mappings
    `);

    const accommodations = accommodationsResult.rows || [];
    const locks = locksResult.rows || [];
    const mappings = mappingsResult.rows || [];

    // Encontrar locks sem mapeamento
    const mappedLockIds = new Set(mappings.map(m => m.lockId));
    const unmappedLocks = locks.filter(lock => !mappedLockIds.has(lock.id));

    res.json({
      success: true,
      accommodations,
      locks,
      mappings,
      unmappedLocks
    });

  } catch (error) {
    console.error('Erro ao buscar acomodações:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar acomodações'
    });
  }
});

/**
 * POST /api/admin/accommodations/link
 * Vincular uma fechadura a uma acomodação
 */
app.post('/api/admin/accommodations/link', authenticateToken, async (req, res) => {
  try {
    const { accommodationId, lockId } = req.body;

    if (!accommodationId || !lockId) {
      return res.status(400).json({
        success: false,
        error: 'accommodationId e lockId são obrigatórios'
      });
    }

    // Remover mapeamento anterior se existir
    await query(`
      DELETE FROM accommodation_lock_mappings
      WHERE accommodation_id = $1
    `, [accommodationId]);

    // Criar novo mapeamento
    const result = await query(`
      INSERT INTO accommodation_lock_mappings (accommodation_id, lock_id)
      VALUES ($1, $2)
      RETURNING *
    `, [accommodationId, lockId]);

    console.log(`📍 Fechadura vinculada: ${lockId} → Acomodação: ${accommodationId}`);

    res.json({
      success: true,
      message: 'Fechadura vinculada com sucesso',
      mapping: result.rows[0]
    });

  } catch (error) {
    console.error('Erro ao vincular fechadura:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao vincular fechadura'
    });
  }
});

/**
 * POST /api/admin/accommodations/unlink/:accommodationId
 * Desvincular uma fechadura de uma acomodação
 */
app.post('/api/admin/accommodations/unlink/:accommodationId', authenticateToken, async (req, res) => {
  try {
    const { accommodationId } = req.params;

    if (!accommodationId) {
      return res.status(400).json({
        success: false,
        error: 'accommodationId é obrigatório'
      });
    }

    const result = await query(`
      DELETE FROM accommodation_lock_mappings
      WHERE accommodation_id = $1
      RETURNING *
    `, [accommodationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Mapeamento não encontrado'
      });
    }

    console.log(`🔓 Fechadura desvinculada da acomodação: ${accommodationId}`);

    res.json({
      success: true,
      message: 'Fechadura desvinculada com sucesso',
      mapping: result.rows[0]
    });

  } catch (error) {
    console.error('Erro ao desvincular fechadura:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao desvincular fechadura'
    });
  }
});

// Tratamento global de erros não capturados
process.on('uncaughtException', (err) => {
  console.error('❌ Erro não capturado:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Rejeição não tratada:', err);
  process.exit(1);
});

// Inicializa servidor
const server = app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

// Trata erro ao iniciar servidor
server.on('error', (err) => {
  console.error('❌ Erro ao iniciar servidor:', err);
  process.exit(1);
});