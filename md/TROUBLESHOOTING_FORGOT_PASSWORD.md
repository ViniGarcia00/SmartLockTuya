# 🔧 TROUBLESHOOTING: Email de Recuperação de Senha

## 🎯 Árvore de Decisão - Qual é o Seu Problema?

```
┌─ Não está enviando email
│  ├─ Verifique se o usuário existe e está verificado
│  ├─ Veja os logs do servidor [FORGOT-PASSWORD]
│  └─ Execute: npm run test:forgot-password
│
├─ Email não chega na caixa
│  ├─ Procure em SPAM
│  ├─ Adicione conta@outmat.com.br aos contatos seguros
│  └─ Execute: npm run test:email
│
├─ Link do email não funciona
│  ├─ Verifique APP_URL em .env
│  ├─ Confirme que server.js está rodando
│  └─ Tente copiar URL e colar no navegador
│
├─ Erro 500 ao clicar em "Esqueci a Senha"
│  ├─ Verifique o console do navegador (F12)
│  ├─ Observe os logs do servidor
│  └─ Execute: npm run test:forgot-password
│
└─ Outra situação?
   └─ Siga o diagrama de debug abaixo
```

---

## 🔍 Diagrama de Debug

### Passo 1: Verificar Configuração de Email

```bash
npm run test:email
```

**Resultado esperado:**
```
✓ Transporter configurado com sucesso
✓ Conexão com servidor de email verificada com sucesso!
✅ Email enviado com sucesso!
```

**Se falhar:**
- ❌ `EAUTH` → Credenciais incorretas em `.env`
- ❌ `ECONNREFUSED` → HOST/PORT incorretos
- ❌ `ETIMEDOUT` → Problema de firewall/rede
- ❌ Outro erro → Abra um issue com a mensagem

---

### Passo 2: Verificar Fluxo Completo

```bash
npm run test:forgot-password
```

**Resultado esperado:**
```
✅ Conectado ao PostgreSQL
✅ Email configurado: conta@outmat.com.br
✅ Usuário encontrado: Usuário Teste
✅ Token salvo no banco de dados
✅ Email enviado com sucesso!
✅ Dados no banco de dados verificados
✅ TESTE COMPLETO EXECUTADO COM SUCESSO!
```

**Se falhar em qual passo:**

| Passo | Se Falhar | Solução |
|-------|-----------|---------|
| PostgreSQL | "Erro ao conectar" | Confirme DB_HOST, DB_PORT, credenciais em .env |
| Email | "Erro ao verificar email" | Execute `npm run test:email` para debug |
| Usuário | "Email não encontrado" | Registre um novo usuário em `/register.html` |
| Token | "Erro ao salvar token" | Verifique permissões no banco de dados |
| Email | "Erro ao enviar email" | Veja erro específico do Nodemailer |

---

### Passo 3: Verificar Banco de Dados

```sql
-- Conecte ao PostgreSQL:
psql -U tuya_admin -d tuya_locks_db

-- Execute:
SELECT id, nome, email, email_verificado, ativo, token_reset_senha 
FROM users 
WHERE email = 'teste@example.com';
```

**Checklist:**
- [ ] Email existe na tabela?
- [ ] `email_verificado` = true?
- [ ] `ativo` = true?
- [ ] Após teste, `token_reset_senha` mudou?

---

### Passo 4: Verificar Logs do Servidor

```bash
npm start
# Em outro terminal:
npm run test:forgot-password
```

**Procure por:**
```
📨 [FORGOT-PASSWORD] Solicitação recebida para:
✓ [FORGOT-PASSWORD] Usuário encontrado:
✓ [FORGOT-PASSWORD] Token gerado:
✓ [FORGOT-PASSWORD] Token salvo no banco de dados
📧 [FORGOT-PASSWORD] Iniciando envio de email...
✅ [FORGOT-PASSWORD] Email enviado com sucesso!
```

**Se ver erro:**
```
❌ [FORGOT-PASSWORD] Erro ao enviar email:
   - Mensagem: ...
   - Code: ...
```

Anote o erro e verifique a tabela abaixo.

---

## 🚨 Tabela de Erros Comuns

### Erro: "relação users não existe"
**Causa:** Tabelas não foram criadas
```bash
npm run db:setup
```

### Erro: "ECONNREFUSED"
**Causa:** PostgreSQL não está rodando
```bash
# Windows - iniciar PostgreSQL
# Ou configure o host correto em .env
```

### Erro: "EAUTH"
**Causa:** Credenciais de email incorretas
```
Verifique em .env:
- EMAIL_USER deve ser endereço completo
- EMAIL_PASSWORD deve ser a senha de app (para Gmail)
- Para Hostinger, ative SMTP na conta
```

### Erro: "Email não chegou"
**Checklist:**
1. [ ] Verifiquei SPAM?
2. [ ] Adicionei remetente aos contatos?
3. [ ] Executi `npm run test:email` com sucesso?
4. [ ] Esperei 5 minutos?
5. [ ] Verifiquei em outro provedor de email?

### Erro: "ETIMEOUT na conexão SMTP"
**Causa:** Firewall ou problema de rede
**Solução:**
1. Verifique firewall/antivírus
2. Tente de outra rede (mobile data)
3. Confirme que porta 465 está aberta

### Erro: "ENOTFOUND smtp.hostinger.com"
**Causa:** Problema de DNS
**Solução:**
1. Verifique conexão de internet
2. Tente `ping smtp.hostinger.com`
3. Reinicie o server

---

