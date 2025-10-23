# PASSO 4 — Webhook de Reservas

## 📋 Visão Geral

Implementação de webhook para receber eventos de reservas da API Stays com validação de assinatura HMAC-SHA256 e armazenamento em memória.

---

## 📁 Arquivos Criados

### 1. `src/lib/webhook.types.ts`
**Tipos e interfaces para webhooks**

```typescript
// Tipos de eventos
export type WebhookEventType = 
  | 'reservation.created'
  | 'reservation.updated'
  | 'reservation.cancelled';

// Interface de payload
export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: WebhookReservation;
  metadata?: Record<string, any>;
}

// Evento armazenado
export interface WebhookEvent {
  id: string;           // UUID
  eventType: WebhookEventType;
  payload: WebhookPayload;
  receivedAt: Date;
  signature?: string;
  isValid: boolean;
  ipAddress?: string;
  userAgent?: string;
}
```

**Campos da Reserva no Webhook:**
- `id` — Identificador único
- `accommodationId` — ID da acomodação
- `guestName`, `guestEmail`, `guestPhone` — Dados do hóspede
- `checkInDate`, `checkOutDate` — Datas em ISO 8601
- `status` — confirmed, pending, cancelled, completed, no-show
- `numberOfGuests` — Número de hóspedes
- `totalPrice`, `currency` — Preço total
- `lockCode` — Código de acesso (opcional)
- `notes` — Notas (opcional)
- `createdAt`, `updatedAt` — Timestamps ISO

---

### 2. `src/lib/webhook-validator.ts`
**Validador de assinatura HMAC**

**Funções principais:**

#### `validateWebhookSignature(body, signature, secret, mockMode)`
```javascript
// Modo MOCK: sempre retorna true
result = validateWebhookSignature(body, sig, secret, true);
// { isValid: true, reason: "Mock mode enabled" }

// Modo PROD: valida HMAC-SHA256
result = validateWebhookSignature(body, sig, secret, false);
// { isValid: true, reason: "Signature valid" }
// ou
// { isValid: false, reason: "Signature mismatch" }
```

#### `generateWebhookSignature(body, secret)`
Gera assinatura HMAC-SHA256 para um body:
```javascript
const sig = generateWebhookSignature(JSON.stringify(payload), secret);
```

#### `validateWebhookPayload(payload)`
Valida estrutura do payload:
```javascript
const result = validateWebhookPayload(payload);
// Verifica: event, data, timestamp
// Verifica campos obrigatórios da reserva
```

#### `createWebhookConfig(env)`
Cria configuração a partir de env vars:
```javascript
const config = createWebhookConfig({
  STAYS_WEBHOOK_SECRET: 'secret-key',
  STAYS_ENABLE_MOCK: 'true',
  NODE_ENV: 'development'
});
// { enabled: true, secret: '...', mockMode: true }
```

---

### 3. `src/lib/webhook-event-store.ts`
**Gerenciador de eventos em memória**

```javascript
// Adicionar evento
const event = webhookEventStore.addEvent(
  payload,
  signature,
  isValid,
  ipAddress,
  userAgent
);

// Obter evento
const event = webhookEventStore.getEvent(eventId);

// Listar todos os eventos
const events = webhookEventStore.getAllEvents();

// Filtrar por tipo
const created = webhookEventStore.getEventsByType('reservation.created');

// Obter eventos válidos
const valid = webhookEventStore.getValidEvents();

// Obter eventos recentes (últimas X horas)
const recent = webhookEventStore.getRecentEvents(1); // 1 hora

// Obter estatísticas
const stats = webhookEventStore.getStats();
// {
//   totalReceived: 150,
//   totalValid: 148,
//   totalInvalid: 2,
//   byEventType: {
//     'reservation.created': 50,
//     'reservation.updated': 75,
//     'reservation.cancelled': 25
//   },
//   lastEventAt: Date
// }

// Limpeza
webhookEventStore.clear();
```

---

### 4. `src/app/api/webhooks/stays/reservation/route.js`
**Endpoint Express para receber webhooks**

#### POST `/api/webhooks/stays/reservation`

**Receber webhook**

