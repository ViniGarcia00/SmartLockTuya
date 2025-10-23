# PASSO 1 — Setup da Branch Base para Integração Stays

**Data:** 23 de Outubro de 2025  
**Branch:** `integration-stays`  
**Status:** ✅ Pronta para desenvolvimento

---

## 1️⃣ Comandos Git Executados

### Criar e configurar a branch

```bash
# 1. Atualizar local com remoto (antes de criar branch)
git fetch origin
git pull origin main

# 2. Criar branch a partir de main
git checkout -b integration-stays

# 3. Confirmar que está na branch correta
git branch -v
git status

# 4. Verificar que está sincronizada com main
git log --oneline -3
```

### Status Atual
```
Branch: integration-stays
Commit mais recente: 8c203c8 "Funcionando e Limpo!!!!!"
Sincronizado com: main ✓
Working tree: clean ✓
```

---

## 2️⃣ Verificações de Dependências e Ambiente

### 2.1 Verificação de Dependências Node.js

```bash
# Listar dependências instaladas
npm list

# Verificar package.json
cat package.json | grep -A 20 "dependencies"

# Reinstalar se necessário
npm install
```

**Dependências Críticas para Stays Integration:**
- `express` - Framework web ✓
- `pg` - PostgreSQL client ✓
- `jsonwebtoken` - JWT auth ✓
- `bcryptjs` - Password hashing ✓
- `crypto` - Para HMAC Tuya API ✓
- `dotenv` - Variáveis de ambiente ✓

### 2.2 Verificação de Variáveis de Ambiente

```bash
# Verificar arquivo .env
cat .env

# Variáveis requeridas para funcionamento básico:
# - NODE_ENV
# - PORT
# - JWT_SECRET
# - SESSION_SECRET
# - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
# - EMAIL_* (opcional para integração Stays)
# - APP_URL
```

**Status .env:** ⚠️ Verificar se todas as variáveis estão configuradas

### 2.3 Verificação de Banco de Dados

```bash
# Conectar ao PostgreSQL e verificar schema
psql -h localhost -U tuya_admin -d tuya_locks_db -c "\dt"

# Tabelas esperadas:
# - users
# - tuya_configs
# - locks
# - temporary_passwords
# - user_sessions
# - activity_logs (opcional)
```

**Status BD:** ✓ Verificar conexão e schema

### 2.4 Verificação de Build

```bash
# Verificar se há erros de sintaxe
node -c server.js

# Executar linter (se configurado)
npm run lint 2>/dev/null || echo "Linter não configurado"

# Iniciar servidor em modo desenvolvimento
npm run dev  # ou node server.js
```

---

## 3️⃣ Checklist de Confirmação

Marque cada item conforme verificado:

### ✅ Configuração da Branch
- [ ] Branch `integration-stays` criada com sucesso
- [ ] Branch baseada em `main` (commit: 8c203c8)
- [ ] Status do Git: `On branch integration-stays`
- [ ] Working tree: `clean` (sem alterações pendentes)

### ✅ Ambiente Node.js
- [ ] Node.js instalado (`node --version`)
- [ ] npm instalado (`npm --version`)
- [ ] `npm install` executado com sucesso
- [ ] Sem erros de instalação de pacotes

### ✅ Dependências Verificadas
- [ ] `express` instalado
- [ ] `pg` (PostgreSQL) instalado
- [ ] `jsonwebtoken` instalado
- [ ] `bcryptjs` instalado
- [ ] `crypto` disponível (built-in)
- [ ] `dotenv` instalado

### ✅ Variáveis de Ambiente (.env)
- [ ] Arquivo `.env` existe
- [ ] `NODE_ENV` configurado
- [ ] `PORT` configurado
- [ ] `JWT_SECRET` configurado
- [ ] `SESSION_SECRET` configurado
- [ ] Credenciais do banco de dados configuradas
- [ ] `APP_URL` configurado

### ✅ Banco de Dados
- [ ] PostgreSQL rodando localmente (ou remoto acessível)
- [ ] Conexão com BD testada
- [ ] Tabela `users` existe
- [ ] Tabela `tuya_configs` existe
- [ ] Tabela `locks` existe
- [ ] Tabela `temporary_passwords` existe
- [ ] Todas as colunas esperadas presentes

### ✅ Verificação de Código
- [ ] `server.js` sem erros de sintaxe
- [ ] `middleware/auth.js` sem erros
- [ ] `routes/auth.js` sem erros
- [ ] `config/database.js` sem erros

### ✅ Teste de Inicialização
- [ ] Servidor inicia sem erros: `npm start` ou `node server.js`
- [ ] Servidor responde em `http://localhost:3000`
- [ ] Frontend carrega (login.html acessível)
- [ ] Console sem erros críticos

### ✅ Pronto para Integração Stays
- [ ] **Todos os itens acima marcados ✓**
- [ ] Branch `integration-stays` sincronizada e pronta
- [ ] Nenhuma alteração pendente no código
- [ ] Documentação de setup concluída

---

## 4️⃣ Próximos Passos

Após marcar ✅ em todos os itens acima, você está pronto para:

1. **PASSO 2:** Análise e modelagem da integração Stays
   - Estudar API do Stays
   - Mapear fluxos de integração
   - Definir novo schema de banco de dados

2. **PASSO 3:** Implementação da integração
   - Criar modelos e rotas para Stays
   - Implementar autenticação Stays
   - Integrar com sistema de fechaduras

3. **PASSO 4:** Testes e validação
   - Testes unitários
   - Testes de integração
   - Testes end-to-end

---

## 5️⃣ Comandos de Referência Rápida

```bash
# Ver em qual branch está
git branch

# Ver status
git status

# Ver commits recentes
git log --oneline -10

# Sincronizar com main (se necessário)
git pull origin main

# Enviar branch para remoto (quando pronto)
git push -u origin integration-stays

# Voltar para main
git checkout main

# Deletar branch (quando finalizado)
git branch -d integration-stays
```

---

**Documento criado em:** 23/10/2025  
**Branch:** `integration-stays`  
**Versão:** 1.0
