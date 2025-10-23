# MUDANÇAS IMPLEMENTADAS - Credenciais Tuya via .env

## Resumo
Todas as credenciais Tuya (`TUYA_CLIENT_ID`, `TUYA_CLIENT_SECRET`, `TUYA_REGION_HOST`) agora são **lidas diretamente do `.env`** em vez de serem buscadas do banco de dados. Isso simplifica a configuração e melhora a segurança.

## Arquivos Modificados

### 1. `middleware/auth.js`
**Removido:**
- Função `requireTuyaConfig()` - middleware que buscava credenciais do banco
- Exportação de `requireTuyaConfig`

**Motivo:** Não é mais necessário buscar credenciais do banco de dados.

---

### 2. `server.js` - Funções de Criptografia

#### `generateTokenSign(t)`
**Antes:**
```javascript
function generateTokenSign(clientId, secret, t) {
  // recebia client_id e secret como parâmetros
}
```

**Depois:**
```javascript
function generateTokenSign(t) {
  const clientId = process.env.TUYA_CLIENT_ID;
  const secret = process.env.TUYA_CLIENT_SECRET;
  // usa .env
}
```

#### `generateSign(method, url, body, accessToken)`
**Antes:**
```javascript
function generateSign(method, url, body, accessToken, clientId, secret) {
  // recebia client_id e secret como parâmetros
}
```

**Depois:**
```javascript
function generateSign(method, url, body, accessToken) {
  const clientId = process.env.TUYA_CLIENT_ID;
  const secret = process.env.TUYA_CLIENT_SECRET;
  // usa .env
}
```