Request:
```json
{
  "event": "reservation.created",
  "timestamp": "2025-10-23T12:00:00Z",
  "data": {
    "id": "RES-STY-202510-001",
    "accommodationId": "ACC-STY-001",
    "guestName": "João Silva",
    "guestEmail": "joao@example.com",
    "checkInDate": "2025-10-24",
    "checkOutDate": "2025-10-26",
    "status": "confirmed",
    "numberOfGuests": 2,
    "totalPrice": 450.00,
    "currency": "BRL"
  }
}
```

Headers:
```
X-Webhook-Signature: [assinatura HMAC-SHA256]
Content-Type: application/json
```

Response:
```json
{
  "success": true,
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-10-23T12:00:00Z",
  "message": "Webhook received and stored: reservation.created"
}
```

Fluxo:
1. ✅ Receber e extrair assinatura
2. ✅ Validar assinatura (HMAC-SHA256)
   - Em MOCK mode: aceita sem validar
   - Em PROD mode: verifica assinatura
3. ✅ Validar estrutura do payload
4. ✅ Armazenar evento em memória
5. ✅ Fazer console.log detalhado
6. ✅ Retornar 202 (Accepted)

---

#### GET `/api/webhooks/stays/reservation/events`

**Listar eventos armazenados**

Query params:
- `type` — Filtrar por tipo (reservation.created, updated, cancelled)
- `limit` — Número de eventos (máximo 100, padrão 50)
- `offset` — Offset para paginação (padrão 0)

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "eventType": "reservation.created",
      "payload": { ... },
      "receivedAt": "2025-10-23T12:00:00Z",
      "isValid": true,
      "ipAddress": "192.168.1.1"
    }
  ],
  "pagination": {
    "total": 150,
    "offset": 0,
    "limit": 50,
    "pages": 3
  },
  "stats": { ... },
  "timestamp": "2025-10-23T12:00:00Z"
}
```

---

#### GET `/api/webhooks/stays/reservation/stats`

**Obter estatísticas de webhooks**

Response:
```json
{
  "success": true,
  "data": {
    "totalReceived": 150,
    "totalValid": 148,
    "totalInvalid": 2,
    "byEventType": {
      "reservation.created": 50,
      "reservation.updated": 75,
      "reservation.cancelled": 25
    },
    "lastEventAt": "2025-10-23T12:00:00Z"
  },
  "timestamp": "2025-10-23T12:00:00Z"
}
```

---

#### GET `/api/webhooks/stays/reservation/events/:eventId`

**Obter evento específico**

Response:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "eventType": "reservation.created",
    "payload": { ... },
    "receivedAt": "2025-10-23T12:00:00Z",
    "signature": "abcd1234...",
    "isValid": true,
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  },
  "timestamp": "2025-10-23T12:00:00Z"
}
```

---

### 5. `src/lib/webhook-validator.test.ts`
**Testes unitários com Jest**

**Suites de teste:**

✅ **Mock Mode**
- Aceita qualquer assinatura em mock mode
- Aceita signature vazia em mock mode

✅ **Production Mode - Valid Signatures**
- Aceita assinatura válida
- Gera assinaturas consistentes

✅ **Production Mode - Invalid Signatures**
- Rejeita assinatura inválida
- Rejeita quando signature está faltando
- Rejeita quando body foi modificado

✅ **Payload Validation**
- Aceita payload válido
- Rejeita sem campo `event`
- Rejeita sem campo `data`
- Rejeita sem campo `timestamp`
- Rejeita tipo de evento inválido
- Rejeita sem campos obrigatórios da reserva
- Aceita todos os tipos de evento válidos

✅ **Webhook Config**
- Habilita mock mode em development
- Habilita mock mode com flag STAYS_ENABLE_MOCK
- Desabilita mock mode em production sem flag
- Usa secret fornecido
- Usa secret padrão se não fornecido

✅ **Edge Cases**
- Trata assinaturas muito longas
- Trata caracteres unicode no body
- Case-sensitive para assinaturas

**Executar testes:**
```bash
npm test                    # Rodar testes uma vez
npm run test:watch        # Watch mode
npm run test:coverage     # Com coverage report
```

---

## 🚀 Como Usar

