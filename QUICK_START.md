# 🚀 Quick Start — SmartLock Tuya (PASSO 5)

## ⚡ Início Rápido (5 minutos)

### 1️⃣ Ver o Banco de Dados (Interface Gráfica)
```bash
npm run db:studio
# Abre http://localhost:5555
# Clique em cada tabela para ver os dados
```

### 2️⃣ Popular Dados de Teste
```bash
npm run db:seed
# Cria automaticamente:
# - 3 acomodações
# - 3 fechaduras Tuya
# - 2 reservas
# - 2 credenciais (PINs)
# - 2 webhooks
# - 2 logs de auditoria
```

### 3️⃣ Começar a Desenvolver
```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Exemplo: Buscar uma acomodação
const accommodation = await prisma.accommodation.findFirst({
  where: { staysAccommodationId: "ACC-STY-001" }
});

// Exemplo: Buscar todas as reservas confirmadas
const reservations = await prisma.reservation.findMany({
  where: { status: "CONFIRMED" },
  include: { 
    accommodation: true,
    credentials: true 
  }
});

// Exemplo: Criar uma nova credencial
const credential = await prisma.credential.create({
  data: {
    reservationId: reservation.id,
    lockId: lock.id,
    pin: hashedPin,
    validFrom: new Date(),
    validTo: new Date(),
  }
});
```

---

## 📚 Documentação Disponível

| Arquivo | Para Quem | Conteúdo |
|---------|----------|---------|
| `PASSO5_MODELO_DADOS.md` | 🛠️ Developers | Guia técnico completo, exemplos |
| `PASSO5_RESUMO.md` | 👔 PMs/Leads | Arquitetura, Features, Timeline |
| `PASSO5_FINAL.txt` | 📊 Stakeholders | Estatísticas, Checklist, Status |
| `PROGRESSO.md` | 🔄 Project Manager | Status geral, Próximos passos |
| `README_VISAO_GERAL.md` | 🎯 Todos | Visão geral do projeto |
| `prisma/README.md` | 🗄️ Database team | Instruções Prisma, Troubleshooting |

---

## 🔧 Scripts Úteis

```bash
# Desenvolvimento
npm run dev                  # Inicia servidor Express

# Banco de Dados
npm run db:seed            # Popula dados de teste
npm run db:studio          # Abre UI gráfica
npm run db:migrate         # Executa migrations pendentes

# Testes
npm test                   # Executa todos os testes
npm test -- webhook.test   # Testa apenas webhooks
npm run test:coverage      # Gera relatório de cobertura

# Code Quality
npm run lint               # Verifica linting
npm run lint:fix           # Corrige problemas
npm run format             # Formata código

# Mock
npm run mock:stays         # Inicia mock server Stays
```

---

## 🎯 As 7 Tabelas Explicadas

### 📦 Accommodation
**O que:** Acomodações (imóveis alugados)  
**Vem de:** Stays API  
**Exemplo:**
```json
{
  "id": "cmh41mr2w0000rh8c4dtsm31n",
  "staysAccommodationId": "ACC-STY-001",
  "name": "Apartamento Centro Luxo",
  "status": "ACTIVE"
}
```

### 🔐 Lock
**O que:** Fechaduras inteligentes  
**Vem de:** Cadastro manual do admin  
**Exemplo:**
```json
{
  "id": "cmh41mr8s0003rh8c2k4n5o9p",
  "vendor": "TUYA",
  "deviceId": "bf3db4a6b2d8c0f1e2a3b4c5",
  "alias": "Fechadura Porta Principal"
}
```

### 🔗 AccommodationLock
**O que:** Relacionamento entre acomodação e fechadura  
**Regra:** Uma acomodação = uma fechadura  
**Exemplo:**
```json
{
  "id": "cmh41mr9t0004rh8cgk3a1b2c",
  "accommodationId": "cmh41mr2w0000rh8c4dtsm31n",
  "lockId": "cmh41mr8s0003rh8c2k4n5o9p",
  "createdBy": "admin@example.com"
}
```

### 📅 Reservation
**O que:** Reservas de hóspedes  
**Vem de:** Stays webhooks  
**Exemplo:**
```json
{
  "id": "cmh41mrb20005rh8cc4m5n6o7p",
  "staysReservationId": "RES-STY-202510-001",
  "accommodationId": "cmh41mr2w0000rh8c4dtsm31n",
  "checkInAt": "2025-10-24T15:00:00Z",
  "checkOutAt": "2025-10-26T10:00:00Z",
  "status": "CONFIRMED"
}
```

### 🔑 Credential
**O que:** PINs temporários de acesso  
**Válido:** Apenas durante a reserva  
**Exemplo:**
```json
{
  "id": "cmh41mrc40006rh8cdp6q7r8s9t",
  "reservationId": "cmh41mrb20005rh8cc4m5n6o7p",
  "lockId": "cmh41mr8s0003rh8c2k4n5o9p",
  "pin": "$2b$10$hashed...",           // ← Hash bcrypt
  "plainPin": "1234567",                // ← Temporário para envio
  "status": "ACTIVE",
  "validFrom": "2025-10-24T16:00:00Z",
  "validTo": "2025-10-26T10:00:00Z"
}
```

### 📡 WebhookEvent
**O que:** Registro de todos os eventos recebidos  
**Objetivo:** Auditoria completa  
**Exemplo:**
```json
{
  "id": "cmh41mrd50007rh8cep7s8t9u0v",
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "reservation.created",
  "reservationId": "cmh41mrb20005rh8cc4m5n6o7p",
  "rawBody": { "full": "webhook", "payload": "..." },
  "processed": true,
  "processedAt": "2025-10-23T23:17:33Z"
}
```

