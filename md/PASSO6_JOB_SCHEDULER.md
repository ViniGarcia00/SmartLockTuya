# PASSO 6 — Job Scheduler com BullMQ

## 📋 Visão Geral

Implementação de um sistema de fila de jobs usando BullMQ para automatizar:
- ✅ Geração de PINs 1 hora antes do check-in
- ✅ Revogação de PINs no check-out
- ✅ Retry automático com backoff exponencial
- ✅ Lock distribuído para evitar duplicatas
- ✅ Testes completos com Jest

---

## 🏗️ Arquitetura

```
┌─────────────────┐
│  Redis (Queue)  │
│  - generatePin  │
│  - revokePin    │
└────────┬────────┘
         │
    ┌────┴─────────────────────┐
    │                           │
┌───▼───────────┐      ┌──────▼──────┐
│ Worker Process│      │Worker Process│
│  generatePin  │      │  revokePin   │
│  Processor    │      │  Processor   │
└───────────────┘      └──────────────┘
         │                     │
         └──────┬──────────────┘
                │
          ┌─────▼─────┐
          │  Tuya API │ (Mock por enquanto)
          │ /Lock CMD │
          └───────────┘
```

---

## 📦 Arquivos Criados

### 1. `src/lib/queue.ts` (120+ linhas)

**Configuração principal do BullMQ:**

- **Redis Connection**: Conecta ao Redis com retry automático
- **generatePinQueue**: Fila para gerar PINs (max 5 tentativas)
- **revokePinQueue**: Fila para revogar PINs (max 5 tentativas)
- **getQueueHealth()**: Verifica status das filas

**Features:**
- Reconnect automático
- Event listeners para debug
- Health check endpoint-ready

```typescript
// Uso
import { generatePinQueue, revokePinQueue } from "@src/lib/queue";

// Jobs herdam configuração default:
// - attempts: 3
// - backoff: exponential (2s, 4s, 8s...)
// - removeOnComplete: true
// - removeOnFail: false
```

### 2. `src/lib/queue-processor.ts` (250+ linhas)

**Processadores de jobs:**

**processGeneratePin():**
- Recebe: reservationId, lockId, pin (hashed), checkInAt
- Adquire lock para evitar duplicatas
- Mock: Loga "Sending PIN to Tuya Lock"
- Simula 100ms de processamento
- Registra sucesso em Redis (24h TTL)

**processRevokePin():**
- Recebe: reservationId, lockId, checkOutAt
- Adquire lock para evitar duplicatas
- Mock: Loga "Revoking PIN from Tuya Lock"
- Simula 100ms de processamento
- Registra revogação em Redis (24h TTL)

**Retry Logic:**
- Exponential backoff: 2s, 4s, 8s
- Max 3 tentativas
- Remove do Redis após completado (sucesso)
- Mantém em Redis se falhar (para debug)

**Lock Distribuído:**
- Usa Redis SET com NX (não existe) e EX (expira)
- Expire: 60 segundos
- Previne duplicatas em múltiplos workers

```typescript
// Uso
import { createWorkers } from "@src/lib/queue-processor";
const { generatePinWorker, revokePinWorker } = createWorkers();
```

### 3. `src/lib/queue-utils.ts` (280+ linhas)

**Utilities para scheduling e gerenciamento:**

```typescript
// Agendar geração de PIN (1h antes check-in)
await scheduleGeneratePin(
  reservationId,
  lockId,
  hashedPin,
  checkInAt  // ISO string
);

// Agendar revogação (no check-out)
await scheduleRevokePin(
  reservationId,
  lockId,
  checkOutAt  // ISO string
);

// Cancelar ambos os jobs
await cancelScheduledJobs(reservationId);

// Obter status de um job
await getScheduledJobStatus(reservationId, "generate");
// Retorna: { jobId, state, data, attempts, delay }

// Listar todos os jobs em uma fila
await listQueueJobs("generatePin");
// Retorna: { waiting: [], active: [], completed: [], failed: [] }

// Limpar jobs falhados
await clearFailedJobs("generatePin");
```

### 4. `src/lib/queue-utils.test.ts` (350+ linhas)

