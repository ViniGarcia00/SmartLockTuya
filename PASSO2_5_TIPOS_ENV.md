# PASSO 2.5 — Tipos e Validação de Ambiente

## 📋 Visão Geral

Este documento descreve os novos arquivos criados para melhorar a arquitetura da integração Stays:

1. **`src/lib/stays.types.ts`** - Tipos TypeScript para Stays
2. **`src/lib/env.ts`** - Validação de variáveis de ambiente com Zod
3. **`src/lib/stays.examples.ts`** - Exemplos de uso
4. **`.env.example`** - Arquivo de referência com todas as variáveis

---

## 📦 Arquivos Criados

### 1. `src/lib/stays.types.ts` (370+ linhas)

Define todos os tipos e interfaces utilizados na integração Stays:

#### Interfaces Principais

**Reservation**
```typescript
interface Reservation {
  id: string;
  accommodationId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkInDate: string;     // YYYY-MM-DD
  checkOutDate: string;    // YYYY-MM-DD
  status: 'confirmed' | 'pending' | 'cancelled' | 'checked-in' | 'checked-out';
  numberOfGuests?: number;
  lockCode?: string;
  notes?: string;
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
  externalId?: string;
  totalPrice?: number;
  currency?: string;
}
```

**Accommodation**
```typescript
interface Accommodation {
  id: string;
  name: string;
  description?: string;
  address: string;
  addressNumber?: string;
  addressComplement?: string;
  neighborhood?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  capacity?: number;
  bedrooms?: number;
  bathrooms?: number;
  photoUrl?: string;
  lockIds?: string[];
  tuyaDeviceId?: string;
  createdAt: string;
  updatedAt: string;
  externalId?: string;
  active?: boolean;
}
```

#### Classe StaysError

Classe customizada para erros da API:

```typescript
class StaysError extends Error {
  public readonly type: StaysErrorType;
  public readonly statusCode?: number;
  public readonly details?: Record<string, any>;
  public readonly timestamp: string;
  public readonly requestId?: string;

  // Métodos auxiliares:
  isAuthenticationError(): boolean
  isAuthorizationError(): boolean
  isValidationError(): boolean
  isTimeoutError(): boolean
  isNetworkError(): boolean
  isRateLimitError(): boolean
  isMockError(): boolean
  toJSON()
  toString()
}
```

#### Tipos de Erro

```typescript
type StaysErrorType =
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'TIMEOUT_ERROR'
  | 'NETWORK_ERROR'
  | 'MOCK_ERROR'
  | 'UNKNOWN_ERROR';
```

#### Outros Tipos

- `ReservationStatus` - Estados de uma reserva
- `StaysApiResponse<T>` - Resposta genérica com paginação
- `PaginationParams` - Parâmetros de paginação
- `ReservationFilterParams` - Filtros para reservas
- `AccommodationFilterParams` - Filtros para acomodações
- `StaysClientConfig` - Configuração do cliente
- `SyncEvent` - Evento de sincronização

---

### 2. `src/lib/env.ts` (350+ linhas)

Validação de variáveis de ambiente com Zod:

#### Funcionalidades

**Validação Automática**
```typescript
const env = getEnvironment();
// Valida e retorna todas as variáveis de ambiente
```

**Helpers de Tipo**
```typescript
isProduction()      // true se NODE_ENV === 'production'
isDevelopment()     // true se NODE_ENV === 'development'
isTest()            // true se NODE_ENV === 'test'
isMockEnabled()     // true se STAYS_ENABLE_MOCK === 'true'
```

**Getters Especializados**
```typescript
getStaysConfig()    // Configuração do Stays
getDatabaseConfig() // Configuração do PostgreSQL
getRedisConfig()    // Configuração do Redis
getDatabaseUrl()    // URL de conexão do BD
getRedisUrl()       // URL de conexão do Redis
```

#### Variáveis Validadas

| Variável | Tipo | Padrão | Obrigatória |
|----------|------|--------|-------------|
| `NODE_ENV` | enum | development | ✓ |
| `PORT` | number | 3000 | ✓ |
| `JWT_SECRET` | string (32+ chars) | - | ✓ |
| `SESSION_SECRET` | string (32+ chars) | - | ✓ |
| `DB_HOST` | string | localhost | - |
| `DB_PORT` | number | 5432 | - |
| `DB_NAME` | string | tuya_locks_db | - |
| `DB_USER` | string | tuya_admin | - |
| `DB_PASSWORD` | string | - | ✓ |
| `REDIS_URL` | URL | - | - |
| `REDIS_HOST` | string | localhost | - |
| `REDIS_PORT` | number | 6379 | - |
| `REDIS_PASSWORD` | string | - | - |
| `STAYS_CLIENT_ID` | string | - | ✓ |
| `STAYS_CLIENT_SECRET` | string | - | ✓ |
| `STAYS_BASE_URL` | URL | https://api.staysapp.com | - |
| `STAYS_ENABLE_MOCK` | boolean | false | - |
| `EMAIL_SERVICE` | string | gmail | - |
| `EMAIL_USER` | email | - | - |
| `EMAIL_PASSWORD` | string | - | - |
| `APP_URL` | URL | http://localhost:3000 | - |
| `LOG_LEVEL` | enum | info | - |

