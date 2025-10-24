# 🔧 Debug: Erro de Login 500 - RESOLVIDO

## Problema Identificado

**Erro**: `POST http://localhost:3000/api/auth/login 500 (Internal Server Error)`

**Causa Raiz**: As tabelas do banco de dados não foram criadas
- Tabela `users` não existia
- Tabela `user_sessions` não existia  
- Tabela `activity_logs` não existia

---

## Solução Implementada

### 1. ✅ Criadas as tabelas do banco de dados

**Arquivo**: `database_schema.sql`
```sql
CREATE TABLE IF NOT EXISTS users (...)
CREATE TABLE IF NOT EXISTS user_sessions (...)
CREATE TABLE IF NOT EXISTS activity_logs (...)
```

### 2. ✅ Criado script de setup automatizado

**Arquivo**: `scripts/setup-db.js`
- Cria todas as 3 tabelas necessárias
- Insere um usuário de teste automaticamente
- Fornece credenciais prontas para uso

### 3. ✅ Adicionado comando npm

**package.json**:
```json
"db:setup": "node scripts/setup-db.js"
```

---

## Como Usar

### Passo 1: Executar o setup do banco de dados
```bash
npm run db:setup
```

**Saída esperada**:
```
🔄 Iniciando setup do banco de dados...
📝 Criando tabela users...
✅ Tabela users criada
📝 Criando tabela user_sessions...
✅ Tabela user_sessions criada
📝 Criando tabela activity_logs...
✅ Tabela activity_logs criada
📝 Criando usuário de teste...
✅ Usuário de teste criado

📋 Credenciais de teste:
   Email: teste@example.com
   Senha: senha123

✅ Setup do banco de dados concluído com sucesso!
```

### Passo 2: Iniciar o servidor
```bash
npm start
```

A saída deve ser:
```
Servidor rodando em http://localhost:3000
Conectado ao banco de dados PostgreSQL
```

### Passo 3: Acessar e fazer login
- Abrir: `http://localhost:3000/login.html`
- Email: `teste@example.com`
- Senha: `senha123`
- Clicar em "Entrar"

---

## Arquivos Criados/Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `database_schema.sql` | ✅ Criado | Schema completo do banco |
| `migrations/002_create_activity_logs.sql` | ✅ Criado | Migration para tabela de logs |
| `scripts/setup-db.js` | ✅ Criado | Script de configuração do BD |
| `package.json` | ✅ Modificado | Adicionado comando `db:setup` |

---

## Estrutura das Tabelas

### users
```
- id (SERIAL PRIMARY KEY)
- nome (VARCHAR)
- empresa (VARCHAR)
- email (VARCHAR UNIQUE)
- whatsapp (VARCHAR UNIQUE)
- senha_hash (VARCHAR)
- email_verificado (BOOLEAN)
- token_verificacao (VARCHAR UNIQUE)
- token_reset_senha (VARCHAR UNIQUE)
- ativo (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### user_sessions
```
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER - referencia users)
- session_id (VARCHAR UNIQUE)
- device_info (TEXT)
- ip_address (VARCHAR)
- created_at (TIMESTAMP)
- expires_at (TIMESTAMP)
- ativo (BOOLEAN)
```

### activity_logs
```
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER - referencia users)
- acao (VARCHAR)
- ip_address (VARCHAR)
- user_agent (TEXT)
- detalhes (JSONB)
- created_at (TIMESTAMP)
```

---

## Fluxo de Login Após Fix

```
1. Usuário clica "Entrar"
   ↓
2. Frontend envia POST /api/auth/login com email + senha
   ↓
3. Backend busca usuário na tabela users ✅
   ↓
4. Valida senha com bcrypt ✅
   ↓
5. Invalida sessões anteriores (user_sessions) ✅
   ↓
6. Cria nova sessão em user_sessions ✅
   ↓
7. Gera JWT token com 12h de validade ✅
   ↓
8. Registra atividade em activity_logs ✅
   ↓
9. Retorna token para frontend
   ↓
10. Frontend salva token no localStorage
   ↓
11. Frontend redireciona para /dashboard.html
```

---

## Testes Adicionais

### Testar com curl (POST)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@example.com",
    "senha": "senha123"
  }'
```

**Resposta esperada**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "session_id": "abc123def456...",
  "expiresIn": 43200,
  "user": {
    "id": 1,
    "nome": "Usuário Teste",
    "email": "teste@example.com",
    "empresa": "Empresa Teste",
    "whatsapp": null
  }
}
```

---

## Próximas Etapas

### 1. ✅ Verificar Dashboard
Após login com sucesso, deve redirecionar para `/dashboard.html`

### 2. ✅ Adicionar mais usuários
```bash
# Criar via interface de registro em /register.html
OU
# Inserir diretamente no PostgreSQL
INSERT INTO users (nome, email, senha_hash, email_verificado) VALUES (...);
```

### 3. ✅ Configurar Tuya
- Acesse Settings
- Insira credenciais da Tuya Cloud API
- Teste conexão

### 4. ✅ Adicionar Fechaduras
- Sincronize dispositivos Tuya
- Adicione à dashboard
- Crie senhas temporárias

---

## Troubleshooting

### Problema: "relação users não existe"
**Solução**: Execute `npm run db:setup` novamente

### Problema: "Email ou senha incorretos" mesmo com credenciais corretas
**Solução**: 
1. Verifique se o email existe em `users`
2. Verifique se `email_verificado` é `true`
3. Teste com credenciais padrão: `teste@example.com` / `senha123`

### Problema: Erro de conexão ao banco
**Solução**:
1. Verifique se PostgreSQL está rodando
2. Verifique variáveis `.env`:
   - `DB_HOST`
   - `DB_PORT`
   - `DB_NAME`
   - `DB_USER`
   - `DB_PASSWORD`

### Problema: Token inválido após login
**Solução**:
1. Verifique se `JWT_SECRET` está definido em `.env`
2. Limpe localStorage (`F12` → Application → Clear storage)
3. Faça login novamente

---

## Variáveis de Ambiente Necessárias

```bash
# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tuya_locks_db
DB_USER=tuya_admin
DB_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your_jwt_secret_key

# Email (Opcional)
EMAIL_SERVICE=gmail
EMAIL_USER=seu-email@gmail.com
EMAIL_PASSWORD=app-password

# App
APP_URL=http://localhost:3000
```

---

## Status: ✅ RESOLVIDO

O erro de login 500 foi resolvido. O sistema agora:
- ✅ Cria todas as tabelas necessárias automaticamente
- ✅ Insere usuário de teste pronto para usar
- ✅ Gerencia sessões corretamente
- ✅ Registra atividades no audit log
- ✅ Emite tokens JWT válidos

**Acesse agora**: `http://localhost:3000/login.html`