**Testes completos com Jest:**

✅ **Test Cases (20+):**

1. **Schedule Generate PIN**
   - ✅ Agenda job com sucesso
   - ✅ Calcula delay correto (1h antes)
   - ✅ Permite agendamento imediato se check-in próximo

2. **Schedule Revoke PIN**
   - ✅ Agenda job com sucesso
   - ✅ Calcula delay correto (check-out)

3. **Cancel Jobs**
   - ✅ Cancela ambos generate e revoke
   - ✅ Lida com cancelamento parcial
   - ✅ Retorna falso se não houver jobs

4. **Get Job Status**
   - ✅ Retorna null se job não existe
   - ✅ Retorna status correto para generate
   - ✅ Retorna status correto para revoke

5. **List Queue Jobs**
   - ✅ Lista todos os jobs de generate
   - ✅ Lista todos os jobs de revoke

6. **Error Handling**
   - ✅ Lida com datas inválidas
   - ✅ Lida com reservationId faltando

7. **Integration**
   - ✅ Schedule completo > Status > Cancel

---

## 🚀 Como Usar

### 1. Instalar Dependências

```bash
npm install bullmq ioredis
```

✅ Já instalado em PASSO 6

### 2. Configurar Redis (`.env`)

```bash
REDIS_URL=redis://localhost:6379
```

✅ Já configurado

### 3. Usar no Código

```typescript
import {
  scheduleGeneratePin,
  scheduleRevokePin,
  cancelScheduledJobs,
} from "@src/lib/queue-utils";

// No handler de webhook (quando reserva é criada)
await scheduleGeneratePin(
  reservation.id,
  accommodation.lockId,
  await hashPin("1234567"),
  reservation.checkInAt
);

await scheduleRevokePin(
  reservation.id,
  accommodation.lockId,
  reservation.checkOutAt
);

// Se cancelada
await cancelScheduledJobs(reservation.id);
```

### 4. Iniciar Workers

```typescript
import { createWorkers } from "@src/lib/queue-processor";

// Na inicialização do servidor
const { generatePinWorker, revokePinWorker } = createWorkers();

// Graceful shutdown
process.on("SIGTERM", async () => {
  await generatePinWorker.close();
  await revokePinWorker.close();
  await closeQueues();
});
```

### 5. Monitorar Saúde

```typescript
import { getQueueHealth } from "@src/lib/queue";

const health = await getQueueHealth();
console.log(health);
/* 
{
  redis: "connected",
  generatePinQueue: {
    waiting: 5,
    active: 2,
    failed: 0,
    completed: 45
  },
  revokePinQueue: {
    waiting: 3,
    active: 1,
    failed: 0,
    completed: 40
  }
}
*/
```

---

## 📊 Fluxo de Execução

### Cenário: Reserva Confirmada

```
1. Webhook recebido: "reservation.created"
   └─ Salvo em WebhookEvent (PASSO 5)

2. PASSO 7 (futuro): Database Route processa
   └─ Cria Credential (PIN hashed)
   └─ Chama scheduleGeneratePin()

3. Job criado em Redis (estado: "delayed")
   └─ delay = (checkInAt - 1h) - now()

4. Quando delay passa (1h antes check-in):
   ├─ Job muda para "active"
   ├─ Worker processGeneratePin() é chamado
   ├─ Adquire lock (evita duplicata)
   ├─ Mock: console.log "Sending PIN..."
   ├─ Registra em Redis com TTL 24h
   └─ Job muda para "completed"

5. Similarmente para revoke PIN:
   ├─ Agendado no check-out
   ├─ Processado no horário exato
   ├─ Mock: console.log "Revoking PIN..."
   └─ Registrado em Redis

6. Se falhar:
   ├─ Retry automático (tentativa 1, 2, 3)
   ├─ Backoff exponencial: 2s, 4s, 8s
   ├─ Se 3 falhas, fica em "failed"
   └─ Admin pode limpar com clearFailedJobs()
```

---

## 🔍 Monitoramento e Debug

### Ver Fila de Jobs (Development)

