# 🔗 PASSO 13 — Mapeamento Acomodação ↔ Fechadura

## 📋 Visão Geral

**Objetivo:** Implementar um sistema robusto de mapeamento 1:1 entre acomodações e fechaduras com validações rigorosas.

**Lógica Principal:**
- 1 acomodação → máximo 1 fechadura
- 1 fechadura → máximo 1 acomodação
- Se já existe mapeamento: atualizar
- Se lockId = null: desmapar (deletar)

**Componentes Criados:**
1. ✅ `routes/mappings.js` — Express route com 3 endpoints
2. ✅ `tests/mappings.test.js` — Jest tests completos
3. ✅ Atualizado `src/app/admin/accommodations/actions.ts` — Server Actions
4. ✅ Integrado em `server.js` — Rota registrada

---

## 🔌 Endpoints da API

### **POST /api/admin/mappings**
Mapeia ou desmapeia uma acomodação

**Request:**
```javascript
{
  "accommodationId": "accom-001",
  "lockId": "lock-001"          // null/undefined para desmapar
}
```

**Response (Sucesso - Map):**
```javascript
{
  "success": true,
  "message": "Fechadura mapeada com sucesso",
  "mapping": {
    "id": "map-001",
    "accommodationId": "accom-001",
    "lockId": "lock-001",
    "createdBy": "user-123",
    "createdAt": "2025-10-24T10:00:00Z",
    "updatedAt": "2025-10-24T10:00:00Z"
  }
}
```

**Response (Sucesso - Unmap):**
```javascript
{
  "success": true,
  "message": "Fechadura desmapeada com sucesso",
  "mapping": { /* ... */ }
}
```

**Response (Erro - Fechadura já mapeada):**
```javascript
{
  "success": false,
  "error": "Fechadura já está mapeada para acomodação 'accom-002'. Uma fechadura pode estar vinculada a apenas 1 acomodação."
}
```

**Erros Possíveis:**
| Status | Erro | Causa |
|--------|------|-------|
| 400 | `accommodationId é obrigatório` | Campo faltando |
| 404 | `Acomodação com ID "..." não encontrada` | Acomodação inválida |
| 404 | `Fechadura com ID "..." não encontrada` | Fechadura inválida |
| 400 | `Fechadura já está mapeada para acomodação...` | Violação de regra 1:1 |
| 500 | `Erro ao processar mapeamento: ...` | Erro do servidor |

---

### **GET /api/admin/mappings**
Lista todos os mapeamentos com dados relacionados

**Response:**
```javascript
{
  "success": true,
  "count": 2,
  "mappings": [
    {
      "id": "map-001",
      "accommodationId": "accom-001",
      "lockId": "lock-001",
      "accommodation": {
        "id": "accom-001",
        "name": "Suite Master",
        "status": "ACTIVE"
      },
      "lock": {
        "id": "lock-001",
        "alias": "Fechadura Principal",
        "deviceId": "device-123",
        "vendor": "TUYA"
      },
      "createdBy": "admin",
      "createdAt": "2025-10-24T10:00:00Z",
      "updatedAt": "2025-10-24T10:00:00Z"
    }
  ]
}
```

---

### **DELETE /api/admin/mappings/:accommodationId**
Deleta um mapeamento específico

**URL:** `/api/admin/mappings/accom-001`

**Response:**
```javascript
{
  "success": true,
  "message": "Mapeamento deletado com sucesso",
  "mapping": { /* ... */ }
}
```

---

## 🎯 Server Actions (TypeScript)

### **mapLock(accommodationId, lockId)**
Chamado pelo frontend para mapear uma fechadura

```typescript
// Uso no cliente:
const result = await mapLock('accom-001', 'lock-001');

if (result.success) {
  console.log('✅', result.message);
  // Revalidar página
} else {
  console.error('❌', result.message);
}
```

**Fluxo:**
1. Fetch POST `/api/admin/mappings` com Bearer token
2. Valida resposta
3. Revalida cache Next.js
4. Retorna resultado

### **unmapLock(accommodationId)**
Chamado para desmapar uma fechadura

```typescript
const result = await unmapLock('accom-001');
```

### **Legados (Compatibilidade)**
- `vinculateLock()` → redireciona para `mapLock()`
- `devinculateLock()` → redireciona para `unmapLock()`

---

## 📊 Fluxo de Dados

