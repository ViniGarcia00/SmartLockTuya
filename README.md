# SmartLock Tuya

Controle de fechaduras inteligentes Tuya via integração com a Tuya Cloud API.

## 🧱 Stack
- Node.js + Express.js
- PostgreSQL
- Integração: Tuya Cloud API (HMAC-SHA256)
- Frontend: Vanilla JavaScript + HTML/CSS
- Autenticação: JWT + express-session

## ⚙️ Pré-requisitos
- Node 18+
- NPM ou Yarn
- PostgreSQL 12+
- Arquivo `.env` configurado

## 🔐 Variáveis de Ambiente (OBRIGATÓRIAS)

As credenciais Tuya **DEVEM estar no `.env`** e serão lidas por todos os módulos:

```env
# ===== TUYA CLOUD API =====
TUYA_CLIENT_ID=seu_client_id
TUYA_CLIENT_SECRET=seu_client_secret
TUYA_REGION_HOST=openapi.tuyaus.com

# ===== BANCO DE DADOS =====
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tuya_locks_db
DB_USER=tuya_admin
DB_PASSWORD=sua_senha

# ===== SERVIDOR =====
PORT=3000
NODE_ENV=development

# ===== JWT E SESSÃO =====
JWT_SECRET=chave_aleatoria_segura_minimo_32_caracteres
SESSION_SECRET=outra_chave_aleatoria_segura

# ===== EMAIL =====
EMAIL_SERVICE=smtp
EMAIL_HOST=smtp.hostinger.com
EMAIL_PORT=465
EMAIL_USER=seu_email@dominio.com
EMAIL_PASSWORD=sua_senha
```

**⚠️ IMPORTANTE:** As credenciais Tuya (`TUYA_CLIENT_ID`, `TUYA_CLIENT_SECRET`, `TUYA_REGION_HOST`) não são mais armazenadas no banco de dados. Elas são **lidas diretamente do `.env`** em tempo de execução. Não use o painel de configurações da aplicação para configurar credenciais Tuya.

## ▶️ Como Rodar

```bash
# Instalar dependências
npm install

# Configurar banco de dados
createdb tuya_locks_db
psql tuya_locks_db < database_schema.sql

# Iniciar servidor (desenvolvimento)
npm run dev

# Ou produção
npm run start
```

## 🧪 Scripts
- `npm run dev` – inicia servidor em modo desenvolvimento com nodemon
- `npm run start` – inicia servidor em produção
- `npm run lint` – checa problemas de lint
- `npm run lint:fix` – corrige lint automaticamente
- `npm run format` – formata código com Prettier

## 📁 Estrutura do Projeto
```
config/
  └── database.js          # Configuração do pool PostgreSQL
middleware/
  └── auth.js              # Validação JWT, logging
models/                     # (reservado para futuros modelos)
routes/
  └── auth.js              # Registro, login, reset de senha
public/
  ├── dashboard.html       # Interface principal
  ├── settings.html        # Configurações do usuário
  ├── locks.html           # CRUD de fechaduras
  ├── passwords.html       # Gerenciamento de senhas temporárias
  └── assets/              # CSS/JS
server.js                   # Servidor principal + rotas
```

## 🔌 Rotas Principais

### Autenticação
- `POST /api/auth/register` – Registrar novo usuário
- `POST /api/auth/login` – Login
- `POST /api/auth/verify-email` – Verificar email
- `POST /api/auth/forgot-password` – Solicitar reset de senha
- `POST /api/auth/reset-password` – Resetar senha

### Fechaduras
- `GET /api/locks` – Listar fechaduras do usuário
- `POST /api/locks` – Adicionar nova fechadura
- `PUT /api/locks/:deviceId` – Atualizar fechadura
- `DELETE /api/locks/:deviceId` – Deletar fechadura

### Integração Tuya
- `GET /api/device/:deviceId/status` – Status da fechadura (Tuya API)
- `GET /api/device/:deviceId/info` – Informações do dispositivo (Tuya API)
- `GET /api/device/:deviceId/temp-passwords` – Listar senhas temporárias
- `POST /api/device/:deviceId/temp-password` – Criar senha temporária (3 passos: ticket → descriptografia → criptografia)
- `DELETE /api/device/:deviceId/temp-password/:passwordId` – Deletar senha

### Configuração
- `GET /api/config/tuya` – Verificar status das credenciais Tuya (do `.env`)
- `POST /api/config/tuya/test` – Testar conexão com Tuya API

## 🔐 Segurança

### Padrão: Credenciais do `.env`
Todas as funções de criptografia e chamadas à API Tuya usam credenciais do `.env`:
- `generateTokenSign()` – Gera assinatura HMAC-SHA256 para obtenção de token
- `generateSign()` – Gera assinatura HMAC-SHA256 para requisições de dados
- `ensureToken()` – Obtém/cache token com credenciais do `.env`

### Cache de Tokens
Tokens Tuya são cacheados em memória por usuário para evitar requisições excessivas. Margem de 60s para renovação.

### Criptografia de Senhas Temporárias
Processo de 3 passos conforme especificação Tuya:
1. Obter ticket (`/v1.0/devices/{id}/door-lock/password-ticket`)
2. Descriptografar ticket_key com `client_secret` (AES-256-ECB)
3. Criptografar senha com chave obtida (AES-128-ECB)

### Autenticação do Frontend
- JWT tokens armazenados no `localStorage`
- Enviados como `Authorization: Bearer <token>`
- Validação de sessão em cada requisição
- Logout em outro dispositivo invalida sessão

## 🗺️ Roadmap / Próximas Features
- [ ] Integração WhatsApp para notificações
- [ ] Sistema de compartilhamento de conta multi-usuário
- [ ] Histórico de acessos (logs detalhados)
- [ ] Dashboard com gráficos
- [ ] Testes automatizados (Jest/Mocha)
- [ ] Documentação Swagger/OpenAPI
- [ ] CI/CD (GitHub Actions)