## 📊 Fluxo Esperado com Screenshots

### ✅ Frontend - Página de Recuperação

```
Tuya Locks
════════════════════════════════════════
    🔐 Recuperar Acesso

Digite seu email para receber instruções
de redefinição de senha

┌─────────────────────────────────┐
│ Email                           │
│ seu.email@example.com           │
└─────────────────────────────────┘

    [Enviar Link de Recuperação]
    [Voltar para Login]

Lembrou da sua senha? Fazer Login
════════════════════════════════════════
```

### ✅ Backend - Logs do Servidor

```
📨 [FORGOT-PASSWORD] Solicitação recebida para: seu.email@example.com
✓ [FORGOT-PASSWORD] Usuário encontrado: Seu Nome (ID: 123)
✓ [FORGOT-PASSWORD] Token gerado: a95a17152429b2c22fe8...
✓ [FORGOT-PASSWORD] Token salvo no banco de dados
📧 [FORGOT-PASSWORD] Iniciando envio de email...
   - Remetente: conta@outmat.com.br
   - Destinatário: seu.email@example.com
   - Serviço: smtp
✅ [FORGOT-PASSWORD] Email enviado com sucesso!
   - Message ID: <50d7ba46-8dda-a689-83ae-c32e7559deea@outmat.com.br>
   - Response: 250 2.0.0 Ok: queued as 4ct49X3X0Qz2xB9
```

### ✅ Email Recebido

```
╔════════════════════════════════════════╗
║  🔐 Tuya Locks - Redefinir Senha      ║
╚════════════════════════════════════════╝

Olá Seu Nome,

Você solicitou a redefinição de senha. Clique no botão abaixo:

    [Redefinir Minha Senha]

Ou copie: http://localhost:3000/reset-password.html?token=a95a17152...

⏰ Este link expira em 1 hora.

Se você não solicitou, ignore este email.
════════════════════════════════════════
```

---

## 🎛️ Variáveis de Ambiente - Guia Completo

```env
# ===== EMAIL (Hostinger SMTP) =====
EMAIL_SERVICE=smtp                    # Tipo: 'smtp' ou 'gmail'
EMAIL_HOST=smtp.hostinger.com         # Servidor SMTP
EMAIL_PORT=465                        # Porta (465 para SSL)
EMAIL_SECURE=true                     # Use SSL
EMAIL_USER=conta@outmat.com.br        # Email da conta
EMAIL_PASSWORD=Epm240t100c@n          # Senha da app/conta

# ===== BANCO DE DADOS =====
DB_HOST=localhost                     # Host PostgreSQL
DB_PORT=5432                          # Porta PostgreSQL
DB_NAME=tuya_locks_db                 # Nome do banco
DB_USER=tuya_admin                    # Usuário
DB_PASSWORD=Epm240t100c@n             # Senha

# ===== APLICAÇÃO =====
APP_URL=http://localhost:3000         # URL da app (para links de email)
PORT=3000                             # Porta do servidor
NODE_ENV=development                  # Ambiente

# ===== SEGURANÇA =====
JWT_SECRET=chave_super_secreta_...    # Chave JWT
SESSION_SECRET=outra_chave_secreta... # Chave Session
```

---

## ✅ Checklist Final de Verificação

```
ANTES DE CONSIDERAR PRONTO:

[ ] npm run test:email executa com sucesso
[ ] npm run test:forgot-password executa com sucesso
[ ] Email de teste foi recebido
[ ] Logs mostram [FORGOT-PASSWORD] sem erros
[ ] Banco de dados tem a tabela users
[ ] APP_URL está correto em .env
[ ] EMAIL_USER e EMAIL_PASSWORD estão corretos
[ ] Usuário cadastrado tem email_verificado = true
[ ] Usuário cadastrado tem ativo = true
[ ] Servidor está rodando (npm start)
[ ] Pode clicar em "Esqueci a Senha" na interface
[ ] Email chega em menos de 1 minuto
[ ] Link do email funciona e abre reset-password.html
```

---

## 🆘 Se Ainda Não Funcionar

### Reúna estas informações:

1. **Saída de `npm run test:email`:**
   ```bash
   npm run test:email > error1.txt 2>&1
   ```

2. **Saída de `npm run test:forgot-password`:**
   ```bash
   npm run test:forgot-password > error2.txt 2>&1
   ```

3. **Logs do servidor durante teste:**
   ```bash
   npm start > server.log 2>&1
   # Em outro terminal:
   npm run test:forgot-password
   # Copie o conteúdo de server.log
   ```

4. **Query do banco:**
   ```sql
   SELECT * FROM users LIMIT 5;
   ```

5. **Conteúdo do .env (sem senhas sensíveis):**
   ```env
   EMAIL_SERVICE=smtp
   EMAIL_HOST=smtp.hostinger.com
   EMAIL_PORT=465
   # ... rest
   ```

Compartilhe estas informações e ajudarei a resolver!

---

## 📞 Suporte Rápido

| Problema | Comando Rápido |
|----------|----------------|
| Testar email | `npm run test:email` |
| Testar fluxo completo | `npm run test:forgot-password` |
| Ver logs | `npm start` (em novo terminal) |
| Criar usuário de teste | Registre em `/register.html` |
| Resetar banco | `npm run db:setup` |
| Verificar PostgreSQL | `psql -U tuya_admin -d tuya_locks_db` |

---

**Última atualização:** 23 de Outubro de 2025
**Status:** Sistema testado e aprovado ✅
**Próximo passo:** Execute `npm run test:forgot-password` agora!