### 1. Configurar Variáveis de Ambiente

```env
# .env
STAYS_WEBHOOK_SECRET=sua-chave-secreta-para-webhooks
STAYS_ENABLE_MOCK=true    # false em produção
NODE_ENV=development
```

### 2. Integrar Endpoint no Express

```javascript
// em server.js
const webhookRouter = require('./src/app/api/webhooks/stays/reservation/route');

app.use(express.json());
app.post('/api/webhooks/stays/reservation', webhookRouter);
```

### 3. Enviar Webhook (com assinatura válida)

```bash
# Gerar assinatura (node)
const secret = 'sua-chave-secreta';
const crypto = require('crypto');
const body = JSON.stringify({ event: 'reservation.created', ... });
const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');

# Enviar webhook
curl -X POST http://localhost:3000/api/webhooks/stays/reservation \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $sig" \
  -d '{
    "event": "reservation.created",
    "timestamp": "2025-10-23T12:00:00Z",
    "data": {
      "id": "RES-001",
      "accommodationId": "ACC-001",
      ...
    }
  }'
```

### 4. Verificar Eventos

```bash
# Listar todos os eventos
curl http://localhost:3000/api/webhooks/stays/reservation/events

# Filtrar por tipo
curl http://localhost:3000/api/webhooks/stays/reservation/events?type=reservation.created

# Obter estatísticas
curl http://localhost:3000/api/webhooks/stays/reservation/stats

# Obter evento específico
curl http://localhost:3000/api/webhooks/stays/reservation/events/550e8400-e29b-41d4-a716-446655440000
```

---

## 📊 Modo MOCK vs PROD

| Aspecto | MOCK | PROD |
|---------|------|------|
| Validação de Signature | ❌ Desabilita | ✅ Obrigatória |
| Aceita qualquer assinatura | ✅ Sim | ❌ Não |
| Validação de Payload | ✅ Sim | ✅ Sim |
| Armazenamento | ✅ Memória | ✅ Memória (→ DB) |
| Console.log | ✅ Completo | ✅ Completo |
| Resposta | ✅ 202 Accepted | ✅ 202 Accepted |

**Habilitar MOCK:**
```
STAYS_ENABLE_MOCK=true          (any env)
NODE_ENV=development            (auto)
NODE_ENV=test                   (auto)
```

---

## 🧪 Executar Testes

```bash
# Instalar dependências
npm install --save-dev jest ts-jest @types/jest

# Rodar testes
npm test

# Ver cobertura
npm run test:coverage

# Watch mode (re-rodar ao salvar)
npm run test:watch
```

---

## 📝 Formato de Evento Armazenado

```javascript
{
  id: "550e8400-e29b-41d4-a716-446655440000",  // UUID gerado
  eventType: "reservation.created",
  payload: {
    event: "reservation.created",
    timestamp: "2025-10-23T12:00:00Z",
    data: { /* dados da reserva */ },
    metadata: { /* opcional */ }
  },
  receivedAt: Date(2025-10-23T12:00:00Z),
  signature: "abcd1234...",  // Assinatura recebida
  isValid: true,              // Se passou na validação
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0..."
}
```

---

## 🔗 Integração com Outros Passos

**← PASSO 3 (Mock Server)**
- Mock server fornece dados para testes
- Fixture de reservas usada para validação

**→ PASSO 5 (Database Integration)**
- Webhooks armazenados atualmente em memória
- PASSO 5 adicionará persistência em BD
- PASSO 5 implementará processamento de eventos

---

## ✅ Checklist

- ✅ Tipos de webhook criados (webhook.types.ts)
- ✅ Validador de assinatura (webhook-validator.ts)
- ✅ Gerenciador de eventos em memória (webhook-event-store.ts)
- ✅ Endpoint Express (route.js)
- ✅ Testes unitários (webhook-validator.test.ts)
- ✅ Script npm para testes
- ✅ Jest configurado
- ✅ Dependências instaladas (uuid, jest, ts-jest, @types/jest)
- ✅ Documentação completa

---

**Status:** ✅ PASSO 4 — WEBHOOK COMPLETO  
**Data:** 23/10/2025  
**Próximo:** PASSO 5 — Database Integration
