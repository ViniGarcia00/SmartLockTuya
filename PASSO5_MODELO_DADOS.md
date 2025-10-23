# PASSO 5 — Modelo de Dados com Prisma

## 📋 Visão Geral

Implementação do esquema de banco de dados PostgreSQL usando Prisma ORM com 7 tabelas principais para gerenciar acomodações, fechaduras, reservas e credenciais.

---

## 📊 Tabelas Criadas

### 1. **Accommodation** — Acomodação

```prisma
model Accommodation {
  id                    String @id @default(cuid())
  staysAccommodationId  String @unique           // ACC-STY-001 (da API Stays)
  name                  String
  status                AccommodationStatus
  
  locks                 AccommodationLock[]      // Relacionamento 1:N
  reservations          Reservation[]            // Relacionamento 1:N
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

enum AccommodationStatus {
  ACTIVE
  INACTIVE
}
```

**Propósito:** Armazenar informações de acomodações  
**Índices:** staysAccommodationId (unique)

---

### 2. **Lock** — Fechadura Inteligente

```prisma
model Lock {
  id                    String @id @default(cuid())
  vendor                LockVendor               // TUYA, OTHER
  deviceId              String @unique           // ID do dispositivo
  alias                 String?                  // Nome amigável
  
  accommodations        AccommodationLock[]      // Relacionamento 1:N
  credentials           Credential[]             // Relacionamento 1:N
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

enum LockVendor {
  TUYA
  OTHER
}
```

**Propósito:** Registrar dispositivos de fechadura disponíveis  
**Índices:** deviceId (unique), vendor  
**Suporte:** Tuya e outros vendors

---

### 3. **AccommodationLock** — Mapeamento 1:1

```prisma
model AccommodationLock {
  id                    String @id @default(cuid())
  
  accommodationId       String
  lockId                String
  
  accommodation         Accommodation @relation(...)
  lock                  Lock @relation(...)
  
  createdBy             String?                  // Usuário que criou
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@unique([accommodationId, lockId])            // Única fechadura por acomodação
}
```

**Propósito:** Vincular acomodação a sua fechadura  
**Constraints:** Unique(accommodationId, lockId)  
**Observação:** Uma acomodação tem uma única fechadura

---

### 4. **Reservation** — Reserva de Hóspede

```prisma
model Reservation {
  id                    String @id @default(cuid())
  staysReservationId    String @unique           // RES-STY-202510-001
  
  accommodationId       String
  accommodation         Accommodation @relation(...)
  
  checkInAt             DateTime                 // Data/hora check-in
  checkOutAt            DateTime                 // Data/hora check-out
  
  status                ReservationStatus
  
  credentials           Credential[]             // 1:N
  webhookEvents         WebhookEvent[]           // 1:N
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

enum ReservationStatus {
  CONFIRMED
  PENDING
  CANCELLED
  COMPLETED
  NO_SHOW
}
```

**Propósito:** Armazenar reservas de hóspedes  
**Índices:** staysReservationId, accommodationId, status, checkInAt, checkOutAt  
**Sincronização:** Vindo de webhooks Stays

---

### 5. **Credential** — PIN/Senha Temporária

```prisma
model Credential {
  id                    String @id @default(cuid())
  
  reservationId         String                   // FK para Reservation
  lockId                String                   // FK para Lock
  
  reservation           Reservation @relation(...)
  lock                  Lock @relation(...)
  
  pin                   String                   // Hash bcrypt
  plainPin              String?                  // Temporário para envio
  
  status                CredentialStatus
  validFrom             DateTime                 // Válido a partir de
  validTo               DateTime                 // Válido até
  
  createdBy             String?                  // Usuário
  revokedBy             String?                  // Quem revogou
  revokedAt             DateTime?
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@unique([reservationId, lockId])              // Um PIN por reserva/fechadura
}

enum CredentialStatus {
  ACTIVE
  REVOKED
  EXPIRED
}
```

**Propósito:** Armazenar PINs temporários de acesso  
**Segurança:**
- PIN armazenado com hash bcrypt
- plainPin apenas temporário (enviar ao hóspede)
- Status rastreado (ativo, revogado, expirado)
- Validez limitada a checkIn-checkOut

---

### 6. **WebhookEvent** — Auditoria de Eventos

