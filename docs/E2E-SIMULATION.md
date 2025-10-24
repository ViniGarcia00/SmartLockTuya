# PASSO 20 - Simulação E2E Completa

## 📋 Visão Geral

A simulação E2E (End-to-End) testa o fluxo completo do sistema SmartLock Tuya do início ao fim:

```
Sincronizar Acomodações
       ↓
Mapear Fechaduras
       ↓
Receber Webhook de Reserva
       ↓
Gerar PIN (time-warp T-2h)
       ↓
Validar PIN (view admin)
       ↓
Revogar PIN (time-warp T-checkout)
       ↓
Validar Logs e Tabelas
       ↓
✓ Simulação Completa
```

---

## 🚀 Como Rodar

### Pré-requisitos

1. **Banco de dados PostgreSQL** rodando e configurado
2. **Redis** rodando (para BullMQ)
3. **API** rodando ou pronta para testes
4. **Variáveis de ambiente** configuradas:

```bash
# .env
API_URL=http://localhost:3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tuya_locks_db
DB_USER=tuya_admin
DB_PASSWORD=<sua-senha>
REDIS_URL=redis://localhost:6379
```

### Executar Teste

```bash
# Executar simulação E2E completa
npm run test:e2e

# Com watch mode (reexecuta ao salvar)
npm run test:e2e:watch

# Apenas com saída estruturada (sem colors)
npm run test:e2e -- --colors=false
```

---

## 📊 O que o Teste Valida

### ✅ Etapa 1: Sincronizar Acomodações

**Endpoint:** `POST /api/admin/stays/sync-accommodations`

**Valida:**
- Acomodações são sincronizadas da API Stays
- Mínimo de 5 acomodações criadas
- Tabela `accommodations` preenchida com:
  - `id` (UUID)
  - `external_id` (Stays ID)
  - `name`
  - `address`
  - `created_at` (timestamp)

**Saída:**
```
✓ Acomodações sincronizadas (5 criadas)
```

---

### ✅ Etapa 2: Mapear Fechaduras

**Endpoint:** `POST /api/admin/mappings`

**Valida:**
- 5 mapeamentos accommodation → lock criados
- Tabela `accommodation_locks` preenchida com:
  - `id` (UUID)
  - `accommodation_id` (FK)
  - `lock_id` (ID da fechadura)
  - `lock_provider` (ex: 'mock', 'tuya')
  - `name`
  - `created_at`

**Payload:**
```json
{
  "mappings": [
    {
      "accommodationId": "acc-1",
      "lockId": "mock_lock_1",
      "name": "Fechadura 1"
    },
    // ... 4 mais
  ]
}
```

**Saída:**
```
✓ Fechaduras mapeadas (5 mapeamentos criados)
```

---

### ✅ Etapa 3: Receber Webhook de Reserva

**Endpoint:** `POST /api/webhooks/stays/reservation`

**Valida:**
- Webhook é recebido e validado
- Reserva é criada no banco:
  - `id` (UUID)
  - `external_id` (Stays ID)
  - `accommodation_id` (FK)
  - `guest_name`
  - `guest_email`
  - `guest_phone`
  - `check_in_at` (timestamp)
  - `check_out_at` (timestamp)
  - `status` ('confirmed', 'pending', etc)
  - `created_at`

**Payload:**
```json
{
  "eventType": "reservation.created",
  "data": {
    "id": "res_123",
    "accommodationId": "acc-1",
    "guestName": "Test Guest",
    "guestEmail": "guest@test.com",
    "guestPhone": "+5511999999999",
    "checkInDate": "2025-10-25",
    "checkOutDate": "2025-10-28",
    "checkInTime": "14:00",
    "checkOutTime": "11:00",
    "numberOfGuests": 2,
    "status": "confirmed",
    "totalPrice": 1000,
    "currency": "BRL"
  }
}
```

**Saída:**
```
✓ Webhook recebido e processado (Reserva: res-123)
```

---

### ✅ Etapa 4: Gerar PIN (Time-Warp T-2h)

**Validações:**
- Time-warp para 2 horas antes do check-in
- Credencial é criada no banco:
  - `id` (UUID)
  - `reservation_id` (FK)
  - `accommodation_lock_id` (FK)
  - `pin_hashed` (SHA256)
  - `status` ('active', 'revoked', etc)
  - `created_at`
  - `revoked_at` (NULL até revogação)

**Fluxo interno:**
1. Job `generatePin` é disparado
2. PIN é gerado (7 dígitos)
3. PIN é hasheado (SHA256)
4. Armazenado no banco
5. Mock lock provider é chamado (se configurado)

