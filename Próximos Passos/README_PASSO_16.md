# PASSO 16 - RECONCILIAÇÃO - QUICK START

## 🚀 5-Minutos Setup

### 1. Confirmar Arquivos Criados

```bash
ls -la src/lib/reconciliation-service.ts
ls -la src/jobs/reconciliation.job.ts
ls -la src/app/api/admin/reconciliation/status/route.ts
ls -la migrations/002_create_reconciliation_log.sql
ls -la tests/reconciliation-service.test.ts
```

### 2. Executar Migração

```bash
# Via psql (recomendado)
psql -U tuya_admin -d tuya_locks_db \
  -f migrations/002_create_reconciliation_log.sql

# Via Prisma
npx prisma db push

# Verificar
psql -U tuya_admin -d tuya_locks_db -c \
  "\d reconciliation_logs"
```

### 3. Adicionar ao .env.local

```env
REDIS_HOST=localhost
REDIS_PORT=6379
STAYS_API_URL=https://api.stays.example.com
STAYS_API_KEY=your-api-key
```

### 4. Registrar Job no Server

Em `server.ts` (ou startup file):

```typescript
import { registerReconciliationJob } from '@/jobs/reconciliation.job';

// Na função de inicialização:
async function bootstrap() {
  // ... other setup
  
  await registerReconciliationJob();
  console.log('✅ Reconciliation job registered');
  
  // ... start server
}

bootstrap();
```

### 5. Testar Endpoint

```bash
# Obter token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"..."}' \
  | jq -r '.token')

# Chamar endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/reconciliation/status
```

---

## 📊 Verificação de Status

### Verificar Logs do Job

```bash
# Terminal 1: Monitorar Redis
redis-cli MONITOR

# Terminal 2: Ver jobs
redis-cli
> KEYS *reconciliation*
> HGETALL bull:reconciliation:1:data
```

### Verificar Database

```sql
-- Últimas reconciliações
SELECT id, status, fetched, created, updated, duration, "startedAt"
FROM reconciliation_logs
ORDER BY "startedAt" DESC
LIMIT 5;

-- Próxima execução
SELECT 
  MAX("completedAt") + INTERVAL '30 minutes' as "nextRun",
  status
FROM reconciliation_logs
ORDER BY "completedAt" DESC
LIMIT 1;
```

### Monitorar via API

```bash
# Chamar a cada 30 segundos
watch -n 30 'curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/reconciliation/status | jq'
```

---

## 🧪 Rodar Testes

### Uncomment Test Cases

```bash
# Abrir tests/reconciliation-service.test.ts
# Remover os comentários /* */ dos casos de teste
# Salvar
```

### Executar

```bash
# Tudo
npm test -- reconciliation-service.test.ts

# Específico
npm test -- reconciliation-service.test.ts -t "should fetch and process"

# Com coverage
npm test -- --coverage reconciliation-service.test.ts
```

---

## 🔍 Debugging

### Logs

```typescript
// Em reconciliation-service.ts
logger.info('Starting reconciliation', { timestamp: new Date() });
logger.info(`Processing ${staysReservations.length} reservations`);
logger.error('Failed to create reservation', { staysId, error });
```

### Stats

```bash
# Verificar últimas stats
psql -U tuya_admin -d tuya_locks_db -c \
  "SELECT status, fetched, created, updated, orphaned, errors, duration
   FROM reconciliation_logs
   ORDER BY id DESC
   LIMIT 1;"
```

### Redis Flush (Reset em Dev)

```bash
redis-cli FLUSHALL  # ⚠️ SOMENTE EM DESENVOLVIMENTO!
```

---

## 🚨 Troubleshooting

### Job não executa

```bash
# 1. Redis rodando?
redis-cli ping
# Esperado: PONG

# 2. Job registrado?
redis-cli KEYS bull:reconciliation*
# Esperado: múltiplas keys

# 3. Worker rodando?
# Verificar em server logs
tail -f logs/app.log | grep reconciliation

# 4. Limpar e reregistrar
redis-cli DEL bull:reconciliation:*
# Reiniciar servidor
```

