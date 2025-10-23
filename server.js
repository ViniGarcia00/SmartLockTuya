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
      'SELECT id, device_id, nome, localizacao, accommodation_id, senha_principal, ativo FROM locks WHERE user_id = $1 AND ativo = true',
      [req.user.id]
    );

    res.json({ 
      success: true, 
      result: result.rows.map(lock => ({
        id: lock.device_id,
        name: lock.nome,
        location: lock.localizacao,
        accommodation_id: lock.accommodation_id,
        master_password: lock.senha_principal
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
    const { device_id, nome, localizacao, accommodation_id, senha_principal } = req.body;

    const result = await query(
      `INSERT INTO locks (user_id, device_id, nome, localizacao, accommodation_id, senha_principal) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, device_id, nome, localizacao, accommodation_id, senha_principal`,
      [req.user.id, device_id, nome, localizacao, accommodation_id, senha_principal]
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
    const { nome, localizacao, accommodation_id, senha_principal } = req.body;

    const result = await query(
      `UPDATE locks 
       SET nome = $1, localizacao = $2, accommodation_id = $3, senha_principal = $4, updated_at = NOW()
       WHERE user_id = $5 AND device_id = $6
       RETURNING id, device_id, nome, localizacao, accommodation_id, senha_principal`,
      [nome, localizacao, accommodation_id, senha_principal, req.user.id, deviceId]
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

    console.log(`📋 GET /temp-passwords - Resposta Tuya:`, JSON.stringify(response.data, null, 2));
    
    // 🔥 FILTRAR SENHAS COM PHASE 0 (DELETADAS)
    if (response.data.result && Array.isArray(response.data.result)) {
      const totalBefore = response.data.result.length;
      // Manter apenas senhas que NÃO estão deletadas (phase !== 0)
      response.data.result = response.data.result.filter(pwd => pwd.phase !== 0);
      const totalAfter = response.data.result.length;
      
      if (totalBefore !== totalAfter) {
        console.log(`🗑️ Removido ${totalBefore - totalAfter} senhas deletadas (phase: 0)`);
      }
      
      console.log(`📊 Total de senhas ATIVAS: ${totalAfter}`);
      response.data.result.forEach((pwd, idx) => {
        console.log(`  [${idx}] id: ${pwd.id}, name: ${pwd.name}, phase: ${pwd.phase}, effective_time: ${pwd.effective_time}, invalid_time: ${pwd.invalid_time}`);
      });
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
    
    console.log(`🗑️ DELETE - Deletando senha: deviceId=${deviceId}, passwordId=${passwordId}`);
    console.log(`👤 User ID: ${req.user.id}`);
    console.log(`🌐 Region Host: ${regionHost}`);
    
    // Validação de parâmetros
    if (!deviceId || !passwordId) {
      console.error('❌ Parâmetros inválidos:', { deviceId, passwordId });
      return res.status(400).json({ 
        success: false, 
        error: 'deviceId e passwordId são obrigatórios' 
      });
    }
    
    const accessToken = await ensureToken(req.user.id);
    console.log(`🔐 Token obtido com sucesso`);
    
    const url = `/v1.0/devices/${deviceId}/door-lock/temp-passwords/${passwordId}`;
    const emptyBody = '';
    const { sign, t } = generateSign('DELETE', url, emptyBody, accessToken);

    const fullUrl = `https://${regionHost}${url}`;
    console.log(`📤 DELETE URL: ${fullUrl}`);
    console.log(`🔑 Headers preparados: client_id=${clientId}`);
    console.log(`📊 Timestamp: ${t}`);
    console.log(`🔐 Sign method: HMAC-SHA256`);

    console.log(`⏳ Enviando requisição DELETE para Tuya...`);
    const response = await axios.delete(fullUrl, {
      headers: {
        client_id: clientId,
        access_token: accessToken,
        sign,
        sign_method: 'HMAC-SHA256',
        t,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ DELETE - Sucesso! Status: ${response.status}`);
    console.log(`✅ Resposta da API Tuya:`, JSON.stringify(response.data, null, 2));
    console.log(`📋 Response Code (result field):`, response.data?.code);
    console.log(`📋 Response Success:`, response.data?.success);
    console.log(`📋 Full Response:`, response.data);

    // ✅ REMOVER SENHA DO BANCO DE DADOS LOCAL (usando password_id da Tuya, não o id local)
    try {
      const deleteResult = await query(
        'DELETE FROM temp_passwords_history WHERE password_id = $1 AND user_id = $2 RETURNING id',
        [passwordId, req.user.id]
      );
      console.log(`✅ Senha removida do banco de dados local - Registros deletados: ${deleteResult.rowCount}`);
      if (deleteResult.rowCount === 0) {
        console.warn(`⚠️ Nenhum registro encontrado para deletar com password_id=${passwordId}`);
      }
    } catch (dbErr) {
      console.warn(`⚠️ Aviso ao deletar do banco: ${dbErr.message}`);
    }

    const result = response.data || { success: true, message: 'Senha deletada com sucesso' };
    res.json({ success: true, result, message: 'Senha deletada com sucesso' });
  } catch (err) {
    console.error('❌ DELETE - Erro:', err.message);
    
    if (err.response) {
      console.error('📊 Status HTTP:', err.response.status);
      console.error('📝 Response Data:', err.response.data);
      console.error('📝 Response Headers:', err.response.headers);
    } else if (err.request) {
      console.error('📝 Request made but no response:', err.request);
    } else {
      console.error('📝 Error Details:', err.stack);
    }
    
    // Verifica se é sucesso (alguns status codes como 204 são sucesso mesmo sendo erro no axios)
    if (err.response?.status === 404 || 
        err.response?.status === 204 || 
        err.response?.data?.success === true ||
        (err.response?.status >= 200 && err.response?.status < 300)) {
      console.log(`✅ Status ${err.response?.status} - considerando como sucesso`);
      
      // ✅ REMOVER SENHA DO BANCO DE DADOS LOCAL (mesmo em caso de "erro" com status 204/404)
      try {
        const deleteResult = await query(
          'DELETE FROM temp_passwords_history WHERE password_id = $1 AND user_id = $2 RETURNING id',
          [passwordId, req.user.id]
        );
        console.log(`✅ Senha removida do banco de dados local - Registros deletados: ${deleteResult.rowCount}`);
        if (deleteResult.rowCount === 0) {
          console.warn(`⚠️ Nenhum registro encontrado para deletar com password_id=${passwordId}`);
        }
      } catch (dbErr) {
        console.warn(`⚠️ Aviso ao deletar do banco: ${dbErr.message}`);
      }
      
      return res.json({ success: true, result: { message: 'Senha deletada com sucesso' } });
    }
    
    const errorMsg = err.response?.data?.msg || err.response?.data?.message || err.message || 'Erro desconhecido ao deletar senha';
    console.error(`❌ Erro final: ${errorMsg}`);
    
    res.status(err.response?.status || 500).json({ 
      success: false, 
      error: errorMsg,
      details: err.response?.data 
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
      console.log(`📋 POST /temp-password - Resposta Tuya:`, JSON.stringify(response.data, null, 2));
      console.log(`🔑 Salvando password_id: ${response.data.result.id}`);
      
      const lockResult = await query(
        'SELECT id FROM locks WHERE user_id = $1 AND device_id = $2',
        [req.user.id, deviceId]
      );

      if (lockResult.rows.length > 0) {
        const insertResult = await query(
          `INSERT INTO temp_passwords_history 
           (user_id, lock_id, password_id, nome, senha_cripto, data_inicio, data_fim, status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, password_id`,
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
        console.log(`✅ Senha inserida no BD - id: ${insertResult.rows[0].id}, password_id: ${insertResult.rows[0].password_id}`);
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
    console.log('⚠️ Tentativa de salvar configuração Tuya - usando .env em vez de banco de dados');
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
    console.log('⚠️ Tentativa de deletar configuração Tuya - usando .env em vez de banco de dados');
    
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

// DEBUG: Analisar senhas stuck em phase 3
app.get('/api/debug/phase3-analysis/:deviceId', authenticateToken, async (req, res) => {
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

    const now = Math.floor(Date.now() / 1000);
    const phase3Passwords = response.data.result.filter(p => p.phase === 3);
    
    const analysis = phase3Passwords.map(p => {
      const hoursSinceStart = (now - p.effective_time) / 3600;
      const hoursUntilExpires = (p.invalid_time - now) / 3600;
      return {
        id: p.id,
        name: p.name,
        created: new Date(p.effective_time * 1000).toISOString(),
        expires: new Date(p.invalid_time * 1000).toISOString(),
        hoursSinceCreated: hoursSinceStart.toFixed(2),
        hoursUntilExpires: hoursUntilExpires.toFixed(2),
        status: '🔴 PRESO em Phase 3 (A ser deletada)',
        insight: hoursSinceStart > 24 ? '❌ Mais de 24h e ainda não deletou!' : '⏳ Ainda dentro do prazo'
      };
    });

    res.json({
      success: true,
      totalPasswords: response.data.result.length,
      phase3Count: phase3Passwords.length,
      analysis
    });
  } catch (err) {
    console.error('Erro na análise:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Inicializa servidor
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Banco de dados: PostgreSQL`);
  console.log(`✅ Sistema de autenticação ativo\n`);
});