### 📝 AuditLog
**O que:** Log de todas as ações do sistema  
**Objetivo:** Compliance + debugging  
**Exemplo:**
```json
{
  "id": "cmh41mre60008rh8cfq8s9t0u1v",
  "action": "CREATE_CREDENTIAL",
  "entity": "Credential",
  "entityId": "cmh41mrc40006rh8cdp6q7r8s9t",
  "userId": "admin@example.com",
  "details": { "pin": "1234567", "... ": "..." }
}
```

---

## 🔍 Queries Comuns

### Buscar acomodação com sua fechadura
```typescript
const accommodation = await prisma.accommodation.findFirst({
  where: { staysAccommodationId: "ACC-STY-001" },
  include: {
    locks: {
      include: { lock: true }
    }
  }
});
```

### Listar PINs ativos para hoje
```typescript
const activeCredentials = await prisma.credential.findMany({
  where: {
    status: "ACTIVE",
    validFrom: { lte: new Date() },
    validTo: { gte: new Date() }
  },
  include: { reservation: true, lock: true }
});
```

### Buscar eventos não processados
```typescript
const failedWebhooks = await prisma.webhookEvent.findMany({
  where: { processed: false },
  orderBy: { createdAt: 'desc' }
});
```

### Contar PINs por status
```typescript
const stats = await prisma.credential.groupBy({
  by: ['status'],
  _count: true
});
```

---

## 🐛 Troubleshooting Rápido

### "Erro: DATABASE_URL não encontrado"
✅ **Solução:** Verificar `.env` tem `DATABASE_URL` configurada
```bash
# Verificar
cat .env | grep DATABASE_URL

# Configurar se não existir
echo "DATABASE_URL=postgresql://user:pass@localhost:5432/db?schema=public" >> .env
```

### "Erro: Database não conecta"
✅ **Solução:** PostgreSQL precisa estar rodando
```bash
# Windows/Mac/Linux
# Verificar se PostgreSQL está ativo
# ou usar Docker: docker run -d -p 5432:5432 postgres:15
```

### "Tabelas não existem"
✅ **Solução:** Executar migrations
```bash
npx prisma migrate dev
```

### "Seed deu erro"
✅ **Solução:** Fazer reset e tentar novamente
```bash
npx prisma migrate reset
# ⚠️ Isso deleta TODOS os dados!
```

---

## 📊 Ver Dados com SQL Direto

```bash
# Se preferir SQL nativo em vez de Prisma Studio

# Conectar ao PostgreSQL
psql tuya_locks_db -U tuya_admin

# Listar acomodações
SELECT * FROM "Accommodation";

# Listar PINs ativos
SELECT * FROM "Credential" WHERE status = 'ACTIVE';

# Ver webhooks processados
SELECT * FROM "WebhookEvent" WHERE processed = true;

# Sair
\q
```

---

## 🎓 Próximos Passos (PASSO 6)

Depois de PASSO 5, começar PASSO 6 — Job Scheduler:

```bash
# PASSO 6 criará:
# 1. Fila BullMQ para credenciais
# 2. Job para gerar PINs automaticamente
# 3. Job para revogar PINs
# 4. Job para enviar notificações
# 5. Sincronização com Tuya API

# Estimado: 2-3 horas de desenvolvimento
```

---

## 💡 Tips & Tricks

### Resetar tudo e começar do zero
```bash
npx prisma migrate reset
npm run db:seed
npm run db:studio
```

### Gerar nova migração após mudanças
```bash
# 1. Editar prisma/schema.prisma
# 2. Executar:
npx prisma migrate dev --name descriptive_name
# 3. Arquivo SQL será criado em prisma/migrations/
```

### Exibir SQL gerado pelo Prisma
```bash
# Adicionar ao .env:
DATABASE_URL=postgresql://...?schema=public&log=query
# Agora todas as queries SQL aparecem no console
```

### Usar Prisma Client em scripts
```bash
# Exemplo: copiar script.ts com:
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ... seu código

# Executar:
npx ts-node script.ts
```

---

## 📞 Ajuda Rápida

**Pergunta:** Como adicionar uma nova tabela?  
**Resposta:** Editar `prisma/schema.prisma` → `npx prisma migrate dev --name add_table`

**Pergunta:** Como mudar um campo existente?  
**Resposta:** Editar campo → `npx prisma migrate dev --name modify_table`

**Pergunta:** Como deletar uma tabela?  
**Resposta:** Remover do schema → `npx prisma migrate dev --name delete_table`

**Pergunta:** Como fazer backup do banco?  
**Resposta:** `pg_dump tuya_locks_db > backup.sql`

**Pergunta:** Como restaurar backup?  
**Resposta:** `psql tuya_locks_db < backup.sql`

---

## 🎉 Status

✅ **PASSO 5 CONCLUÍDO**
- 7 tabelas criadas
- 13 registros de teste
- Tipos TypeScript 100%
- Documentação pronta

🚀 **PRÓXIMO: PASSO 6**
- Job Scheduler com BullMQ
- Automação de PINs
- Sincronização Tuya API

---

**Última atualização:** 23/10/2025  
**Versão:** 1.0.0-passo5  
**Branch:** integration-stays

💬 **Tem dúvidas?** Veja `PASSO5_MODELO_DADOS.md` ou `prisma/README.md`
