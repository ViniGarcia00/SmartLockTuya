# 🚀 GUIA DE CONTINUAÇÃO — PASSO 3 (Schema BD)

## 📖 Leia Primeiro

Para entender o que foi feito:
1. `SUMARIO_COMPLETO_P2_P2_5.md` - Overview completo (⭐ COMECE AQUI)
2. `PASSO2_STAYS_CLIENT.md` - Cliente Stays detalhado
3. `PASSO2_5_TIPOS_ENV.md` - Tipos e validação detalhados
4. `RESUMO_PASSO2.md` - Quick summary PASSO 2
5. `RESUMO_PASSO2_5.md` - Quick summary PASSO 2.5

## 🏗️ Estrutura Criada

```
src/lib/
├── stays-client.ts         ← Cliente HTTP com retry
├── stays.types.ts          ← Tipos TypeScript
├── env.ts                  ← Validação com Zod
└── stays.examples.ts       ← Exemplos
```

---

## ✅ O que Já Está Pronto

### 1. Cliente Stays (`stays-client.ts`)
```typescript
import { createStaysClient } from './src/lib/stays-client';

const client = createStaysClient();

// Esses métodos JÁ FUNCIONAM:
const reservas = await client.listReservations(50, 0);
const acomodacoes = await client.listAccommodations(20, 0);
const updates = await client.getReservationUpdatedSince('2025-10-23T00:00:00Z');
```

### 2. Tipos TypeScript (`stays.types.ts`)
```typescript
import type { 
  Reservation, 
  Accommodation, 
  StaysError 
} from './src/lib/stays.types';

// Usar com type-safety
const res: Reservation = { ... };
const acc: Accommodation = { ... };
```

### 3. Validação de Ambiente (`env.ts`)
```typescript
import { getEnvironment, getStaysConfig } from './src/lib/env';

// Automaticamente valida .env
const env = getEnvironment();
const staysConfig = getStaysConfig();
console.log(env.NODE_ENV);
console.log(staysConfig.baseURL);
```

---

## 📋 PASSO 3: Schema do Banco de Dados

### Arquivos a Criar

#### 1. `migrations/002_create_stays_tables.sql`
```sql
-- Tabela de acomodações do Stays
CREATE TABLE stays_accommodations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stays_id VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  country VARCHAR(100),
  capacity INTEGER,
  bedrooms INTEGER,
  bathrooms INTEGER,
  tuya_device_id VARCHAR(255),  -- Link para fechadura Tuya
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  external_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_id (user_id),
  INDEX idx_stays_id (stays_id)
);

-- Tabela de reservas do Stays
CREATE TABLE stays_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accommodation_id UUID NOT NULL REFERENCES stays_accommodations(id) ON DELETE CASCADE,
  stays_id VARCHAR(255) NOT NULL UNIQUE,
  guest_name VARCHAR(255) NOT NULL,
  guest_email VARCHAR(255),
  guest_phone VARCHAR(20),
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'confirmed', 'pending', 'cancelled', etc
  lock_code VARCHAR(7),  -- Senha temporária gerada
  number_of_guests INTEGER,
  notes TEXT,
  total_price DECIMAL(10, 2),
  currency VARCHAR(3),
  external_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  synced_at TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_accommodation_id (accommodation_id),
  INDEX idx_status (status),
  INDEX idx_check_in_date (check_in_date)
);

-- Tabela de sincronização (rastreamento)
CREATE TABLE stays_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sync_type VARCHAR(50), -- 'reservations', 'accommodations'
  last_sync_timestamp TIMESTAMP,
  items_synced INTEGER,
  errors TEXT,
  status VARCHAR(50), -- 'success', 'failed', 'partial'
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);

-- Tabela de eventos de sincronização
CREATE TABLE stays_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(100), -- 'reservation.created', 'reservation.updated'
  reservation_id UUID REFERENCES stays_reservations(id) ON DELETE SET NULL,
  event_data JSONB,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_processed (processed),
  INDEX idx_created_at (created_at)
);
```