```prisma
model WebhookEvent {
  id                    String @id @default(cuid())
  eventId               String @unique           // UUID do evento
  eventType             String                   // "reservation.created"
  
  reservationId         String?                  // FK opcional
  reservation           Reservation? @relation(...)
  
  rawBody               Json                     // Payload completo
  
  processed             Boolean @default(false)
  processedAt           DateTime?
  processError          String?                  // Mensagem de erro
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

**Propósito:** Auditar todos os webhooks recebidos  
**Rastreamento:**
- Cada evento tem um eventId único
- Armazena payload bruto em JSON
- Marca se foi processado com sucesso
- Registra erros de processamento

---

### 7. **AuditLog** — Log de Ações (Opcional)

```prisma
model AuditLog {
  id                    String @id @default(cuid())
  
  action                String                   // CREATE_CREDENTIAL
  entity                String                   // Credential
  entityId              String                   // ID da entidade
  
  userId                String?                  // Usuário responsável
  details               Json?                    // Dados adicionais
  
  createdAt             DateTime @default(now())
}
```

**Propósito:** Rastrear todas as ações para compliance  
**Uso:** Quem criou/revogou credenciais, quando, etc.

---

## 🔗 Relacionamentos

```
Accommodation (1) ──→ (N) AccommodationLock
                ├──→ (N) Reservation
                
Lock (1) ──→ (N) AccommodationLock
         ├──→ (N) Credential
         
Reservation (1) ──→ (N) Credential
            ├──→ (N) WebhookEvent
            
Credential (N) ←── (1) Lock
            ←── (1) Reservation
```

---

## 📝 Tipos de Status

### AccommodationStatus
- `ACTIVE` — Acomodação disponível
- `INACTIVE` — Acomodação não disponível (reforma, etc)

### ReservationStatus
- `CONFIRMED` — Reserva confirmada
- `PENDING` — Awaiting confirmation
- `CANCELLED` — Cancelada pelo hóspede
- `COMPLETED` — Check-out realizado
- `NO_SHOW` — Hóspede não compareceu

### CredentialStatus
- `ACTIVE` — PIN funcional
- `REVOKED` — Revogado manualmente
- `EXPIRED` — Passou validTo

### LockVendor
- `TUYA` — Dispositivo Tuya
- `OTHER` — Outros vendors futuros

---

## 🚀 Como Usar

### 1. Gerar Migrations

```bash
# Criar arquivo de migração (cria ou atualiza schema)
npx prisma migrate dev --name init

# Ou se DATABASE_URL não estiver configurado:
npx prisma migrate dev --name init
```

### 2. Gerar Prisma Client

```bash
# Criar tipos TypeScript automaticamente
npx prisma generate
```

### 3. Visualizar Dados (Optional)

```bash
# Abrir Prisma Studio (interface gráfica)
npx prisma studio
```

---

## 📊 Exemplo de Dados

### Criar Acomodação

```typescript
const accommodation = await prisma.accommodation.create({
  data: {
    staysAccommodationId: "ACC-STY-001",
    name: "Apartamento Centro Luxo",
    status: "ACTIVE"
  }
});
```

### Criar Fechadura

```typescript
const lock = await prisma.lock.create({
  data: {
    vendor: "TUYA",
    deviceId: "bf3db4a6b2d8c0f1e2a3b4c5",
    alias: "Fechadura Principal"
  }
});
```

### Vincular Acomodação-Fechadura

```typescript
const link = await prisma.accommodationLock.create({
  data: {
    accommodationId: accommodation.id,
    lockId: lock.id,
    createdBy: "admin@example.com"
  }
});
```

### Criar Reserva

```typescript
const reservation = await prisma.reservation.create({
  data: {
    staysReservationId: "RES-STY-202510-001",
    accommodationId: accommodation.id,
    checkInAt: new Date("2025-10-24"),
    checkOutAt: new Date("2025-10-26"),
    status: "CONFIRMED"
  }
});
```

### Criar Credencial (PIN)

```typescript
import bcrypt from 'bcrypt';

const pin = "1234567";
const hashedPin = await bcrypt.hash(pin, 10);

const credential = await prisma.credential.create({
  data: {
    reservationId: reservation.id,
    lockId: lock.id,
    pin: hashedPin,
    plainPin: pin,  // Apenas para enviar ao hóspede
    status: "ACTIVE",
    validFrom: new Date("2025-10-24T15:00:00"),  // Check-in + 1h
    validTo: new Date("2025-10-26T10:00:00"),    // Check-out
    createdBy: "system"
  }
});

