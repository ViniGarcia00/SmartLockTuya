# PASSO 16 - Reconciliação Periódica (Stays API)

## 📋 Visão Geral

**PASSO 16** implementa um sistema de sincronização periódica com a API Stays, garantindo que as reservas no banco de dados local estejam sempre consistentes com a fonte de verdade externa.

**Objetivo:** Executar reconciliação a cada 30 minutos, sincronizando:
- ✅ Criação de novas reservas
- ✅ Atualização de reservas existentes
- ✅ Limpeza de jobs órfãos (sem reserva correspondente)
- ✅ Rastreamento em auditoria (ReconciliationLog)

---

## 🏗️ Arquitetura

### Three-Layer Pattern

```
┌─────────────────────────────────────┐
│     BullMQ Job Queue (Redis)        │
│  Executa a cada 30 minutos          │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│   ReconciliationService (Core)      │
│  - Sync com Stays API               │
│  - Atualizar DB                     │
│  - Agendar PIN jobs                 │
│  - Limpar jobs órfãos               │
└────────────────┬────────────────────┘
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
    ┌──────┬────────┬──────────┐
    │ STAY │ Prisma │ BullMQ   │
    │ API  │  ORM   │ Queues   │
    └──────┴────────┴──────────┘
```

### Components

| Arquivo | Responsabilidade | Linhas |
|---------|------------------|--------|
| `src/lib/reconciliation-service.ts` | Service com lógica de sync | 250+ |
| `src/jobs/reconciliation.job.ts` | Job runner com BullMQ | 80+ |
| `migrations/002_create_reconciliation_log.sql` | Schema de auditoria | 60+ |
| `src/app/api/admin/reconciliation/status/route.ts` | Endpoint de visibilidade | 70+ |
| `tests/reconciliation-service.test.ts` | Testes unitários (Jest) | 350+ |

---

## 🔄 Fluxo de Reconciliação

### Execução Principal

```
1. Cron Job (*/30 * * * *)
   ↓
2. reconciliationService.reconcile()
   ├─ Fetch lastRunAt from ReconciliationLog
   ├─ staysClient.getReservationsUpdatedSince(lastRunAt)
   └─ For each staysReservation:
      ├─ processStaysReservation()
      │  ├─ Find existing by staysReservationId
      │  ├─ If new: createReservationFromStays()
      │  │  ├─ Create Reservation in DB
      │  │  ├─ scheduleJobs() [generatePin, revokePin]
      │  │  └─ Increment stats.created
      │  └─ If exists: updateReservationFromStays()
      │     ├─ Check if status/guest changed
      │     ├─ If changed: Update Reservation
      │     ├─ Reschedule jobs if confirmed
      │     └─ Increment stats.updated
      │
      ├─ cleanupOrphanedJobs()
      │  ├─ Get all jobs from generatePinQueue + revokePinQueue
      │  ├─ For each job: Find Reservation
      │  ├─ If not found: job.remove()
      │  └─ Increment stats.orphaned
      │
      └─ Create ReconciliationLog entry
         ├─ status: 'success' or 'failed'
         ├─ stats: {fetched, created, updated, orphaned, errors}
         ├─ duration: milliseconds
         └─ message: error details
```

### Cálculo de Delays para PIN

```
generatePin Job:
  Agendado para: checkIn - 2 horas
  Motivo: PIN precisa estar pronto 2h antes da entrada
  
revoke Pin Job:
  Agendado para: checkOut + 24 horas
  Motivo: Revogar PIN um dia após checkout
```

### Exemplo Timeline

```
2024-02-01 10:00 - CheckIn
  └─ generatePin agendado para: 2024-02-01 08:00 (-2h)

2024-02-05 14:00 - CheckOut
  └─ revokePin agendado para: 2024-02-06 14:00 (+24h)
```

---

## 📊 Data Structures

### ReconciliationLog Table

