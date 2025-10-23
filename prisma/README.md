# 📊 Prisma Database Schema

## Estrutura

Este diretório contém a configuração Prisma para o SmartLock Tuya com integração Stays.

```
prisma/
├── schema.prisma          # Schema das 7 tabelas
├── seed.ts                # Script para popular dados de teste
├── .env.example           # Variáveis de ambiente
├── migrations/
│   └── 20251023231733_init/
│       └── migration.sql  # SQL gerado automaticamente
└── README.md              # Este arquivo
```

---

## 🚀 Início Rápido

### 1. Configurar Banco de Dados

Editar `.env` na raiz do projeto:

```bash
DATABASE_URL=postgresql://tuya_admin:Epm240t100c@n@localhost:5432/tuya_locks_db?schema=public
```

### 2. Gerar/Aplicar Schema

```bash
# Primeira vez (cria tabelas)
npx prisma migrate dev --name init

# Ou para resetar completamente (⚠️ deleta dados!)
npx prisma migrate reset
```

### 3. Gerar Cliente TypeScript

```bash
npx prisma generate
```

### 4. Popular Dados de Teste (Opcional)

```bash
npm run db:seed
```

### 5. Visualizar Dados (Opcional)

```bash
npm run db:studio
```

---

## 📋 Tabelas

| Tabela | Propósito | Registros |
|--------|----------|-----------|
| **Accommodation** | Acomodações/Rentals | N/A |
| **Lock** | Dispositivos Tuya | N/A |
| **AccommodationLock** | Vínculo 1:1 Acomodação-Fechadura | N/A |
| **Reservation** | Reservas de hóspedes | N/A |
| **Credential** | PINs temporários | N/A |
| **WebhookEvent** | Auditoria de webhooks | N/A |
| **AuditLog** | Log de ações | N/A |

---

## 🔗 Relacionamentos

```
Accommodation (1) ──→ (N) AccommodationLock ←── (1) Lock
             ↓
          Reservation (1) ──→ (N) Credential ←── (1) Lock
             ↓
        WebhookEvent
```

---

## 💻 Usando no Código

### Importar Cliente

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
```

### Criar Acomodação

```typescript
const accommodation = await prisma.accommodation.create({
  data: {
    staysAccommodationId: "ACC-STY-001",
    name: "Apartamento Centro",
    status: "ACTIVE",
  },
});
```

### Buscar Reservas com Credenciais

```typescript
const reservations = await prisma.reservation.findMany({
  where: {
    status: "CONFIRMED",
  },
  include: {
    credentials: true,
    accommodation: true,
  },
});
```

### Registrar Webhook

```typescript
const webhookEvent = await prisma.webhookEvent.create({
  data: {
    eventId: "550e8400-...",
    eventType: "reservation.created",
    reservationId: reservation.id,
    rawBody: payload,
    processed: false,
  },
});
```

---

## 🔐 Segurança

✅ **Implementado:**
- PIN armazenado com bcrypt (nunca plaintext)
- Credenciais com validez limitada (validFrom, validTo)
- Status rastreado para revogação
- Auditoria completa com AuditLog
- Foreign keys com cascade delete

---

## 📈 Performance

✅ **Otimizado com 17+ Índices:**
- `staysAccommodationId` (unique)
- `staysReservationId` (unique)
- `deviceId` (unique, vendor)
- `status` (Reservation, Credential)
- `checkInAt`, `checkOutAt`
- `processed` (WebhookEvent)
- `createdAt` (para sorting)

---

## 🛠️ Desenvolvimento

### Adicionar Nova Tabela

1. Editar `prisma/schema.prisma`
2. Executar: `npx prisma migrate dev --name add_something`
3. Arquivo SQL será criado em `prisma/migrations/`

### Resetar Banco

```bash
npm run db:migrate reset
# ⚠️ Deleta TODOS os dados!
```

### Ver SQL Gerado

```bash
# Arquivo: prisma/migrations/[timestamp]_init/migration.sql
cat prisma/migrations/20251023231733_init/migration.sql
```

---

## 📝 Logs

### Habilitar Query Logging (desenvolvimento)

```bash
# .env
DATABASE_URL=postgresql://...?schema=public&log=query
```

### Visualizar no Studio

```bash
npm run db:studio
# Abre interface gráfica em http://localhost:5555
```

---

## ⚡ Scripts Disponíveis

```bash
npm run db:seed        # Popular dados de teste
npm run db:studio      # Abrir Prisma Studio
npm run db:migrate     # Executar migrações pendentes
```

---

## 🐛 Troubleshooting

### Erro: "Database reset successful" sem criar tabelas

→ Executar manualmente: `npx prisma migrate deploy`

### Erro: "P1012: Environment variable not found: DATABASE_URL"

→ Verificar `.env` tem `DATABASE_URL` configurada

### PINs não sendo salvos

→ Garantir hash bcrypt antes de salvar em `pin` field

### Webhook eventos duplicados

→ Verificar `eventId` é único antes de criar

---

## 📚 Documentação

- [Prisma Docs](https://www.prisma.io/docs/)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [SQL Migrations](https://www.prisma.io/docs/guides/migrate/develop-and-push)

---

**Status:** ✅ Schema criado e aplicado  
**Dados:** 7 tabelas, 17+ índices, 6 relações  
**Seed:** 3 acomodações, 3 fechaduras, 2 reservas, 2 PINs  
**Data:** 23/10/2025