---

### 3. `.env.example` (Atualizado)

Arquivo de referência com todas as variáveis de ambiente necessárias:

```bash
# Ambiente e Porta
NODE_ENV=development
PORT=3000

# Autenticação
JWT_SECRET=sua-chave-com-minimo-32-caracteres
SESSION_SECRET=sua-chave-com-minimo-32-caracteres

# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tuya_locks_db
DB_USER=tuya_admin
DB_PASSWORD=sua-senha

# Redis
REDIS_URL=redis://localhost:6379

# API Stays (NOVO)
STAYS_CLIENT_ID=seu-client-id
STAYS_CLIENT_SECRET=seu-client-secret
STAYS_BASE_URL=https://api.staysapp.com
STAYS_ENABLE_MOCK=false

# Email
EMAIL_SERVICE=gmail
EMAIL_USER=seu-email@gmail.com
EMAIL_PASSWORD=sua-senha-app

# Aplicação
APP_URL=http://localhost:3000
```

---

### 4. `src/lib/stays.examples.ts` (400+ linhas)

6 exemplos práticos completos:

#### Exemplo 1: Validação de Ambiente
```typescript
const env = getEnvironment();
console.log(env.NODE_ENV);      // 'development'
console.log(env.PORT);           // 3000
```

#### Exemplo 2: Helpers de Ambiente
```typescript
console.log(isDevelopment());    // true
console.log(isMockEnabled());    // false
console.log(getEnv('PORT'));     // 3000
```

#### Exemplo 3: Configurações Especializadas
```typescript
const staysConfig = getStaysConfig();
const dbConfig = getDatabaseConfig();
const redisConfig = getRedisConfig();

const dbUrl = getDatabaseUrl();
const redisUrl = getRedisUrl();
```

#### Exemplo 4: Usar Tipos de Stays
```typescript
const reserva: Reservation = {
  id: 'RES-001',
  accommodationId: 'ACC-001',
  guestName: 'João Silva',
  checkInDate: '2025-10-24',
  checkOutDate: '2025-10-27',
  status: 'confirmed',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

#### Exemplo 5: Tratamento de Erros
```typescript
throw new StaysError(
  'Credenciais inválidas',
  'AUTHENTICATION_ERROR',
  401,
  { reason: 'Invalid client_id' },
  'req-12345'
);

// Verificar tipo de erro
error.isAuthenticationError()    // true
error.isTimeoutError()           // false
```

#### Exemplo 6: Resposta da API
```typescript
const resposta: StaysApiResponse<Reservation[]> = {
  success: true,
  data: [...],
  statusCode: 200,
  timestamp: new Date().toISOString(),
  metadata: {
    total: 100,
    page: 1,
    pageSize: 50,
    totalPages: 2,
  },
};
```

---

## 🔧 Como Usar

### Importar Tipos
```typescript
import type {
  Reservation,
  Accommodation,
  StaysError,
  StaysApiResponse,
  PaginationParams,
} from './src/lib/stays.types';
```

### Importar Validação de Env
```typescript
import {
  getEnvironment,
  getStaysConfig,
  isProduction,
  isMockEnabled,
} from './src/lib/env';

// Usar
const env = getEnvironment();
const staysConfig = getStaysConfig();
```

### Executar Exemplos
```typescript
import { executarTodosExemplos } from './src/lib/stays.examples';

executarTodosExemplos();
```

---

## 📊 Dependências

- ✅ `zod` - Validação com schemas TypeScript
- ✅ `@types/node` - Type definitions para Node.js (instalado)

---

## ✅ Checklist

- ✅ `src/lib/stays.types.ts` criado com 370+ linhas
- ✅ Interfaces: Reservation, Accommodation, StaysApiResponse
- ✅ Classe: StaysError com métodos auxiliares
- ✅ `src/lib/env.ts` criado com validação Zod
- ✅ Helpers: isProduction, isDevelopment, isMockEnabled, etc
- ✅ Getters especializados: getStaysConfig, getDatabaseConfig, getRedisConfig
- ✅ `.env.example` atualizado com todas as variáveis
- ✅ `src/lib/stays.examples.ts` com 6 exemplos completos
- ✅ Zod instalado como dependência
- ✅ @types/node instalado para TypeScript

---

## 🎯 Próximas Passos

1. ✅ PASSO 2 - Cliente Stays ✓
2. ✅ PASSO 2.5 - Tipos e Env ✓
3. ⏳ PASSO 3 - Schema do Banco de Dados
4. ⏳ PASSO 4 - Rotas Express
5. ⏳ PASSO 5 - Sincronização
6. ⏳ PASSO 6 - Testes

---

**Documento gerado:** 23/10/2025  
**Branch:** integration-stays  
**Versão:** 1.0