```sql
CREATE TABLE reconciliation_logs (
  id UUID PRIMARY KEY,
  lastRunAt TIMESTAMP,
  startedAt TIMESTAMP NOT NULL,
  completedAt TIMESTAMP,
  duration INTEGER (milliseconds),
  
  -- Stats
  fetched INTEGER,
  created INTEGER,
  updated INTEGER,
  orphaned INTEGER,
  deleted INTEGER,
  errors INTEGER,
  
  -- Metadata
  status VARCHAR (pending|success|failed),
  message TEXT,
  createdAt TIMESTAMP
);
```

### ReconciliationResult (Return)

```typescript
{
  success: boolean,
  stats: {
    fetched: number,      // Contagem da API
    created: number,      // Inserts no DB
    updated: number,      // Updates no DB
    orphaned: number,     // Jobs removidos
    deleted: number,      // Future use
    errors: number,       // Exception count
    duration: number      // ms
  },
  error?: string,         // If failed
  startedAt: Date,
  completedAt: Date
}
```

---

## 🔧 Configuração

### 1. Registrar Job (server startup)

```typescript
// In server.ts or _app initialization
import { registerReconciliationJob } from '@/jobs/reconciliation.job';

await registerReconciliationJob();
// ✅ Job registrado com padrão */30 * * * * (cada 30 min)
```

### 2. Variáveis de Ambiente

```env
# .env.local
REDIS_HOST=localhost
REDIS_PORT=6379
STAYS_API_URL=https://api.stays.example.com
STAYS_API_KEY=your-key
```

### 3. Executar Migração

```bash
# Criar tabela ReconciliationLog
psql -U your_user -d your_db -f migrations/002_create_reconciliation_log.sql

# Ou via Prisma:
npx prisma db push
```

---

## 📡 API Endpoints

### GET /api/admin/reconciliation/status

**Autenticação:** JWT Bearer token (role: admin)

**Response:**

```json
{
  "data": {
    "lastRun": {
      "id": "uuid",
      "startedAt": "2024-02-01T10:30:00Z",
      "completedAt": "2024-02-01T10:32:15Z",
      "duration": 135000,
      "status": "success",
      "message": null,
      "stats": {
        "fetched": 45,
        "created": 3,
        "updated": 12,
        "orphaned": 0,
        "deleted": 0,
        "errors": 0
      }
    },
    "nextRun": "2024-02-01T11:02:15Z",
    "currentStatus": "success",
    "schedule": "*/30 * * * * (Every 30 minutes)"
  }
}
```

### Status Codes

- `200 OK` - Sucesso
- `401 Unauthorized` - Token inválido
- `403 Forbidden` - Não é admin
- `500 Internal Server Error` - Erro no servidor

---

## 🧪 Testes

### Setup

```bash
# Install dependencies
npm install --save-dev jest @testing-library/react

# Run tests
npm test -- reconciliation-service.test.ts

# Coverage
npm test -- --coverage --testPathPattern=reconciliation
```

### Casos de Teste

```
✓ Fetch e processar reservas da API
✓ Atualizar reservas existentes quando status muda
✓ Pular reservas sem alteração
✓ Limpar jobs órfãos
✓ Registrar resultados no DB
✓ Lidar com erros e logging
✓ Agendar PIN generation 2h antes checkin
✓ Agendar PIN revocation 24h após checkout
✓ Usar job IDs corretos (gen-{id}, rev-{id})
✓ Contar reservas corretamente
✓ Rastrear erros na execução
✓ Medir duration
✓ Suportar grandes batches (1000+ items)
```

---

## 🛡️ Error Handling

### Scenarios

#### A. API Stays Indisponível

```
Job Status: failed
Message: "Failed to fetch from Stays API"
Stats: errors: 1
ReconciliationLog: status = 'failed'
Retry: Job tem 3 tentativas com backoff exponencial
```

#### B. Erro em Reserva Individual