**Saída:**
```
✓ PIN gerado (Credential: cred-456)
```

---

### ✅ Etapa 5: Validar PIN (View Admin)

**Endpoint:** `GET /api/admin/reservations/{reservationId}/pin`

**Validações:**
- PIN é retornado mascarado: `****` + últimos 2 dígitos
- Formato: `****XX` (ex: `****45`)
- Apenas admins podem ver
- PIN completo nunca é exposto

**Resposta:**
```json
{
  "success": true,
  "data": {
    "reservation_id": "res-123",
    "pin_masked": "****45",
    "created_at": "2025-10-25T12:00:00Z"
  }
}
```

**Saída:**
```
✓ PIN visível para admin (****45)
```

---

### ✅ Etapa 6: Revogar PIN (Time-Warp T-Checkout)

**Validações:**
- Time-warp para horário de checkout
- Credencial é atualizada:
  - `status` = 'revoked'
  - `revoked_at` = timestamp do checkout
- Job `revokePin` executado
- Mock lock provider é notificado

**Fluxo interno:**
1. Job `revokePin` é disparado no checkout
2. PIN é marcado como revogado
3. `revoked_at` recebe timestamp
4. Mock lock provider recebe comando de revogação

**Saída:**
```
✓ PIN revogado (2025-10-28T11:00:00Z)
```

---

### ✅ Etapa 7: Verificar Logs e Tabelas

**Validações:**

#### Tabela `credentials`
- Estados de ciclo de vida:
  - `active` → criada e válida
  - `revoked` → revogada no checkout
- Timestamps corretos:
  - `created_at` = T-2h (antes do check-in)
  - `revoked_at` = T-checkout

#### Tabela `webhook_events`
- Eventos registrados:
  - `event_type` = 'reservation.created'
  - `status` = 'processed'
  - `external_id` armazena ID da Stays
  - Estrutura limpa (sem dados sensíveis)

#### Tabela `logs` (Observability)
- Logs estruturados em JSON
- Campos obrigatórios:
  - `timestamp` (ISO 8601)
  - `level` ('info', 'warn', 'error')
  - `message`
  - `request_id` (UUID para tracing)
  - `user_id`
- Sem dados sensíveis (PINs não aparecem)

**Estrutura de log exemplo:**
```json
{
  "timestamp": "2025-10-25T12:00:00.123Z",
  "level": "info",
  "message": "PIN generated for reservation",
  "request_id": "abc-123-def-456",
  "reservation_id": "res-123",
  "user_id": "user-789",
  "duration": 234,
  "metadata": { "lockId": "lock-1" }
}
```

**Saída:**
```
✓ Logs estruturados corretos
  - Credenciais: status transition active→revoked ✓
  - Webhooks: 1 evento processado ✓
  - Logs: sem dados sensíveis ✓
```

---

## 📊 Relatório Final

Ao final da simulação, um relatório colorido é exibido:

```
═══════════════════════════════════════════════════════════
RESUMO DA SIMULAÇÃO E2E
═══════════════════════════════════════════════════════════

✓ Etapa 1: 5 acomodações criadas (234ms)
✓ Etapa 2: 5 mapeamentos criados (156ms)
✓ Etapa 3: Reserva criada: res-123 (345ms)
✓ Etapa 4: PIN gerado: cred-456 (89ms)
✓ Etapa 5: PIN mascarado: ****45 (45ms)
✓ Etapa 6: PIN revogado com sucesso (67ms)
✓ Etapa 7: Logs e tabelas validados (123ms)

═══════════════════════════════════════════════════════════
✓ Simulação completa executada com sucesso!
═══════════════════════════════════════════════════════════
```

---

## 🔧 Troubleshooting

### ❌ Erro: "Falha ao registrar usuário"

**Causa:** Banco de dados não configurado ou usuário já existe

**Solução:**
```bash
# Reiniciar banco de dados
npm run db:setup

# Ou use novo usuário com timestamp
# (teste gera automaticamente)
```

---

### ❌ Erro: "Conexão com Redis recusada"

**Causa:** Redis não está rodando

**Solução:**
```bash
# Linux/Mac
redis-server

# Docker
docker run -d -p 6379:6379 redis:alpine

# Windows
# Baixe Redis em https://github.com/microsoftarchive/redis/releases
redis-server
```

---

### ❌ Erro: "Nenhuma acomodação foi criada"

**Causa:** Stays mock server não respondeu ou endpoint quebrado