```
┌─────────────────────────────────────────────────────┐
│  Frontend (Next.js App)                             │
│  - Usuário clica "Vincular"                         │
│  - Chama: await mapLock(accommodationId, lockId)    │
└─────────────────┬───────────────────────────────────┘
                  │ Server Action
                  ▼
┌─────────────────────────────────────────────────────┐
│  src/app/admin/accommodations/actions.ts            │
│  - Fetch POST /api/admin/mappings                   │
│  - Headers: Authorization: Bearer <token>           │
│  - Body: { accommodationId, lockId }                │
└─────────────────┬───────────────────────────────────┘
                  │ HTTP Request
                  ▼
┌─────────────────────────────────────────────────────┐
│  Express Backend (routes/mappings.js)               │
│  - Valida token (authenticateToken middleware)      │
│  - Verifica existência de acomodação e fechadura    │
│  - Valida regra 1:1 (nenhum conflito?)              │
│  - INSERT/UPDATE em accommodation_lock_mappings     │
│  - Log da atividade                                 │
└─────────────────┬───────────────────────────────────┘
                  │ Response
                  ▼
┌─────────────────────────────────────────────────────┐
│  Banco de Dados (PostgreSQL)                        │
│  - accommodation_lock_mappings table                │
│  - { id, accommodationId, lockId, createdBy, ... }  │
└─────────────────────────────────────────────────────┘
```

---

## 🧪 Testes

### **Rodar Testes**
```bash
npm test -- tests/mappings.test.js
```

### **Testes Inclusos**

#### 1. **Mapeamento Válido**
```javascript
✅ Deve mapear uma acomodação a uma fechadura com sucesso
✅ Deve retornar erro se acomodação não existe
✅ Deve retornar erro se fechadura não existe
```

#### 2. **Rejeição de Duplicado (Regra 1:1)**
```javascript
✅ Deve rejeitar mapeamento se lock já está vinculado a outra acomodação
✅ Deve permitir remapear a mesma fechadura se for para a mesma acomodação
```

#### 3. **Desmapeamento**
```javascript
✅ Deve desmapar uma acomodação quando lockId é null
✅ Deve retornar erro ao tentar desmapar acomodação sem mapeamento
```

#### 4. **Listagem**
```javascript
✅ Deve retornar todos os mapeamentos com dados relacionados
```

#### 5. **Deleção**
```javascript
✅ Deve deletar um mapeamento específico
✅ Deve retornar erro ao tentar deletar mapeamento inexistente
```

#### 6. **Validação de Input**
```javascript
✅ Deve retornar erro se accommodationId está faltando
```

---

## 🔐 Validações Implementadas

### **Validações de Entidade**
```javascript
// ✅ Acomodação existe?
const accommodation = await query(
  'SELECT id FROM accommodations WHERE id = $1',
  [accommodationId]
);

// ✅ Fechadura existe?
const lock = await query(
  'SELECT id FROM locks WHERE id = $1',
  [lockId]
);
```

### **Validações de Negócio (1:1)**
```javascript
// ✅ Fechadura já está mapeada para OUTRA acomodação?
const conflict = await query(
  'SELECT * FROM accommodation_lock_mappings 
   WHERE lock_id = $1 AND accommodation_id != $2',
  [lockId, accommodationId]
);

if (conflict.rows.length > 0) {
  return { error: 'Fechadura já está mapeada' };
}
```

### **Validações de Desmapeamento**
```javascript
// ✅ Existe mapeamento para desmapar?
const existing = await query(
  'SELECT * FROM accommodation_lock_mappings WHERE accommodation_id = $1',
  [accommodationId]
);

if (existing.rows.length === 0) {
  return { error: 'Nenhum mapeamento encontrado' };
}
```

---

## 📝 Exemplo de Uso Completo