```
Job Status: completed (com erros)
Message: "2 reservations failed"
Stats: 
  - fetched: 50
  - created: 48
  - errors: 2
ReconciliationLog: status = 'success' (parcial)
Impacto: Continua processando próximas
```

#### C. Limpeza de Jobs Órfãos Falhar

```
Não bloqueia reconciliação
Loga erro
Próxima execução tenta novamente
```

---

## 📈 Monitoring & Observability

### Logs

```typescript
// reconciliation.job.ts
logger.info('🔄 Processing reconciliation job: job-id');
logger.info('✅ Reconciliation completed successfully', stats);
logger.error('❌ Reconciliation failed:', error);

// reconciliation-service.ts
logger.info('Creating reservation from Stays', { staysId, accommodationId });
logger.warn('Reservation already exists, updating', { staysId });
logger.error('Failed to create reservation', { staysId, error });
```

### Métricas

```typescript
// Tracked in stats
const metrics = {
  fetched: 45,        // API call count
  created: 3,         // New inserts
  updated: 12,        // Existing updates
  orphaned: 0,        // Cleaned jobs
  errors: 0,          // Failures
  duration: 135000    // milliseconds
};
```

### Dashboard Query

```sql
-- Últimas 10 reconciliações
SELECT 
  "startedAt",
  status,
  duration,
  created,
  updated,
  orphaned,
  errors
FROM reconciliation_logs
ORDER BY "startedAt" DESC
LIMIT 10;

-- Erro rate
SELECT 
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM reconciliation_logs), 2) as percentage
FROM reconciliation_logs
GROUP BY status;
```

---

## 🔍 Troubleshooting

### Job não executa

```bash
# 1. Verificar Redis
redis-cli ping
> PONG

# 2. Verificar registro do job
redis-cli
> KEYS *reconciliation*

# 3. Logs
tail -f logs/reconciliation.log
```

### Reconciliação lenta

```sql
-- Verificar índices
EXPLAIN ANALYZE
SELECT * FROM reservations 
WHERE status = 'confirmed'
ORDER BY "checkIn" DESC;

-- Adicionar índice se necessário
CREATE INDEX IF NOT EXISTS idx_reservations_status_checkin
  ON reservations(status, "checkIn" DESC);
```

### Stats incorretos

```typescript
// Debug em reconciliation-service.ts
console.log('Stats before cleanup:', stats);
console.log('Orphaned jobs found:', orphanedJobs.length);
console.log('Final stats:', {
  fetched: stats.fetched,
  created: stats.created,
  updated: stats.updated,
  orphaned: stats.orphaned,
});
```

---

## 📚 Dependencies

```json
{
  "bullmq": "^4.x",
  "ioredis": "^5.x",
  "@prisma/client": "^5.x",
  "node-cron": "^3.x (alternative)"
}
```

---

## 🚀 Deployment

### Production Checklist

- [ ] Redis em produção configurado
- [ ] Variáveis de ambiente (.env.prod)
- [ ] Migração executada (ReconciliationLog table)
- [ ] Testes passando
- [ ] Logs configurados (Winston, Pino, etc)
- [ ] Alertas para falhas de reconciliação
- [ ] Backup de dados antes do deploy
- [ ] Job registrado na inicialização do servidor
- [ ] Monitoramento de duration (SLA: < 2 minutos)

### Performance Targets

```
✓ Duration: < 120 segundos (por 30 min interval)
✓ Success rate: > 99.5%
✓ Throughput: 500+ reservas/execução
✓ Redis memory: < 1GB
✓ DB connection pool: 10-20 conexões
```

---

## 📖 Referências

- [BullMQ Documentation](https://docs.bullmq.io)
- [Prisma ORM](https://www.prisma.io/docs)
- [Cron Expression](https://crontab.guru)
- [ReconciliationLog Schema](migrations/002_create_reconciliation_log.sql)