**Solução:**
```bash
# Verificar se mock server está rodando
npm run mock:stays

# Ou verificar endpoint manualmente
curl -X POST http://localhost:3000/api/admin/stays/sync-accommodations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

---

### ❌ Erro: "Webhook falhou"

**Causa:** Endpoint `/api/webhooks/stays/reservation` retorna erro

**Solução:**
```bash
# Verificar se middleware de autenticação está permitindo webhooks
# Webhooks geralmente não precisam de auth

# Verificar logs da API
npm run dev 2>&1 | grep -i webhook
```

---

### ❌ Erro: "PIN não foi revogado"

**Causa:** Job de revogação não foi executado

**Solução:**
```bash
# Verificar se BullMQ processor está rodando
# Em testes, use sleep/delay manual

# Ou execute job manualmente:
const { revokePinQueue } = require('./src/lib/queue');
await revokePinQueue.process(async (job) => {
  // ... revoke logic
});
```

---

### ⚠️ Aviso: "Nenhum log estruturado encontrado"

**Causa:** Observability não está registrando eventos

**Solução:**
```bash
# Verificar se structured-logger está inicializado
# Adicionar logs manuais em endpoints

import { structuredLogger } from './src/lib/structured-logger';

structuredLogger.info('Pin gerado', {
  requestId,
  reservationId,
  credentialId,
});
```

---

## 🧪 Exemplo de Uso Local

```bash
# Terminal 1: API rodando
npm run dev

# Terminal 2: Stays mock server
npm run mock:stays

# Terminal 3: Executar teste E2E
npm run test:e2e

# Saída esperada:
# ✓ ETAPA 1: Sincronizar acomodações
# ✓ ETAPA 2: Mapear fechaduras
# ✓ ETAPA 3: Receber webhook de reserva
# ✓ ETAPA 4: Avançar relógio e gerar PIN
# ✓ ETAPA 5: Validar PIN
# ✓ ETAPA 6: Avançar para checkout e revogar PIN
# ✓ ETAPA 7: Verificar logs e tabelas
# ✓ Simulação completa executada com sucesso!
```

---

## 📈 Métricas Coletadas

O teste coleta as seguintes métricas:

| Métrica | Descrição | Valor Esperado |
|---------|-----------|---|
| **Acomodações Criadas** | Total sincronizado | ≥ 5 |
| **Mapeamentos** | Accommodation → Lock | = 5 |
| **Reservas Processadas** | Webhooks recebidos | ≥ 1 |
| **PINs Gerados** | Credenciais ativas | ≥ 1 |
| **PINs Revogados** | Credenciais revogadas | ≥ 1 |
| **Tempo Total** | Duração completa | < 10s |
| **Taxa Sucesso** | % etapas bem-sucedidas | = 100% |

---

## 🔐 Segurança no Teste

O teste valida:

- ✅ **PINs nunca são expostos** em logs
- ✅ **Dados sensíveis não aparecem** em webhooks
- ✅ **Mascaramento de PINs** funciona (`****XX`)
- ✅ **Auditoria completa** em logs estruturados
- ✅ **Sem dados sensíveis** em tabelas públicas

---

## 📝 Próximos Passos

Para estender o teste E2E:

1. **Adicionar múltiplas reservas** simultâneas
2. **Testar cancelamento de reserva** (revogar PIN antes do check-in)
3. **Testar notificações** (email, WhatsApp)
4. **Testar integração com Tuya real** (não apenas mock)
5. **Load testing** (100+ reservas simultâneas)
6. **Chaos testing** (falhas de rede, timeouts)

---

## 📞 Contato / Suporte

Se encontrar problemas:

1. Verifique logs: `npm run dev 2>&1 | head -50`
2. Verifique banco: `psql -U tuya_admin -d tuya_locks_db -c "SELECT COUNT(*) FROM accommodations;"`
3. Verifique Redis: `redis-cli ping`
4. Verifique .env: `env | grep TUYA`

---

## ✅ Checklist Pré-Teste

Antes de rodar `npm run test:e2e`, verifique:

- [ ] PostgreSQL rodando: `psql -U tuya_admin -d tuya_locks_db -c "SELECT 1"`
- [ ] Redis rodando: `redis-cli ping` → `PONG`
- [ ] API rodando: `curl http://localhost:3000/api/health`
- [ ] Variáveis .env configuradas: `cat .env | head -10`
- [ ] Mock server pronto: `npm run mock:stays`
- [ ] Banco limpo (opcional): `npm run db:setup`

Pronto! Execute com confiança:

```bash
npm run test:e2e
```

---

**Versão:** 1.0.0  
**Data:** Outubro 2025  
**Status:** ✅ Production Ready