### API retorna 401

```bash
# 1. Token válido?
jwt.verify(token, process.env.JWT_SECRET)

# 2. User é admin?
SELECT role FROM users WHERE id = $1;

# 3. Bearer format correto?
Authorization: Bearer eyJ0eX...
```

### Reconciliação lenta

```sql
-- Adicionar índices se necessário
CREATE INDEX idx_reservations_status_checkin
  ON reservations(status, "checkIn" DESC)
  WHERE status = 'confirmed';

-- Verificar query plan
EXPLAIN ANALYZE
SELECT * FROM reservations
WHERE status = 'confirmed'
ORDER BY "checkIn" DESC
LIMIT 100;
```

---

## 📈 Monitoramento

### Métricas Importantes

```typescript
const target = {
  duration: '< 120 segundos',           // Por ciclo de 30 min
  successRate: '> 99.5%',               // Sem falhas recorrentes
  throughput: '> 500 reservas/ciclo',   // Handles scale
  redisMemory: '< 1GB',                 // Queue memory
  dbConnections: '10-20',               // Pool size
};
```

### Alertas a Configurar

- [ ] Job failure (status = 'failed')
- [ ] Duration > 120s
- [ ] Error count > 5
- [ ] Redis memory > 800MB
- [ ] No execution in 60 minutes

### Dashboard Query

```sql
-- Performance overview
SELECT 
  COUNT(*) as total_runs,
  AVG(duration) as avg_duration,
  MAX(duration) as max_duration,
  SUM(created) as total_created,
  SUM(updated) as total_updated,
  SUM(orphaned) as total_orphaned,
  (SELECT COUNT(*) FILTER (WHERE status = 'failed'))::float / COUNT(*) * 100 as error_rate
FROM reconciliation_logs
WHERE "startedAt" > NOW() - INTERVAL '24 hours';
```

---

## 🔄 Cycling Through Reconciliation

### Manual Trigger (Dev Only)

```typescript
// Arquivo temporário: scripts/trigger-reconciliation.ts
import { reconciliationService } from '@/lib/reconciliation-service';

async function main() {
  console.log('🔄 Triggering reconciliation...');
  const result = await reconciliationService.reconcile();
  console.log('✅ Result:', result);
}

main().catch(console.error);
```

```bash
npx ts-node scripts/trigger-reconciliation.ts
```

---

## 📋 Checklist

- [ ] SQL migration executed
- [ ] ReconciliationLog table created
- [ ] .env variables set
- [ ] registerReconciliationJob() called in startup
- [ ] Server restarted
- [ ] API endpoint responds 200
- [ ] First job executed (check Redis/DB)
- [ ] Stats tracked correctly
- [ ] Tests passing
- [ ] Documentation reviewed

---

## 🎓 Conceitos Principais

### Reconciliação

**O quê:** Sync com API externa (source of truth)
**Por quê:** Detectar mudanças, manter consistência
**Como:** Fetch updates → Create/Update locally → Log resultado

### Jobs Órfãos

**Problema:** Jobs em queue mas reserva deletada
**Solução:** Query todos jobs → Verificar reserva existe
**Resultado:** Remove jobs sem par → stats.orphaned++

### PIN Timing

**Generate:** 2 horas ANTES do check-in (tempo suficiente)
**Revoke:** 24 horas DEPOIS do check-out (buffer para demorado)

---

## 🆘 Suporte

**Documentação Completa:** `PASSO_16_RECONCILIATION.md`
**Checklist Detalhado:** `PASSO_16_CHECKLIST.txt`
**Log Files:** `logs/reconciliation.log`

---

## ✅ Success Indicators

✓ Log: "✅ Reconciliation job registered"
✓ DB: `SELECT * FROM reconciliation_logs LIMIT 1;` retorna row
✓ API: GET /api/admin/reconciliation/status retorna 200
✓ Stats: created/updated/orphaned > 0 ou = 0 (sem erros)
✓ Redis: KEYS bull:reconciliation* não vazio

---

**Próximo Passo:** Monitorar primeira execução (30 minutos após startup)