#### `ensureToken(userId)`
**Antes:**
```javascript
async function ensureToken(userId, tuyaConfig) {
  const sign = generateTokenSign(tuyaConfig.client_id, tuyaConfig.client_secret, t);
  const res = await axios.get(`https://${tuyaConfig.region_host}/v1.0/token...`);
}
```

**Depois:**
```javascript
async function ensureToken(userId) {
  const regionHost = process.env.TUYA_REGION_HOST;
  const clientId = process.env.TUYA_CLIENT_ID;
  const sign = generateTokenSign(t);
  const res = await axios.get(`https://${regionHost}/v1.0/token...`);
}
```

---

### 3. `server.js` - Rotas da API

**Todas as rotas abaixo foram atualizadas para remover o middleware `requireTuyaConfig` e usar `process.env`:**

#### ✅ GET `/api/device/:deviceId/status`
- Removido: middleware `requireTuyaConfig`
- Mudado: `req.tuyaConfig.client_id` → `process.env.TUYA_CLIENT_ID`
- Mudado: `req.tuyaConfig.region_host` → `process.env.TUYA_REGION_HOST`
- Mudado: `ensureToken(req.user.id, req.tuyaConfig)` → `ensureToken(req.user.id)`

#### ✅ GET `/api/device/:deviceId/info`
- Mesmas mudanças acima

#### ✅ GET `/api/device/:deviceId/temp-passwords`
- Mesmas mudanças acima

#### ✅ DELETE `/api/device/:deviceId/temp-password/:passwordId`
- Mesmas mudanças acima

#### ✅ POST `/api/device/:deviceId/temp-password`
- Mesmas mudanças acima
- Adicionadas linhas:
  ```javascript
  const regionHost = process.env.TUYA_REGION_HOST;
  const clientId = process.env.TUYA_CLIENT_ID;
  const clientSecret = process.env.TUYA_CLIENT_SECRET;
  ```

---

### 4. `server.js` - Endpoints de Configuração

#### ✅ GET `/api/config/tuya`
**Antes:** Buscava do banco de dados
**Depois:** Retorna status das variáveis do `.env`
```javascript
app.get('/api/config/tuya', authenticateToken, async (req, res) => {
  // Retorna valores do .env
  res.json({ 
    success: true, 
    result: {
      client_id: process.env.TUYA_CLIENT_ID || '',
      region_host: process.env.TUYA_REGION_HOST || 'openapi.tuyaeu.com',
      configured: !!(process.env.TUYA_CLIENT_ID && ...)
    }
  });
});
```

#### ✅ POST `/api/config/tuya`
**Antes:** Salvava no banco de dados
**Depois:** Retorna mensagem informando que credenciais vêm do `.env`
```javascript
app.post('/api/config/tuya', authenticateToken, async (req, res) => {
  console.log('⚠️ Credenciais Tuya são configuradas via .env');
  res.json({ 
    success: true, 
    message: 'As credenciais são configuradas via .env' 
  });
});
```

#### ✅ DELETE `/api/config/tuya`
**Antes:** Deletava do banco de dados
**Depois:** Retorna mensagem informando que credenciais não podem ser deletadas
```javascript
app.delete('/api/config/tuya', authenticateToken, async (req, res) => {
  res.json({ 
    success: true, 
    message: 'Credenciais são via .env, edite o arquivo para remover' 
  });
});
```

#### ✅ POST `/api/config/tuya/test`
**Antes:** Buscava credenciais do banco
**Depois:** Usa credenciais do `.env` para testar
```javascript
app.post('/api/config/tuya/test', authenticateToken, async (req, res) => {
  const clientId = process.env.TUYA_CLIENT_ID;
  const clientSecret = process.env.TUYA_CLIENT_SECRET;
  const regionHost = process.env.TUYA_REGION_HOST;
  
  if (!clientId || !clientSecret || !regionHost) {
    return res.status(400).json({
      success: false,
      error: 'Credenciais não estão configuradas no .env',
      missing: [...]
    });
  }
  // testa conexão...
});
```

---

## Arquivo `.env` - Variáveis Obrigatórias

```env
# ===== TUYA CLOUD API (OBRIGATÓRIO) =====
TUYA_CLIENT_ID=seu_client_id
TUYA_CLIENT_SECRET=seu_client_secret
TUYA_REGION_HOST=openapi.tuyaus.com
```

**Regiões disponíveis:**
- `openapi.tuyaus.com` - Estados Unidos
- `openapi.tuyaeu.com` - Europa
- `openapi.tuyacn.com` - China
- `openapi.tuyain.com` - Índia

---

## Arquivo `.env.example`
Atualizado com:
- Explicação clara sobre credenciais Tuya
- Aviso de que são lidas do `.env` e não do banco
- Lista completa de variáveis necessárias
- Regiões Tuya disponíveis

---

## `README.md` - Documentação
Atualizado com:
- ⚠️ Destaque que credenciais vêm do `.env`
- Explicação do novo padrão
- Aviso para não usar painel de configurações para Tuya
- Detalhes sobre cache de tokens
- Processo de 3 passos para senhas temporárias

---

## Benefícios desta Mudança

✅ **Segurança:** Credenciais não mais armazenadas em banco de dados
✅ **Simplicidade:** Sem necessidade de middleware `requireTuyaConfig`
✅ **Performance:** Sem queries adicionais ao banco para credenciais
✅ **Padrão:** Segue prática comum de usar variáveis de ambiente
✅ **Multi-servidor:** Facilita deployments com credenciais diferentes por ambiente

---

## ⚠️ Mudanças que Afetam o Frontend (se houver)

O frontend **NÃO precisa mudar nada**, pois os endpoints ainda existem:
- `GET /api/config/tuya` - continua retornando o status
- `POST /api/config/tuya/test` - continua testando a conexão

A interface do usuário em `settings.html` pode ser simplificada para não permitir edição de credenciais (apenas visualização), já que elas vêm do `.env`.

---

## ✅ Checklist de Implementação

- [x] Remover middleware `requireTuyaConfig`
- [x] Remover exportação de `requireTuyaConfig`
- [x] Atualizar `generateTokenSign()` para usar `.env`
- [x] Atualizar `generateSign()` para usar `.env`
- [x] Atualizar `ensureToken()` para usar `.env`
- [x] Remover middleware de todas as rotas que usam Tuya
- [x] Atualizar `GET /api/device/:deviceId/status`
- [x] Atualizar `GET /api/device/:deviceId/info`
- [x] Atualizar `GET /api/device/:deviceId/temp-passwords`
- [x] Atualizar `DELETE /api/device/:deviceId/temp-password/:passwordId`
- [x] Atualizar `POST /api/device/:deviceId/temp-password`
- [x] Atualizar `GET /api/config/tuya`
- [x] Atualizar `POST /api/config/tuya`
- [x] Atualizar `DELETE /api/config/tuya`
- [x] Atualizar `POST /api/config/tuya/test`
- [x] Atualizar `.env.example`
- [x] Atualizar `README.md`
- [x] Atualizar `middleware/auth.js` - remover `requireTuyaConfig`
- [x] Atualizar `server.js` - remover import

---

## � CORREÇÕES APLICADAS

### Issue: Status Offline após mudanças

**Problema:** Dashboard mostrava "🔴 Offline" mesmo com credenciais corretas

**Causa:** Função `checkTuyaStatus()` esperava mensagem de erro antiga

**Solução:**

#### `public/dashboard.html` ✅
Atualizada verificação para aceitar ambas as mensagens:
```javascript
if (response.status === 400 && data.error && 
    (data.error.includes('Configure') || data.error.includes('não estão configuradas'))) {
```

#### `public/settings.html` ✅
- Campos Tuya agora desabilitados (read-only)
- `loadTuyaConfig()` - exibe aviso sobre .env
- `handleTuyaSubmit()` - retorna mensagem informativa
- `handleTuyaTest()` - apenas testa (sem salvar)
- `handleClearTuya()` - instrui para editar .env

---

## �🚀 Como Testar

1. Certifique-se de que `.env` possui:
   ```env
   TUYA_CLIENT_ID=seu_valor
   TUYA_CLIENT_SECRET=seu_valor
   TUYA_REGION_HOST=openapi.tuyaus.com
   ```

2. Reinicie o servidor:
   ```bash
   npm run dev
   ```

3. Teste a rota:
   ```bash
   curl -X POST http://localhost:3000/api/config/tuya/test \
     -H "Authorization: Bearer SEU_TOKEN" \
     -H "x-session-id: SUA_SESSION"
   ```

4. Esperado: Resposta com status de conexão com Tuya (usando credenciais do `.env`)

