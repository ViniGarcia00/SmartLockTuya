# SmartLock Tuya - Instruções para Agentes IA (em Português)

## Visão Geral do Projeto
**SmartLockTuya** é uma aplicação Express.js + PostgreSQL para controlar fechaduras inteligentes Tuya através de um painel web. Os usuários se autenticam, configuram credenciais da API Tuya, gerenciam fechaduras e criam senhas de acesso temporárias.

### Stack de Tecnologias
- **Backend:** Node.js + Express.js, PostgreSQL 
- **Frontend:** JavaScript vanilla + HTML/CSS
- **Integração Externa:** Tuya Cloud API (assinatura HMAC-SHA256)
- **Autenticação:** Tokens JWT + express-session, hash de senha com bcrypt

---

## Arquitetura Geral

### Fluxo de Requisições em 3 Camadas
1. **Frontend** (`public/*.html`) → Envia header `Authorization: Bearer <JWT>`
2. **Middleware** (`middleware/auth.js`) → Valida JWT, popula `req.user`, verifica config Tuya
3. **Rotas da API** (`server.js`) → Consulta PostgreSQL, chama API Tuya com tokens cacheados

### Componentes Principais

| Componente | Propósito | Arquivos |
|-----------|----------|----------|
| **Sistema de Auth** | Registro, JWT, gerenciamento de sessão | `routes/auth.js`, `middleware/auth.js` |
| **Bridge Tuya** | Assinatura HMAC-SHA256, cache de tokens, controle de dispositivos | `server.js` (linhas 36-89) |
| **Gerenciamento de Fechaduras** | CRUD de fechaduras, status do dispositivo, senhas | `server.js` (linhas 91-420) |
| **Banco de Dados** | PostgreSQL com tabelas users/locks/tuya_configs/logs | `config/database.js`, `database_schema.sql` |

---

## Padrões Críticos

### Fluxo de Autenticação JWT
```javascript
// JWT armazenado no localStorage, enviado como Bearer token em todas as requisições protegidas
const authenticateToken = async (req, res, next) => {
  const token = req.headers['authorization'].split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    req.user = await query('SELECT ... FROM users WHERE id = $1', [decoded.userId]);
    next();
  });
};
```
- Token emitido no login: `POST /api/auth/login` retorna `{token, id, nome}`
- Rotas protegidas sempre chamam `authenticateToken` primeiro
- Variável de sessão deve estar em `.env`: `SESSION_SECRET=chave-secreta`

### Padrão de Integração com API Tuya
```javascript
// Padrão único: Cache de tokens + Assinatura HMAC em cada requisição
async function ensureToken(userId, tuyaConfig) {
  const cached = tokenCache.get(`user_${userId}`);
  if (cached && Date.now() < cached.expireTime - 60000) return cached.accessToken;
  // Caso contrário, busca novo token com assinatura HMAC-SHA256
}

// Todas as chamadas da API Tuya requerem estes headers:
headers: {
  client_id: tuyaConfig.client_id,
  access_token: accessToken,
  sign: generateSign(...), // hash HMAC-SHA256
  sign_method: 'HMAC-SHA256',
  t: Date.now().toString()
}
```
- **Cache de tokens** evita chamadas excessivas à API (armazenado em Map na memória)
- **Geração de assinatura** em `generateSign()` e `generateTokenSign()` usa SHA256 HMAC
- **Host de região** (ex: `openapi.tuyaus.com`) configurável por usuário em settings

### Criação de Senha Temporária (Processo Complexo de 3 Passos)
Processo de 3 passos documentado em `server.js` linhas 380-450:
1. **Obter ticket** → POST para `/v1.0/devices/{deviceId}/door-lock/password-ticket`
2. **Descriptografar ticket_key** → AES-256-ECB com client_secret, extrair chave de criptografia
3. **Criptografar senha** → AES-128-ECB com chave de 16 bytes, enviar como string hexadecimal