// Depois de enviar ao hóspede, limpar plainPin
await prisma.credential.update({
  where: { id: credential.id },
  data: { plainPin: null }
});
```

### Registrar Webhook

```typescript
const webhook = await prisma.webhookEvent.create({
  data: {
    eventId: "550e8400-e29b-41d4-a716-446655440000",
    eventType: "reservation.created",
    reservationId: reservation.id,
    rawBody: payload,
    processed: false
  }
});

// Depois de processar
await prisma.webhookEvent.update({
  where: { id: webhook.id },
  data: {
    processed: true,
    processedAt: new Date()
  }
});
```

---

## 🔐 Segurança

✅ **Boas práticas implementadas:**

- PIN armazenado com **hash bcrypt** (nunca plaintext)
- plainPin apenas temporário (para envio ao hóspede)
- Credenciais com **validez limitada** (validFrom, validTo)
- Status rastreado para **revogação manual**
- AuditLog para **rastreamento completo**
- Índices para **queries otimizadas**
- Foreign keys com **cascade delete**

---

## 📋 Índices para Performance

```sql
-- Accommodation
CREATE INDEX idx_accommodation_staysid ON "Accommodation"("staysAccommodationId");

-- Lock
CREATE INDEX idx_lock_deviceid ON "Lock"("deviceId");
CREATE INDEX idx_lock_vendor ON "Lock"("vendor");

-- Reservation
CREATE INDEX idx_reservation_staysid ON "Reservation"("staysReservationId");
CREATE INDEX idx_reservation_accommodationid ON "Reservation"("accommodationId");
CREATE INDEX idx_reservation_status ON "Reservation"("status");
CREATE INDEX idx_reservation_checkin ON "Reservation"("checkInAt");
CREATE INDEX idx_reservation_checkout ON "Reservation"("checkOutAt");

-- Credential
CREATE INDEX idx_credential_reservationid ON "Credential"("reservationId");
CREATE INDEX idx_credential_lockid ON "Credential"("lockId");
CREATE INDEX idx_credential_status ON "Credential"("status");
CREATE INDEX idx_credential_validfrom ON "Credential"("validFrom");
CREATE INDEX idx_credential_validto ON "Credential"("validTo");

-- WebhookEvent
CREATE INDEX idx_webhook_eventid ON "WebhookEvent"("eventId");
CREATE INDEX idx_webhook_eventtype ON "WebhookEvent"("eventType");
CREATE INDEX idx_webhook_reservationid ON "WebhookEvent"("reservationId");
CREATE INDEX idx_webhook_processed ON "WebhookEvent"("processed");
CREATE INDEX idx_webhook_createdat ON "WebhookEvent"("createdAt");

-- AuditLog
CREATE INDEX idx_auditlog_action ON "AuditLog"("action");
CREATE INDEX idx_auditlog_entity ON "AuditLog"("entity");
CREATE INDEX idx_auditlog_entityid ON "AuditLog"("entityId");
CREATE INDEX idx_auditlog_userid ON "AuditLog"("userId");
CREATE INDEX idx_auditlog_createdat ON "AuditLog"("createdAt");
```

---

## ⚙️ Variáveis de Ambiente

```bash
# PostgreSQL (Prisma)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname?schema=public

# Log de queries SQL (desenvolvimento)
# DATABASE_URL=postgresql://...?schema=public&log=query
```

---

## ✅ Checklist

- ✅ Schema.prisma criado com 7 tabelas
- ✅ Enums definidos (AccommodationStatus, ReservationStatus, CredentialStatus, LockVendor)
- ✅ Relacionamentos configurados
- ✅ Índices adicionados
- ✅ Foreign keys com cascade delete
- ✅ Unique constraints implementados
- ✅ Timestamps (createdAt, updatedAt) em todas as tabelas
- ✅ JSON field para rawBody (webhooks)
- ✅ .env.example atualizado

---

## 🔄 Próximos Passos

### PASSO 6 — Job Scheduler
- Criar filas BullMQ para gerar/revogar PINs
- Agendar jobs com base em checkIn/checkOut

### PASSO 7 — Database Routes
- Criar endpoints Express para CRUD
- Integrar webhooks com persistência

---

**Status:** 📝 Schema.prisma criado  
**Próximo:** `npx prisma migrate dev --name init`  
**Data:** 23/10/2025