#### 2. `src/models/StaysAccommodation.ts`
```typescript
import { query } from '../config/database';
import type { Accommodation } from '../lib/stays.types';

export class StaysAccommodation {
  static async create(userId: string, accommodation: Accommodation) {
    return query(
      `INSERT INTO stays_accommodations 
       (user_id, stays_id, name, city, country, capacity, bedrooms, bathrooms, tuya_device_id, external_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [userId, accommodation.id, accommodation.name, accommodation.city, accommodation.country,
       accommodation.capacity, accommodation.bedrooms, accommodation.bathrooms,
       accommodation.tuyaDeviceId, accommodation.externalId]
    );
  }

  static async findByStaysId(staysId: string) {
    return query(
      'SELECT * FROM stays_accommodations WHERE stays_id = $1',
      [staysId]
    );
  }

  static async listByUser(userId: string) {
    return query(
      'SELECT * FROM stays_accommodations WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
  }

  static async update(id: string, data: Partial<Accommodation>) {
    return query(
      `UPDATE stays_accommodations 
       SET name = $1, city = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [data.name, data.city, id]
    );
  }
}
```

#### 3. `src/models/StaysReservation.ts`
```typescript
import { query } from '../config/database';
import type { Reservation } from '../lib/stays.types';

export class StaysReservation {
  static async create(userId: string, accommodation: any, reservation: Reservation) {
    return query(
      `INSERT INTO stays_reservations
       (user_id, accommodation_id, stays_id, guest_name, guest_email, check_in_date, check_out_date, status, number_of_guests, external_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [userId, accommodation.id, reservation.id, reservation.guestName, reservation.guestEmail,
       reservation.checkInDate, reservation.checkOutDate, reservation.status,
       reservation.numberOfGuests, reservation.externalId]
    );
  }

  static async findByStaysId(staysId: string) {
    return query(
      'SELECT * FROM stays_reservations WHERE stays_id = $1',
      [staysId]
    );
  }

  static async listByUser(userId: string, limit = 100, offset = 0) {
    return query(
      `SELECT * FROM stays_reservations 
       WHERE user_id = $1 
       ORDER BY check_in_date DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
  }

  static async updateLockCode(reservationId: string, lockCode: string) {
    return query(
      `UPDATE stays_reservations 
       SET lock_code = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [lockCode, reservationId]
    );
  }

  static async findExpiring(hoursFromNow = 24) {
    return query(
      `SELECT * FROM stays_reservations 
       WHERE check_out_date <= NOW() + INTERVAL '${hoursFromNow} hours'
       AND status = 'confirmed'
       ORDER BY check_out_date ASC`
    );
  }
}
```

### Próximos Passos do PASSO 3

1. **Criar migrations SQL**
   - Criar arquivo `migrations/002_create_stays_tables.sql`
   - Executar: `psql -U tuya_admin -d tuya_locks_db -f migrations/002_create_stays_tables.sql`

2. **Criar modelos**
   - `src/models/StaysAccommodation.ts`
   - `src/models/StaysReservation.ts`
   - `src/models/StaysSyncLog.ts` (para rastreamento)

3. **Documentar schema**
   - Criar `PASSO3_SCHEMA_BD.md`
   - Descrever tabelas, relacionamentos, índices

4. **Testes**
   - Testar queries básicas
   - Verificar integridade referencial

---

## 🔗 Integrações Necessárias

### Com Cliente Stays
```typescript
// Sincronizar accommodações
const client = createStaysClient();
const response = await client.listAccommodations();

if (response.success) {
  for (const accommodation of response.data) {
    await StaysAccommodation.create(userId, accommodation);
  }
}
```

### Com Tipos
```typescript
import type { Reservation, Accommodation } from './lib/stays.types';

// Type-safe ao salvar
const reservation: Reservation = { ... };
await StaysReservation.create(userId, accommodation, reservation);
```

### Com Validação de Env
```typescript
import { getEnvironment } from './lib/env';

// Usar configuração validada
const env = getEnvironment();
const dbUrl = getDatabaseUrl();
```

---

## 📚 Referências Úteis

### Documentação Existente
- `copilot-instructions.md` - Padrões gerais do projeto
- `database_schema.sql` - Schema existente (para referência)
- `PASSO2_STAYS_CLIENT.md` - Como usar cliente
- `PASSO2_5_TIPOS_ENV.md` - Como usar tipos

### Git Status
```bash
# Ver branch atual
git branch

# Ver commits recentes
git log --oneline -10

# Fazer novo commit
git add -A
git commit -m "PASSO 3: Criar schema do banco de dados para Stays"
```

---

## ⚠️ Checklist Antes de Começar PASSO 3

- [ ] Leu `SUMARIO_COMPLETO_P2_P2_5.md`
- [ ] Entendeu estrutura de `src/lib/`
- [ ] Testou exemplos em `stays.examples.ts`
- [ ] Verificou `.env.example` com todas as variáveis
- [ ] Confirmou PostgreSQL rodando
- [ ] Confirmou `package.json` com zod instalado
- [ ] Verificou histórico Git (5 commits recentes)

---

## 🎯 Objetivo do PASSO 3

Criar schema SQL robusto que:
- ✅ Armazena acomodações do Stays
- ✅ Armazena reservas do Stays
- ✅ Rastreia sincronizações
- ✅ Registra eventos de mudança
- ✅ Conecta com fechaduras Tuya existentes
- ✅ Suporta múltiplos usuários
- ✅ Mantém histórico de sincronização

---

## 🚀 Executar

```bash
# 1. Criar arquivo de migration
touch migrations/002_create_stays_tables.sql
# ... (preencher com SQL acima)

# 2. Aplicar migration
psql -U tuya_admin -d tuya_locks_db -f migrations/002_create_stays_tables.sql

# 3. Criar modelos (TypeScript)
mkdir -p src/models
# ... criar arquivos .ts

# 4. Fazer commit
git add -A
git commit -m "PASSO 3: Criar schema BD e modelos para Stays"

# 5. Documentar
# ... criar PASSO3_SCHEMA_BD.md
```

---

**Pronto para PASSO 3?** 🚀  
**Tempo estimado:** 1.5 horas  
**Próximo:** PASSO 4 (Rotas Express)  
**Dúvidas?** Ver arquivos .md na raiz do projeto