```javascript
// Exemplo: Por que isso importa - senha DEVE ter 7 dígitos, criptografada com chave derivada do ticket
if (!password || password.length !== 7) {
  return res.status(400).json({ error: 'Senha deve ter exatamente 7 dígitos' });
}
```

### Padrão de Consultas ao Banco de Dados
Todas as queries usam instruções parametrizadas com cliente PostgreSQL:
```javascript
const result = await query(
  'INSERT INTO locks (user_id, device_id, nome) VALUES ($1, $2, $3) RETURNING *',
  [req.user.id, deviceId, name]
);
```
- Sempre use placeholders `$1, $2` (previne SQL injection)
- Queries definidas pela instância Pool em `config/database.js`
- Pool de conexão com máx 20 clientes, timeout de 30s de inatividade

### Padrão de Autenticação no Frontend
Toda página HTML:
```javascript
function checkAuth() {
  if (!localStorage.getItem('token')) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});
```

---

## Workflows Comuns

### Adicionando uma Rota Protegida
1. Criar endpoint em `server.js` com middleware `authenticateToken`
2. Se acessar API Tuya, adicionar também middleware `requireTuyaConfig`
3. Usar `req.user.id` e `req.tuyaConfig` do setup do middleware
4. Retornar `{success: true, result: ...}` no sucesso, `{success: false, error: msg}` no erro

### Chamando API Tuya pelo Frontend
```javascript
// 1. Garantir que usuário configurou credenciais Tuya em Configurações
// 2. Fazer fetch com token Bearer
const res = await fetch('/api/device/{deviceId}/status', {
  headers: getHeaders()
});
const data = await res.json();
if (data.success) { /* usar data.result */ }
```

### Criando Senha Temporária
1. Usuário preenche form: nome, código de 7 dígitos, data/hora inicial e final (formato: `YYYY-MM-DD` + `HH:mm`)
2. Frontend POST para `/api/device/{deviceId}/temp-password` com payload criptografado
3. Servidor valida regra de 7 dígitos, chama processo Tuya de 3 passos
4. Retorna sucesso/erro para exibir alerta na UI

---

## Variáveis de Ambiente
Requeridas em `.env`:
```
NODE_ENV=development
PORT=3000
JWT_SECRET=sua-chave-secreta-jwt
SESSION_SECRET=sua-chave-secreta-sessao
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tuya_locks_db
DB_USER=tuya_admin
DB_PASSWORD=senha
EMAIL_SERVICE=gmail
EMAIL_USER=seu-email@gmail.com
EMAIL_PASSWORD=senha-app
APP_URL=http://localhost:3000
```

---

## Convenção de Tratamento de Erros
- **Alertas no Frontend** (canto inferior direito): `showAlert(mensagem, 'success'|'error')`
- **Erros da API** retornam: `{success: false, error: 'mensagem'}` ou `{success: false, errors: [...]}`
- **Falhas na API Tuya** logadas no console, retornam status HTTP 500

---

## Referência de Arquivos Principais
| Caminho | Propósito |
|--------|----------|
| `server.js` | App Express principal, integração Tuya, rotas |
| `routes/auth.js` | Registro, login, verificação de email, reset de senha |
| `middleware/auth.js` | Validação JWT, verificação config Tuya, logging de atividades |
| `config/database.js` | Configuração do pool PostgreSQL |
| `database_schema.sql` | Definição de schema (users, locks, tuya_configs, logs) |
| `public/dashboard.html` | Interface principal do usuário |
| `public/settings.html` | Configuração de credenciais Tuya |
| `public/locks.html` | Gerenciamento CRUD de fechaduras |
| `public/passwords.html` | Criação/deleção de senhas temporárias |

---

## Próximos Passos / Problemas Conhecidos
Veja `Próximos Passos/Sistema.txt` para backlog de funcionalidades:
- Corrigir carregamento de fechaduras em locks.html
- Implementar sistema de busca
- Adicionar compartilhamento de conta multi-usuário
- Integração de notificações WhatsApp
