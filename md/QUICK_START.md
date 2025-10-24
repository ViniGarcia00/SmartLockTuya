# ⚡ Quick Start - SmartLock Tuya

## 1️⃣ Primeira Vez? Setup Rápido

```bash
# Clone ou abra o projeto
cd /caminho/para/Tuya-v20

# 1. Configure o banco de dados
npm run db:setup

# 2. Inicie o servidor
npm start

# 3. Acesse no navegador
http://localhost:3000/login.html
```

### Credenciais de Teste
- **Email**: `teste@example.com`
- **Senha**: `senha123`

---

## 2️⃣ Verificar Status

```bash
# Servidor rodando?
# Deve aparecer: "Servidor rodando em http://localhost:3000"

# Banco conectado?
# Deve aparecer: "Conectado ao banco de dados PostgreSQL"

# Sem erros de tabelas?
# NÃO deve aparecer: "relação users não existe"
```

---

## 3️⃣ Erros Comuns e Soluções

### ❌ Erro: "relação users não existe" (500 error no login)
```bash
npm run db:setup
```

### ❌ Erro: "Cannot connect to database"
```bash
# Verificar se PostgreSQL está rodando
# Windows: pg_ctl status -D "C:\Program Files\PostgreSQL\data"
# Linux: sudo systemctl status postgresql
```

### ❌ Erro: "Email ou senha incorretos"
- Verifique email: `teste@example.com`
- Verifique senha: `senha123`
- Tente criar novo usuário em `/register.html`

### ❌ Erro: "Por favor, confirme seu email"
- O email precisa estar verificado
- Use o usuário de teste que já está verificado
- Ou verifique o email criado

---

## 4️⃣ Criar Novo Usuário

### Via Interface
1. Acesse `http://localhost:3000/register.html`
2. Preencha o formulário
3. Confirme seu email
4. Faça login

### Via Banco de Dados
```sql
-- Conectar ao PostgreSQL
psql -U tuya_admin -d tuya_locks_db

-- Inserir usuário
INSERT INTO users (nome, empresa, email, whatsapp, senha_hash, email_verificado, ativo)
VALUES (
  'Seu Nome',
  'Sua Empresa',
  'seu-email@example.com',
  '+55 11 99999-9999',
  'hash_da_senha_aqui',
  true,
  true
);
```

Para gerar hash da senha em Node.js:
```javascript
const bcrypt = require('bcrypt');
bcrypt.hash('sua-senha', 10, (err, hash) => console.log(hash));
```

---

## 5️⃣ Configurar Tuya API

### Passo 1: Obter credenciais
1. Acesse [Tuya Cloud](https://auth.tuya.com)
2. Crie conta developer
3. Crie projeto IoT
4. Gere chaves:
   - `client_id`
   - `client_secret`

### Passo 2: Configurar no .env
```bash
TUYA_CLIENT_ID=seu_client_id
TUYA_CLIENT_SECRET=seu_client_secret
TUYA_REGION_HOST=openapi.tuyaus.com  # ou openapi.tuyaeu.com
```

### Passo 3: Adicionar Tuya no Dashboard
1. Faça login
2. Vá para Settings
3. Insira as credenciais
4. Teste conexão

---

## 6️⃣ Sincronizar Acomodações (PASSO 11)

### Testar Endpoint
```bash
curl -X POST http://localhost:3000/api/admin/stays/sync-accommodations \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Resposta Esperada
```json
{
  "success": true,
  "created": 5,
  "updated": 2,
  "inactivated": 1,
  "total": 8,
  "errors": [],
  "details": {
    "requestId": "uuid",
    "startedAt": "2025-10-24T00:30:23.363Z",
    "completedAt": "2025-10-24T00:30:23.400Z",
    "duration": 37
  }
}
```

---

## 7️⃣ Variáveis de Ambiente Essenciais

```bash
# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tuya_locks_db
DB_USER=tuya_admin
DB_PASSWORD=seu_password

# Segurança
JWT_SECRET=seu_jwt_secret_seguro
SESSION_SECRET=seu_session_secret_seguro
ADMIN_TOKEN=seu_admin_token_seguro

# Email
EMAIL_SERVICE=gmail
EMAIL_USER=seu-email@gmail.com
EMAIL_PASSWORD=sua-app-password

# App
APP_URL=http://localhost:3000
NODE_ENV=development

# Tuya
TUYA_CLIENT_ID=seu_id
TUYA_CLIENT_SECRET=seu_secret
TUYA_REGION_HOST=openapi.tuyaus.com
```

---

## 8️⃣ Estrutura de Pastas

```
Tuya-v20/
├── server.js                    # Servidor Express principal
├── routes/
│   └── auth.js                  # Rotas de autenticação
├── middleware/
│   └── auth.js                  # Middleware JWT
├── public/
│   ├── login.html              # Página de login
│   ├── register.html           # Página de registro
│   ├── dashboard.html          # Dashboard principal
│   └── settings.html           # Configurações
├── config/
│   └── database.js             # Conexão PostgreSQL
├── scripts/
│   └── setup-db.js             # Setup do banco
├── migrations/
│   ├── 001_create_user_sessions.sql
│   └── 002_create_activity_logs.sql
└── database_schema.sql         # Schema completo
```

---

## 9️⃣ Comandos Úteis

```bash
# Desenvolvimento
npm start                  # Inicia servidor
npm run dev               # Modo desenvolvimento

# Banco de Dados
npm run db:setup         # Cria tabelas e usuário teste
npm run db:migrate       # Executa migrações Prisma

# Testes
npm test                 # Executa testes
npm run test:watch      # Modo watch

# Code Quality
npm run lint            # Verifica linting
npm run lint:fix        # Corrige linting
npm run format          # Formata código

# Mock/Desenvolvimento
npm run mock:stays      # Inicia mock do Stays API
```

---

## 🔟 Logs e Debugging

### Ver logs em tempo real
```bash
npm start
# Você verá:
# ✓ Servidor rodando
# ✓ Conectado ao banco de dados
# ✓ Requisições HTTP
# ✓ Erros de SQL
```

### Console do Navegador (F12)
- Network: Veja requisições HTTP
- Console: Mensagens de erro JavaScript
- Application: Veja localStorage (token JWT)

### Verificar Token JWT
```javascript
// No console do navegador (F12):
localStorage.getItem('token')
```

---

## ✅ Checklist de Setup

- [ ] PostgreSQL instalado e rodando
- [ ] `.env` configurado com credenciais do BD
- [ ] `npm install` executado
- [ ] `npm run db:setup` executado com sucesso
- [ ] `npm start` rodando sem erros
- [ ] Consegue acessar `http://localhost:3000`
- [ ] Consegue fazer login com `teste@example.com` / `senha123`
- [ ] Dashboard aparecer após login

---

## 📞 Precisa de Ajuda?

1. **Leia**: `DEBUG_LOGIN_500_RESOLVIDO.md`
2. **Veja**: `PASSO11_DELIVERABLES_INDEX.md`
3. **Estude**: Arquivos dentro de `Próximos Passos/`
4. **Verifique**: Variáveis de ambiente em `.env.example`

---

**Status**: ✅ Sistema pronto para uso!