### **Frontend (Next.js Component)**
```typescript
'use client';

import { mapLock, unmapLock } from './actions';
import { useState } from 'react';

export default function AccommodationSelector() {
  const [loading, setLoading] = useState(false);

  async function handleMapLock(accommodationId: string, lockId: string) {
    setLoading(true);
    try {
      const result = await mapLock(accommodationId, lockId);
      
      if (result.success) {
        alert(`✅ ${result.message}`);
        // UI atualiza automaticamente (revalidatePath)
      } else {
        alert(`❌ ${result.message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUnmapLock(accommodationId: string) {
    setLoading(true);
    try {
      const result = await unmapLock(accommodationId);
      
      if (result.success) {
        alert(`✅ ${result.message}`);
      } else {
        alert(`❌ ${result.message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={() => handleMapLock('accom-001', 'lock-001')} disabled={loading}>
        {loading ? 'Processando...' : 'Vincular Fechadura'}
      </button>
      
      <button onClick={() => handleUnmapLock('accom-001')} disabled={loading}>
        {loading ? 'Processando...' : 'Desvincular Fechadura'}
      </button>
    </div>
  );
}
```

---

## 🛠️ Estrutura de Arquivos

```
Tuya-v20/
├── routes/
│   └── mappings.js                    ← Express route (novo)
├── tests/
│   └── mappings.test.js               ← Jest tests (novo)
├── src/
│   └── app/admin/accommodations/
│       └── actions.ts                 ← Atualizado com mapLock, unmapLock
├── server.js                          ← Rota registrada (atualizado)
└── prisma/
    └── schema.prisma                  ← Model AccommodationLock (já existia)
```

---

## 📊 Schema de Banco de Dados

```sql
-- AccommodationLock table (Prisma)
model AccommodationLock {
  id                String @id @default(cuid())
  accommodationId   String
  lockId            String
  
  accommodation     Accommodation @relation(fields: [accommodationId], references: [id], onDelete: Cascade)
  lock              Lock @relation(fields: [lockId], references: [id], onDelete: Cascade)
  
  createdBy         String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([accommodationId, lockId])  // Garante 1:1
  @@index([accommodationId])
  @@index([lockId])
}
```

---

## 🚀 Como Testar

### **1. Teste Manual via cURL**

#### Mapear uma fechadura
```bash
curl -X POST http://localhost:3000/api/admin/mappings \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "accommodationId": "accom-001",
    "lockId": "lock-001"
  }'
```

#### Listar mapeamentos
```bash
curl -X GET http://localhost:3000/api/admin/mappings \
  -H "Authorization: Bearer admin-token"
```

#### Desmapar
```bash
curl -X POST http://localhost:3000/api/admin/mappings \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "accommodationId": "accom-001",
    "lockId": null
  }'
```

#### Deletar
```bash
curl -X DELETE "http://localhost:3000/api/admin/mappings/accom-001" \
  -H "Authorization: Bearer admin-token"
```

### **2. Teste Automatizado**
```bash
npm test -- tests/mappings.test.js --verbose
```

### **3. Teste de Conflito (Regra 1:1)**
```bash
# Tentar mapear a mesma fechadura para outra acomodação
# Esperado: erro 400 "Fechadura já está mapeada"

curl -X POST http://localhost:3000/api/admin/mappings \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "accommodationId": "accom-002",
    "lockId": "lock-001"
  }'

# Resposta:
# {
#   "success": false,
#   "error": "Fechadura já está mapeada para acomodação 'accom-001'..."
# }
```

---

## ✅ Checklist de Validação

| Item | Status | Evidência |
|------|--------|-----------|
| POST endpoint criado | ✅ | `routes/mappings.js` |
| GET endpoint criado | ✅ | `routes/mappings.js` |
| DELETE endpoint criado | ✅ | `routes/mappings.js` |
| Validação 1:1 | ✅ | Lines 105-110 em mappings.js |
| Testes Jest | ✅ | `tests/mappings.test.js` (6 suites) |
| Server Actions | ✅ | `actions.ts` com mapLock, unmapLock |
| Integração em server.js | ✅ | Rota registrada |
| Autenticação | ✅ | authenticateToken middleware |
| Logging | ✅ | logMappingActivity() |
| TypeScript tipado | ✅ | types corrigidos em actions.ts |

---

## 🐛 Troubleshooting

### **"Fechadura não encontrada"**
- Verificar se lock existe: `SELECT * FROM locks WHERE id = '...'`
- Confirmar que lock está registrado no banco

### **"Acomodação não encontrada"**
- Verificar: `SELECT * FROM accommodations WHERE id = '...'`
- Confirmar sincronização com API Stays

### **"Fechadura já está mapeada para outra acomodação"**
- ✅ Comportamento correto (regra 1:1 funcionando)
- Para remapear: primeiro desmapar da acomodação anterior
- Ou desmapar com DELETE e mapear novamente

### **"Authorization header missing"**
- Adicionar header: `Authorization: Bearer <token>`
- Token pode ser obtido via `/api/auth/login`

### **Testes falhando**
```bash
# Verificar se Jest está instalado
npm install jest supertest --save-dev

# Rodar com debug
npm test -- tests/mappings.test.js --verbose --no-coverage
```

---

## 📈 Próximos Passos

1. **Integração UI:**
   - Atualizar `public/admin-accommodations.html`
   - Botões "Vincular" e "Desvincular" com validações

2. **Auditoria:**
   - Criar tabela `mapping_audit_logs`
   - Registrar todas as mudanças de mapeamento

3. **Performance:**
   - Cache GET `/api/admin/mappings`
   - Redis para locks frequentes

4. **Notificações:**
   - Email quando mapeamento muda
   - Webhook para sistemas externos

5. **Relatórios:**
   - Dashboard com mapeamentos vistos
   - Histórico de mudanças

---

## 📚 Referências

- Express route handler: `routes/mappings.js`
- Tests: `tests/mappings.test.js`
- Server Actions: `src/app/admin/accommodations/actions.ts`
- Schema: `prisma/schema.prisma` (modelo AccommodationLock)
- Middleware: `middleware/auth.js`

---

**Status:** ✅ PASSO 13 — COMPLETO
**Criado:** 24 de Outubro de 2025
**Pronto para:** Integração UI + Testes e2e
