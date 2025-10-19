require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const session = require('express-session');
const { query } = require('./config/database');
const { authenticateToken, requireTuyaConfig, logActivity } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Redireciona raiz para login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Rotas de autenticação
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Cache de token por usuário
const tokenCache = new Map();

// Funções Tuya (adaptadas para usar config do usuário)
function generateTokenSign(clientId, secret, t) {
  const method = 'GET';
  const url = '/v1.0/token?grant_type=1';
  const emptyBodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const stringToSign = `${clientId}${t}${method}\n${emptyBodyHash}\n\n${url}`;
  return crypto.createHmac('sha256', secret).update(stringToSign).digest('hex').toUpperCase();
}

function generateSign(method, url, body, accessToken, clientId, secret) {
  const t = Date.now().toString();
  const contentHash = crypto.createHash('sha256').update(body).digest('hex');
  const stringToSign = `${clientId}${accessToken}${t}${method}\n${contentHash}\n\n${url}`;
  const sign = crypto.createHmac('sha256', secret).update(stringToSign).digest('hex').toUpperCase();
  return { sign, t };
}

async function ensureToken(userId, tuyaConfig) {
  const cacheKey = `user_${userId}`;
  const cached = tokenCache.get(cacheKey);
  
  if (cached && Date.now() < cached.expireTime - 60000) {
    return cached.accessToken;
  }

  const t = Date.now().toString();
  const sign = generateTokenSign(tuyaConfig.client_id, tuyaConfig.client_secret, t);

  try {
    const res = await axios.get(`https://${tuyaConfig.region_host}/v1.0/token?grant_type=1`, {
      headers: {
        client_id: tuyaConfig.client_id,
        sign,
        sign_method: 'HMAC-SHA256',
        t,
      },
    });

    if (res.data.success) {
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

// ========== ROTAS PROTEGIDAS ==========

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Obter fechaduras do usuário
app.get('/api/locks', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, device_id, nome, localizacao, ativo FROM locks WHERE user_id = $1 AND ativo = true',
      [req.user.id]
    );

    res.json({ 
      success: true, 
      result: result.rows.map(lock => ({
        id: lock.device_id,
        name: lock.nome,
        location: lock.localizacao
      }))
    });
  } catch (err) {
    console.error('Erro ao buscar fechaduras:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Adicionar fechadura
app.post('/api/locks', authenticateToken, async (req, res) => {
  try {
    const { device_id, nome, localizacao } = req.body;

    const result = await query(
      `INSERT INTO locks (user_id, device_id, nome, localizacao) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, device_id, nome, localizacao`,
      [req.user.id, device_id, nome, localizacao]
    );

    res.json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error('Erro ao adicionar fechadura:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Status do dispositivo
app.get('/api/device/:deviceId/status', authenticateToken, requireTuyaConfig, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const accessToken = await ensureToken(req.user.id, req.tuyaConfig);
    
    const url = `/v1.0/devices/${deviceId}/status`;
    const { sign, t } = generateSign('GET', url, '', accessToken, req.tuyaConfig.client_id, req.tuyaConfig.client_secret);

    const response = await axios.get(`https://${req.tuyaConfig.region_host}${url}`, {
      headers: {
        client_id: req.tuyaConfig.client_id,
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
app.get('/api/device/:deviceId/info', authenticateToken, requireTuyaConfig, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const accessToken = await ensureToken(req.user.id, req.tuyaConfig);
    
    const url = `/v1.0/devices/${deviceId}`;
    const { sign, t } = generateSign('GET', url, '', accessToken, req.tuyaConfig.client_id, req.tuyaConfig.client_secret);

    const response = await axios.get(`https://${req.tuyaConfig.region_host}${url}`, {
      headers: {
        client_id: req.tuyaConfig.client_id,
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
app.get('/api/device/:deviceId/temp-passwords', authenticateToken, requireTuyaConfig, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const accessToken = await ensureToken(req.user.id, req.tuyaConfig);
    
    const url = `/v1.0/devices/${deviceId}/door-lock/temp-passwords`;
    const { sign, t } = generateSign('GET', url, '', accessToken, req.tuyaConfig.client_id, req.tuyaConfig.client_secret);

    const response = await axios.get(`https://${req.tuyaConfig.region_host}${url}`, {
      headers: {
        client_id: req.tuyaConfig.client_id,
        access_token: accessToken,
        sign,
        sign_method: 'HMAC-SHA256',
        t,
      },
    });

    // NÃO LOGA MAIS NO TERMINAL
    res.json(response.data);
  } catch (err) {
    console.error('Erro ao listar senhas:', err.message);
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

// Deletar senha
app.delete('/api/device/:deviceId/temp-password/:passwordId', authenticateToken, requireTuyaConfig, async (req, res) => {
  try {
    const { deviceId, passwordId } = req.params;
    const accessToken = await ensureToken(req.user.id, req.tuyaConfig);
    
    const url = `/v1.0/devices/${deviceId}/door-lock/temp-passwords/${passwordId}`;
    const { sign, t } = generateSign('DELETE', url, '', accessToken, req.tuyaConfig.client_id, req.tuyaConfig.client_secret);

    const response = await axios.delete(`https://${req.tuyaConfig.region_host}${url}`, {
      headers: {
        client_id: req.tuyaConfig.client_id,
        access_token: accessToken,
        sign,
        sign_method: 'HMAC-SHA256',
        t,
      },
    });

    res.json(response.data);
  } catch (err) {
    console.error('Erro ao deletar senha:', err.message);
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

// Funções de criptografia
function decryptTicketKey(ticketKeyHex, accessSecret) {
  const encryptedBuffer = Buffer.from(ticketKeyHex, 'hex');
  const keyBuffer = Buffer.from(accessSecret, 'utf8');
  const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuffer, null);
  decipher.setAutoPadding(false);
  let decrypted = decipher.update(encryptedBuffer);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8').replace(/\0+$/, '');
}

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

// Criar senha temporária
app.post('/api/device/:deviceId/temp-password', authenticateToken, requireTuyaConfig, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { name, password, startDate, startTime, endDate, endTime } = req.body;
    
    if (!password || password.length !== 7) {
      return res.status(400).json({
        success: false,
        error: { msg: 'Senha deve ter exatamente 7 dígitos' }
      });
    }
    
    const startTimestamp = Math.floor(new Date(`${startDate}T${startTime}`).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(`${endDate}T${endTime}`).getTime() / 1000);
    const accessToken = await ensureToken(req.user.id, req.tuyaConfig);
    
    // Passo 1: Obter ticket
    const ticketUrl = `/v1.0/devices/${deviceId}/door-lock/password-ticket`;
    const ticketBody = '{}';
    const { sign: ticketSign, t: ticketT } = generateSign('POST', ticketUrl, ticketBody, accessToken, req.tuyaConfig.client_id, req.tuyaConfig.client_secret);
    
    const ticketResponse = await axios.post(`https://${req.tuyaConfig.region_host}${ticketUrl}`, {}, {
      headers: {
        client_id: req.tuyaConfig.client_id,
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
    const originalKey = decryptTicketKey(ticket_key, req.tuyaConfig.client_secret);
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
    const { sign, t } = generateSign('POST', url, body, accessToken, req.tuyaConfig.client_id, req.tuyaConfig.client_secret);

    const response = await axios.post(`https://${req.tuyaConfig.region_host}${url}`, 
      passwordData,
      {
        headers: {
          client_id: req.tuyaConfig.client_id,
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

// Obter config Tuya do usuário
app.get('/api/config/tuya', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, client_id, region_host, ativo FROM tuya_configs WHERE user_id = $1',
      [req.user.id]
    );

    res.json({ 
      success: true, 
      result: result.rows.length > 0 ? result.rows[0] : null 
    });
  } catch (err) {
    console.error('Erro ao buscar config:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Salvar/atualizar config Tuya
app.post('/api/config/tuya', authenticateToken, async (req, res) => {
  try {
    const { client_id, client_secret, region_host } = req.body;

    if (!client_id || !client_secret) {
      return res.status(400).json({
        success: false,
        error: 'Client ID e Secret são obrigatórios'
      });
    }

    const existing = await query(
      'SELECT id FROM tuya_configs WHERE user_id = $1',
      [req.user.id]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await query(
        `UPDATE tuya_configs 
         SET client_id = $1, client_secret = $2, region_host = $3, updated_at = NOW()
         WHERE user_id = $4
         RETURNING id`,
        [client_id, client_secret, region_host || 'openapi.tuyaeu.com', req.user.id]
      );
    } else {
      result = await query(
        `INSERT INTO tuya_configs (user_id, client_id, client_secret, region_host) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        [req.user.id, client_id, client_secret, region_host || 'openapi.tuyaeu.com']
      );
    }

    // Limpa cache de token
    tokenCache.delete(`user_${req.user.id}`);

    res.json({ success: true, message: 'Configuração salva com sucesso' });
  } catch (err) {
    console.error('Erro ao salvar config:', err.message);
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

// Inicializa servidor
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Banco de dados: PostgreSQL`);
  console.log(`✅ Sistema de autenticação ativo\n`);
});