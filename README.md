# 🔐 SmartLock Tuya - Sistema de Controle de Fechaduras Inteligentes

> **Integração Stays - Sistema de Gerenciamento de Acomodações com Fechaduras Inteligentes Tuya**

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-lightgrey)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue)](https://www.postgresql.org)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Stack Tecnológico](#stack-tecnológico)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Como Usar](#como-usar)
- [API Endpoints](#api-endpoints)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Banco de Dados](#banco-de-dados)
- [Troubleshooting](#troubleshooting)
- [Contribuição](#contribuição)

---

## 🎯 Visão Geral

**SmartLock Tuya** é uma aplicação web completa para gerenciar fechaduras inteligentes Tuya através de um painel administrativo. O sistema permite que usuários autenticados:

- 🏠 Gerenciem acomodações sincronizadas da plataforma Stays
- 🔐 Configurem e controlem fechaduras inteligentes Tuya
- 🔑 Criem senhas temporárias para acesso de hóspedes
- 📊 Visualizem estatísticas e atividades em tempo real
- 🔗 Mapeiem acomodações com fechaduras (relação 1:1)

### Fluxo Principal
```
Usuário → Autentica → Dashboard → Gerencia Acomodações/Fechaduras → Cria Senhas Temp
```

---

## ✨ Funcionalidades

### 🔐 Autenticação & Segurança
- ✅ Registro e login com JWT
- ✅ Verificação de email
- ✅ Reset de senha
- ✅ Tokens com expiração configurável
- ✅ Hashing de senhas com bcrypt
- ✅ Proteção CORS

### 🏠 Gerenciamento de Acomodações
- ✅ Sincronização automática de acomodações da API Stays
- ✅ Mapeamento 1:1 com fechaduras (cada acomodação = 1 fechadura)
- ✅ Visualização em tempo real do status de mapeamento
- ✅ Busca e filtro de acomodações
- ✅ Validação de conflitos de mapeamento

### 🔒 Gerenciamento de Fechaduras
- ✅ CRUD completo de fechaduras
- ✅ Integração com API Tuya Cloud
- ✅ Sincronização de status em tempo real
- ✅ Teste de conexão com dispositivo
- ✅ Cache de tokens para otimização

### 🔑 Senhas Temporárias
- ✅ Geração de senhas temporárias (7 dígitos)
- ✅ Agendamento de validade (data/hora início e fim)
- ✅ Criptografia AES-128-ECB
- ✅ Histórico de senhas criadas
- ✅ Revogação de senhas ativas

### 📊 Dashboard
- ✅ Visão geral de acomodações (total, mapeadas, não mapeadas)
- ✅ Estatísticas de fechaduras
- ✅ Gráficos e indicadores
- ✅ Log de atividades

---

## 🛠 Stack Tecnológico

### Backend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **Node.js** | 20.x | Runtime JavaScript |
| **Express.js** | 4.x | Framework web |
| **PostgreSQL** | 14+ | Banco de dados |
| **JWT** | - | Autenticação |
| **bcrypt** | - | Hashing de senhas |
| **axios** | - | HTTP client (Tuya API) |
| **crypto** | - | Criptografia AES/HMAC |

### Frontend
| Tecnologia | Uso |
|------------|-----|
| **HTML5** | Markup |
| **CSS3** | Estilização (Grid, Flexbox) |
| **JavaScript (ES6+)** | Lógica e interatividade |
| **LocalStorage** | Armazenamento de tokens |

### Infraestrutura
| Serviço | Uso |
|--------|-----|
| **PostgreSQL** | Banco de dados relacional |
| **Tuya Cloud API** | Integração de dispositivos |
| **Stays API** | Sincronização de acomodações |

---

## 📦 Pré-requisitos

### Obrigatório
- Node.js 20.x ou superior
- PostgreSQL 14 ou superior
- npm 10.x ou superior
- Uma conta Tuya Cloud (com client_id e client_secret)
- Uma conta Stays (para sincronização de acomodações)

### Opcional
- Git (para versionamento)
- Postman (para testar API)
- DBeaver (para gerenciar banco de dados)

---

## 🚀 Instalação

### 1. Clonar o Repositório
```bash
git clone https://github.com/ViniGarcia00/SmartLockTuya.git
cd SmartLockTuya
git checkout integration-stays
```

### 2. Instalar Dependências
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente
```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar .env com suas credenciais
nano .env  # ou seu editor de preferência
```

### 4. Criar Banco de Dados
```bash
# Criar usuário PostgreSQL
psql -U postgres
CREATE USER tuya_admin WITH PASSWORD 'sua_senha';
CREATE DATABASE tuya_locks_db OWNER tuya_admin;
\q

# Executar schema
psql -U tuya_admin -d tuya_locks_db -f database_schema.sql
```

### 5. Iniciar Aplicação
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

A aplicação estará disponível em: `http://localhost:3000`

---

## ⚙️ Configuração

### Arquivo `.env`

```env
# Servidor
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tuya_locks_db
DB_USER=tuya_admin
DB_PASSWORD=sua_senha_aqui

# Autenticação
JWT_SECRET=sua-chave-secreta-jwt-muito-segura-aqui
SESSION_SECRET=sua-chave-secreta-sessao-aqui

# Tuya Cloud (obter em https://iot.tuya.com)
TUYA_CLIENT_ID=seu_client_id
TUYA_CLIENT_SECRET=seu_client_secret
TUYA_REGION=https://openapi.tuyaus.com  # ou outro region

# Stays API (obter junto ao time Stays)
STAYS_API_URL=https://api.stays.com
STAYS_API_KEY=sua_chave_api_stays
STAYS_API_SECRET=seu_secret_stays

# Email (para notificações)
EMAIL_SERVICE=gmail
EMAIL_USER=seu-email@gmail.com
EMAIL_PASSWORD=sua-senha-app-específica

# Logging
LOG_LEVEL=info
```

---

## 💻 Como Usar

### 1. Primeiro Acesso (Admin Setup)

```bash
# Inserir usuário de teste no banco
psql -U tuya_admin -d tuya_locks_db

INSERT INTO users (nome, email, senha_hash, email_verificado, ativo) 
VALUES (
  'Admin',
  'admin@example.com',
  '$2b$10$...',  -- bcrypt hash de 'senha123'
  true,
  true
);
```

Ou use o script de setup:
```bash
npm run db:setup
```

### 2. Fazer Login
1. Abrir `http://localhost:3000/login.html`
2. Inserir email e senha
3. Receber JWT token (armazenado no localStorage)

### 3. Configurar Credenciais Tuya
1. Ir para **Configurações** → **API Tuya**
2. Inserir `client_id` e `client_secret`
3. Selecionar região (US, EU, CN, etc)
4. Salvar

### 4. Sincronizar Acomodações
1. Ir para **Acomodações**
2. Clique em "Sincronizar com Stays"
3. Aguardar sincronização (alguns segundos)

### 5. Mapear Acomodação com Fechadura
1. Ir para **Acomodações**
2. Clique em "Mapear" na acomodação desejada
3. Selecionar a fechadura
4. Confirmar mapeamento

### 6. Criar Senha Temporária
1. Ir para **Senhas Temporárias**
2. Selecionar acomodação e fechadura
3. Inserir código (7 dígitos)
4. Definir data/hora de início e fim
5. Confirmar criação

---

## 📡 API Endpoints

### 🔐 Autenticação
```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/verify-email
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/me
```

### 🏠 Acomodações
```http
GET  /api/admin/accommodations
POST /api/admin/stays/sync-accommodations
GET  /api/admin/accommodations/:id
```

### 🔐 Fechaduras
```http
GET    /api/locks
POST   /api/locks
PUT    /api/locks/:deviceId
DELETE /api/locks/:deviceId
GET    /api/device/:deviceId/status
POST   /api/device/:deviceId/control
```

### 🔗 Mapeamentos
```http
POST   /api/admin/mappings
GET    /api/admin/mappings
DELETE /api/admin/mappings/:accommodationId
```

### 🔑 Senhas Temporárias
```http
POST   /api/device/:deviceId/temp-password
GET    /api/device/:deviceId/temp-passwords
DELETE /api/device/:deviceId/temp-password/:passwordId
```

### 📊 Administração
```http
GET /api/admin/stats
GET /api/admin/logs
GET /api/admin/monitoring
```

---

## 📁 Estrutura do Projeto

```
SmartLockTuya/
├── public/                    # Frontend (HTML/CSS/JS)
│   ├── dashboard.html         # Painel principal
│   ├── locks.html             # Gerenciamento de fechaduras
│   ├── accommodations.html    # Gerenciamento de acomodações
│   ├── settings.html          # Configurações
│   ├── login.html             # Página de login
│   ├── register.html          # Registro de usuário
│   └── assets/                # Imagens e recursos
│
├── routes/                    # Rotas Express
│   ├── auth.js               # Rotas de autenticação
│   ├── mappings.js           # Rotas de mapeamento
│   └── match-suggestions.js  # Sugestões de mapeamento
│
├── middleware/               # Middlewares Express
│   └── auth.js               # Autenticação JWT
│
├── config/                   # Configurações
│   └── database.js           # Pool PostgreSQL
│
├── scripts/                  # Scripts auxiliares
│   ├── setup-db.js
│   ├── migrate-accommodations.js
│   └── test-email.js
│
├── src/                      # Código TypeScript (futuro)
│   ├── lib/                  # Bibliotecas auxiliares
│   ├── jobs/                 # Jobs em background
│   └── types/                # Type definitions
│
├── database_schema.sql       # Schema do banco de dados
├── server.js                 # Arquivo principal
├── package.json              # Dependências
├── .env.example              # Exemplo de variáveis
└── README.md                 # Este arquivo
```

---

## 🗄️ Banco de Dados

### Tabelas Principais

#### `users`
Armazena informações dos usuários do sistema
```sql
id (SERIAL PK), nome, email (UNIQUE), senha_hash, 
email_verificado, token_verificacao, ativo, created_at
```

#### `locks`
Armazena as fechaduras configuradas
```sql
id (VARCHAR PK), user_id (FK), name, location, device_id, 
created_at, updated_at
```

#### `accommodations`
Armazena acomodações sincronizadas do Stays
```sql
id (VARCHAR PK), name, description, status, external_id,
created_at, updated_at
```

#### `accommodation_lock_mappings`
Mapeia acomodações para fechaduras (1:1)
```sql
id (SERIAL PK), accommodation_id (FK UNIQUE), lock_id (FK),
created_at, updated_at
```

#### `temp_passwords_history`
Histórico de senhas temporárias criadas
```sql
id (SERIAL PK), user_id (FK), lock_id (FK), password_id,
nome, senha_cripto, data_inicio, data_fim, status, created_at
```

#### `activity_logs`
Log de atividades dos usuários
```sql
id (SERIAL PK), user_id (FK), acao, ip_address, detalhes (JSON),
created_at
```

---

## 🔧 Troubleshooting

### ❌ "Erro: relação 'locks' não existe"
**Solução:** Execute o schema do banco:
```bash
psql -U tuya_admin -d tuya_locks_db -f database_schema.sql
```

### ❌ "listen EADDRINUSE: address already in use :::3000"
**Solução:** Liberar porta 3000:
```bash
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### ❌ "Erro de autenticação Tuya API"
**Verificar:**
1. ✅ Client ID e Secret corretos em Settings
2. ✅ Região da API configurada corretamente
3. ✅ Dados não estão expirados na API Tuya
4. ✅ Firewall não está bloqueando requisições

### ❌ "Acomodações não carregam"
**Verificar:**
1. ✅ API Stays está configurada e acessível
2. ✅ Token de autenticação é válido
3. ✅ Banco de dados está rodando
4. ✅ Tabela `accommodations` não está vazia

---

## 🚀 Deploy

### Deploy no Heroku
```bash
# 1. Instalar Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# 2. Login
heroku login

# 3. Criar app
heroku create seu-app-name

# 4. Adicionar PostgreSQL
heroku addons:create heroku-postgresql:standard-0

# 5. Configurar variáveis
heroku config:set JWT_SECRET=sua_chave
heroku config:set TUYA_CLIENT_ID=seu_id
# ... outras variáveis

# 6. Deploy
git push heroku integration-stays:main
```

### Deploy Manual em VPS/Cloud
```bash
# 1. SSH para servidor
ssh usuario@seu-servidor.com

# 2. Clonar repositório
git clone https://github.com/ViniGarcia00/SmartLockTuya.git
cd SmartLockTuya

# 3. Instalar dependências
npm ci --production

# 4. Configurar .env
nano .env

# 5. Iniciar com PM2
npm install -g pm2
pm2 start server.js --name smartlock
pm2 startup
pm2 save
```

---

## 🧪 Testes

### Rodar Testes Unitários
```bash
npm test
```

### Rodar Testes de Integração
```bash
npm run test:integration
```

### Rodar Testes E2E
```bash
npm run test:e2e
```

### Testar API com cURL
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","senha":"senha123"}'

# Listar acomodações
curl -X GET http://localhost:3000/api/admin/accommodations \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

---

## 📝 Logging

### Níveis de Log
- `debug` - Informações detalhadas (desenvolvimento)
- `info` - Informações gerais (operação normal)
- `warn` - Avisos (situações incomuns)
- `error` - Erros (falhas em operações)

### Ver Logs
```bash
# Última 100 linhas
tail -n 100 logs/app.log

# Tempo real
tail -f logs/app.log

# Filtrar erros
grep ERROR logs/app.log
```

---

## 🔒 Segurança

### Práticas Implementadas
✅ JWT com expiração (24h)
✅ CORS configurado
✅ Helmet.js para headers HTTP
✅ Senhas com bcrypt (salt rounds: 10)
✅ Criptografia AES-128-ECB para senhas Tuya
✅ Validação de entrada em todos endpoints
✅ SQL Injection prevention (parameterized queries)
✅ Logs de auditoria completos

### Recomendações Adicionais
⚠️ Usar HTTPS em produção
⚠️ Usar rate limiting
⚠️ Implementar 2FA
⚠️ Realizar auditorias de segurança regulares
⚠️ Manter dependências atualizadas

---

## 📊 Performance

### Otimizações Implementadas
- Cache de tokens Tuya (1 hora)
- Índices de banco de dados
- Connection pooling PostgreSQL (max: 20)
- Lazy loading de dados
- Compressão GZIP

### Monitoramento
```bash
# Monitor de uso
npm run admin:monitoring

# Estatísticas
npm run admin:stats
```

---

## 🤝 Contribuição

### Workflow
1. Fork o projeto
2. Criar branch feature (`git checkout -b feature/AmazingFeature`)
3. Commit mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

### Padrões de Código
- Usar `const` por padrão
- Nomes descritivos em português/inglês
- Comentários para lógica complexa
- ESLint para validação

---

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

## 👥 Autores & Créditos

- **Desenvolvedor:** Vinicius Garcia
- **Integração Stays:** [Inicializado]
- **Agradecimentos:** Comunidade Tuya, Firebase, PostgreSQL

---

## 📞 Suporte & Contato

### Reportar Bugs
Abrir issue em: https://github.com/ViniGarcia00/SmartLockTuya/issues

### Documentação Adicional
- [Tuya Cloud API Docs](https://developer.tuya.com/en/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)

---

## 🗺️ Roadmap

### V1.0 (Atual)
- ✅ Autenticação JWT
- ✅ CRUD de Fechaduras
- ✅ Integração Tuya API
- ✅ Mapeamento Acomodações-Fechaduras
- ✅ Senhas Temporárias

### V1.1 (Próximas)
- 🔄 Integração WhatsApp
- 🔄 Dashboard avançado com gráficos
- 🔄 Relatórios PDF
- 🔄 API pública com OAuth2

### V2.0 (Futuro)
- 🔄 App mobile (React Native)
- 🔄 Multi-tenancy
- 🔄 Machine learning para sugestões
- 🔄 Integração com outros provedores (Yale, August, etc)

---

**Última atualização:** 24 de Outubro de 2025

**Branch:** integration-stays

**Status:** 🟢 Em Produção
