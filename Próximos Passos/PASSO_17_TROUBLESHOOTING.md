# 🔧 PASSO 17 - Guia de Troubleshooting

Guia de diagnóstico e solução de problemas para executar testes de integração.

---

## 🚨 Erros Comuns & Soluções

### ❌ ERRO 1: Cannot find module 'jest'

**Mensagem Completa:**
```
Error: Cannot find module 'jest'
```

**Causa:** npm dependencies não instaladas

**Solução:**
```bash
# 1. Instalar todas as dependências
npm install

# 2. Verificar se jest foi instalado
npm list jest

# 3. Se ainda não funcionar, limpar cache
rm -rf node_modules package-lock.json
npm install
```

---

### ❌ ERRO 2: ECONNREFUSED - Não consegue conectar PostgreSQL

**Mensagem Completa:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
Error: P1000: Can't reach database server at `localhost:5432`
```

**Causa:** PostgreSQL não está rodando ou DATABASE_URL incorreta

**Solução:**

#### Opção A: Iniciar PostgreSQL

**Windows (PowerShell como Admin):**
```powershell
# 1. Verificar se está instalado
Get-Service PostgreSQL*

# 2. Iniciar serviço
Start-Service PostgreSQL14  # ou PostgreSQL13, PostgreSQL15, etc.

# 3. Verificar status
Get-Service PostgreSQL*
```

**macOS:**
```bash
# 1. Com Homebrew
brew services start postgresql

# 2. Ou manual
postgres -D /usr/local/var/postgres
```

**Linux:**
```bash
# 1. Iniciar
sudo systemctl start postgresql

# 2. Verificar status
sudo systemctl status postgresql
```

#### Opção B: Verificar DATABASE_URL

```bash
# 1. Ver variável atual
echo $DATABASE_URL

# 2. Deve ser no formato:
# postgresql://username:password@localhost:5432/database_name

# 3. Atualizar em .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/tuya_locks_test

# 4. Verificar credenciais
psql -U postgres -d postgres -c "SELECT 1"
```

#### Opção C: Verificar Banco Existe

```bash
# 1. Conectar ao PostgreSQL
psql -U postgres

# 2. Listar bancos
\l

# 3. Se não existir tuya_locks_test, criar
CREATE DATABASE tuya_locks_test;

# 4. Listar novamente
\l

# 5. Sair
\q
```

#### Opção D: Executar Migrations

```bash
# 1. Verificar se schema existe
npx prisma db push

# 2. Ou migrar
npx prisma migrate dev

# 3. Verificar schema com GUI
npx prisma studio
```

---

### ❌ ERRO 3: ECONNREFUSED - Não consegue conectar Redis

**Mensagem Completa:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
Redis connection failed
```

**Causa:** Redis não está rodando ou REDIS_URL incorreta

**Solução:**

#### Opção A: Iniciar Redis

**Windows (via WSL ou Docker):**
```bash
# Com WSL
wsl sudo systemctl start redis-server

# Com Docker
docker run -d -p 6379:6379 redis:7-alpine
```

**macOS:**
```bash
# Com Homebrew
brew services start redis

# Ou manual
redis-server
```

**Linux:**
```bash
# Iniciar
sudo systemctl start redis-server

# Verificar status
sudo systemctl status redis-server
```

#### Opção B: Verificar REDIS_URL

```bash
# 1. Configurar .env
REDIS_URL=redis://localhost:6379/1

# 2. Testar conexão
redis-cli ping
# Esperado: PONG

# 3. Se falhar, verificar se está rodando
redis-cli
# Deve conectar e mostrar prompt > 
```

#### Opção C: Usar Docker para Redis

```bash
# 1. Iniciar Redis em container
docker run -d --name redis-test -p 6379:6379 redis:7-alpine

# 2. Verificar
docker ps | grep redis

# 3. Testar
redis-cli ping

# 4. Parar quando terminar
docker stop redis-test
docker rm redis-test
```

---

### ❌ ERRO 4: "relation 'Accommodation' does not exist"

**Mensagem Completa:**
```
PrismaClientKnownRequestError: Invalid `prisma.accommodation.create()`
relation 'Accommodation' does not exist in the database
```