```bash
# Terminal 1: Iniciar Redis
redis-cli

# Terminal 2: Ver jobs agendados
> KEYS *gen-pin*
> GET pin:generated:reservation-123
> LRANGE bull:generatePin:waiting 0 -1
```

### Ver Logs

```bash
npm run dev

# Vará:
[INFO] Scheduled Generate PIN job { jobId: 'gen-pin-res-123', ... }
[INFO] [Worker] Generate PIN completed { jobId: 'gen-pin-res-123' }
```

---

## 🧪 Executar Testes

```bash
# Todos os testes PASSO 6
npm test -- queue-utils.test.ts

# Com coverage
npm test -- queue-utils.test.ts --coverage

# Watch mode
npm test -- queue-utils.test.ts --watch
```

**Cobertura:**
- ✅ 20+ testes
- ✅ scheduling
- ✅ cancellation
- ✅ status checking
- ✅ error handling
- ✅ integration flow

---

## 📈 Configuração Tuning

### `src/lib/queue.ts`

```typescript
generatePinQueue = new Queue(..., {
  defaultJobOptions: {
    attempts: 3,           // ← Aumentar para mais tentativas
    backoff: {
      type: "exponential",
      delay: 2000,         // ← Aumentar para mais espera
    },
    removeOnComplete: true,     // ← Limpar após sucesso
    removeOnFail: false,        // ← Manter falhas para debug
  },
});
```

### `src/lib/queue-processor.ts`

```typescript
// Aumentar concorrência
new Worker("generatePin", processor, {
  concurrency: 5,          // ← Podem ser 10+ em produção
});
```

---

## 🔐 Segurança

✅ **Implementado:**

1. **Lock Distribuído**
   - Previne processamento duplicado
   - Timeout automático (60s)

2. **PIN Hashing**
   - Armazenado como hash bcrypt
   - plainPin apenas transitório

3. **Audit Trail**
   - Registra sucessos e falhas
   - Redis TTL 24h

4. **Isolamento**
   - Workers rodam em processo separado
   - Erros não afetam servidor

---

## 🚨 Troubleshooting

### Redis Não Conecta

```bash
# Verificar se Redis está rodando
redis-cli ping
# Resposta: PONG

# Se não, iniciar
redis-server

# Ou usar Docker
docker run -d -p 6379:6379 redis:7
```

### Jobs Não São Processados

```bash
# 1. Verificar se workers estão rodando
# (veja logs: "[Worker] Generate PIN...")

# 2. Verificar Redis
redis-cli
> LRANGE bull:generatePin:active 0 -1
> LRANGE bull:generatePin:waiting 0 -1

# 3. Limpar jobs falhados
await clearFailedJobs("generatePin");
```

### Lock Permanece Travado

```bash
# Locks expiram automaticamente em 60s
# Se precisar limpar manualmente:
redis-cli
> DEL lock:reservation-123
```

---

## 🎯 Próximos Passos (PASSO 7)

### Integrar com Database Routes

```typescript
// Em routes/locks.ts (PASSO 7)
POST /api/reservations/:id/confirm

// Handler:
1. Criar Credential no Prisma
2. Chamar scheduleGeneratePin()
3. Chamar scheduleRevokePin()
4. Retornar confirmação ao cliente
```

---

## 📝 Checklist PASSO 6

- ✅ BullMQ + ioredis instalados
- ✅ Queue config (`src/lib/queue.ts`)
- ✅ Job processors (`src/lib/queue-processor.ts`)
- ✅ Queue utils (`src/lib/queue-utils.ts`)
- ✅ Testes (20+ test cases)
- ✅ Redis URL em `.env`
- ✅ Documentação completa
- ✅ Worker creation exported
- ✅ Lock distribuído implementado
- ✅ Retry logic com backoff

---

## 🎉 Status PASSO 6

**Status:** ✅ CONCLUÍDO  
**Arquivos Criados:** 4 (queue.ts, processor.ts, utils.ts, test.ts)  
**Linhas de Código:** 1000+  
**Testes:** 20+  
**Cobertura:** Complete flow  

---

**Próximo:** PASSO 7 — Database Routes (CRUD + Webhook Integration)

Data: 23/10/2025  
Versão: 1.0.0-passo6