**Causa:** Tabelas não foram criadas (migrations não executadas)

**Solução:**

```bash
# 1. Opção A: Executar todas as migrations
npx prisma migrate dev

# 2. Opção B: Reset completo (LIMPA DADOS!)
npx prisma migrate reset

# 3. Opção C: Sincronizar schema
npx prisma db push

# 4. Verificar schema foi criado
npx prisma studio

# 5. Se ainda falhar, checar arquivo migration
ls -la prisma/migrations/
```

---

### ❌ ERRO 5: "Test timeout - test did not complete within 30000ms"

**Mensagem Completa:**
```
● Full-Flow Integration Tests › Scenario 1: Creation of Reservation
  Error: Test timeout - test did not complete within 30000 ms
```

**Causa:** Operação de DB levou mais de 30 segundos

**Solução:**

#### Opção A: Aumentar Timeout Globalmente

```javascript
// jest.setup.js
jest.setTimeout(60000);  // 60 segundos
```

#### Opção B: Aumentar por Test

```typescript
describe('Full-Flow', () => {
  test('Scenario 1', async () => {
    jest.setTimeout(45000);
    // test code
  }, 45000);  // Timeout específico
});
```

#### Opção C: Otimizar Query

```typescript
// ❌ Lento - N+1 queries
const reservations = await db.reservation.findMany();
for (const r of reservations) {
  await db.credential.findMany({where: {reservationId: r.id}});
}

// ✅ Rápido - Include
const reservations = await db.reservation.findMany({
  include: {credentials: true}
});
```

#### Opção D: Limpar Dados Entre Testes

```typescript
// AfterEach para limpar rápido
afterEach(async () => {
  // Deletar em batch ao invés de um por um
  await db.credential.deleteMany();
  await db.reservation.deleteMany();
});
```

---

### ❌ ERRO 6: "Cannot find module '@/types'"

**Mensagem Completa:**
```
Error: Cannot find module '@/types'
Require stack: src/__tests__/integration/full-flow.test.ts
```

**Causa:** Path alias '@/' não configurada em tsconfig.json ou jest.config.js

**Solução:**

#### Opção A: Verificar tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

#### Opção B: Verificar jest.config.js

```javascript
module.exports = {
  preset: 'ts-jest',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

#### Opção C: Usar Caminhos Relativos (Workaround)

```typescript
// Ao invés de
import { Reservation } from '@/types';

// Usar
import { Reservation } from '../../../src/types';
```

---

### ❌ ERRO 7: "env variable is not defined"

**Mensagem Completa:**
```
Error: process.env.DATABASE_URL is not defined
Error: process.env.JWT_SECRET is not defined
```

**Causa:** Variáveis de ambiente não configuradas

**Solução:**

#### Opção A: Configurar .env

```bash
# 1. Criar arquivo .env na raiz do projeto
cat > .env << EOF
NODE_ENV=test
DATABASE_URL=postgresql://postgres:password@localhost:5432/tuya_locks_test
REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test-secret-key
EOF

# 2. Verificar arquivo foi criado
cat .env

# 3. Recarregar shell
source .env  # Linux/macOS
$env:DATABASE_URL  # Windows PowerShell
```

#### Opção B: Configurar no jest.setup.js

```javascript
// jest.setup.js
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 
  'postgresql://postgres:password@localhost:5432/tuya_locks_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-secret-key';
```

#### Opção C: Usar dotenv

```bash
# Instalar
npm install dotenv

# Usar em jest.setup.js
require('dotenv').config({path: '.env.test'});
```

---

### ❌ ERRO 8: "Cannot read property 'id' of undefined"

**Mensagem Completa:**
```
TypeError: Cannot read property 'id' of undefined
at Object.<anonymous> (src/__tests__/integration/full-flow.test.ts:45:10)
```

**Causa:** Objeto não foi criado (falha na criação ou query retornou null)

**Solução:**

```typescript
// ❌ Errado - sem verificação
const accommodation = await db.accommodation.create({...});
const id = accommodation.id;  // Pode ser undefined!

// ✅ Correto - com verificação
const accommodation = await db.accommodation.create({...});
expect(accommodation).toBeDefined();
expect(accommodation.id).toBeDefined();
const id = accommodation!.id;
```

---

### ❌ ERRO 9: "Transaction timeout"

**Mensagem Completa:**
```
Error: Transaction timeout
PrismaClientKnownRequestError: Transaction failed due to timeout
```

**Causa:** Muitas queries em transação ou query muito lenta

**Solução:**

```typescript
// ❌ Usar transação mesmo quando não precisa
await db.$transaction([
  db.accommodation.create({...}),
  db.lock.create({...}),
  db.mapping.create({...}),
  // ... 50 mais operações
]);

// ✅ Criar dados sequencialmente
const acc = await db.accommodation.create({...});
const lock = await db.lock.create({...});
const mapping = await db.mapping.create({...});
```

---

### ❌ ERRO 10: "FATAL: sorry, too many clients already"

**Mensagem Completa:**
```
FATAL: sorry, too many clients already
P1000: Can't reach database server at `localhost:5432`
```

**Causa:** Pool de conexões esgotado

**Solução:**

```bash
# 1. Verificar conexões abertas
psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# 2. Matar conexões inativas
psql -U postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname='tuya_locks_test' AND pid <> pg_backend_pid();
"

# 3. Resetar database
npx prisma migrate reset

# 4. Aumentar pool de conexões no Prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
}
```

---

## ✅ CHECKLIST DE PRÉ-REQUISITOS

Antes de rodar testes, verificar:

### Banco de Dados
```bash
# ✅ PostgreSQL rodando
psql -U postgres -c "SELECT 1"

# ✅ Banco de testes existe
psql -U postgres -l | grep tuya_locks_test

# ✅ Migrations executadas
npx prisma db push

# ✅ Tabelas existem
psql -U postgres -d tuya_locks_test -c "\dt"
```

### Redis
```bash
# ✅ Redis rodando
redis-cli ping
# Esperado: PONG

# ✅ Conectar ao banco 1
redis-cli -n 1 ping
```

### Node.js
```bash
# ✅ Versão correta
node --version  # v16.x ou superior

# ✅ npm funciona
npm --version

# ✅ Dependências instaladas
npm list jest @prisma/client typescript
```

### Variáveis de Ambiente
```bash
# ✅ DATABASE_URL configurada
echo $DATABASE_URL
# postgresql://postgres:password@localhost:5432/tuya_locks_test

# ✅ REDIS_URL configurada
echo $REDIS_URL
# redis://localhost:6379/1

# ✅ JWT_SECRET configurada
echo $JWT_SECRET
# test-secret-key (qualquer string)
```

---

## 🚀 RECUPERAÇÃO RÁPIDA

Se algo quebrou, executar em ordem:

```bash
# 1. Limpar dependências
rm -rf node_modules package-lock.json
npm install

# 2. Resetar banco de dados
npx prisma migrate reset

# 3. Verificar conexões
psql -U postgres -d tuya_locks_test -c "SELECT 1"
redis-cli ping

# 4. Rodar testes
npm run test:integration

# 5. Se falhar novamente, debug detalhado
npm test -- --verbose full-flow.test.ts
```

---

## 🎯 VALIDAÇÃO

Testes devem ser executados **sem erros** e com output tipo:

```
PASS  src/__tests__/integration/full-flow.test.ts (8.234 s)
  Full-Flow Integration Tests
    ✓ Scenario 1: Creation of Reservation (1200 ms)
    ✓ Scenario 2: Update of Reservation (800 ms)
    ✓ Scenario 3: Cancellation (600 ms)
    ✓ Scenario 4: Reconciliation (1500 ms)
    ✓ ACID Consistency Test (800 ms)

Test Suites: 4 passed, 4 total
Tests:       23 passed, 23 total
Time:        23.824 s
```

---

**Se após seguir este guia os testes ainda não passarem, verifique logs detalhados:**

```bash
npm test -- --verbose --bail full-flow.test.ts 2>&1 | tee test.log
```

---

*Última atualização: 2024*  
*Versão: PASSO 17 - Troubleshooting Guide*
