# Cliente da API Stays - Documentação

## 📋 Visão Geral

O `StaysClient` é um cliente TypeScript para integração com a API Stays. Ele fornece:

- ✅ Autenticação Basic (client_id:client_secret)
- ✅ Timeout de 10 segundos
- ✅ Retry automático com 3 tentativas (exponential backoff)
- ✅ Modo MOCK para testes
- ✅ Tratamento de erros robusto
- ✅ Suporte a paginação

---

## 🚀 Instalação e Configuração

### Arquivo
```
src/lib/stays-client.ts
```

### Dependências
O cliente utiliza:
- `axios` - HTTP client
- TypeScript interfaces para type-safety

### Variáveis de Ambiente
Adicione ao `.env`:

```env
# Configuração Stays
STAYS_CLIENT_ID=seu-client-id
STAYS_CLIENT_SECRET=seu-client-secret
STAYS_API_URL=https://api.staysapp.com

# Ativar modo MOCK (true/false)
STAYS_ENABLE_MOCK=true
```

---

## 📚 Classes e Interfaces

### Interface: StaysReservation
```typescript
interface StaysReservation {
  id: string;                          // ID da reserva
  accommodationId: string;             // ID da acomodação
  guestName: string;                   // Nome do hóspede
  checkInDate: string;                 // Data de entrada (YYYY-MM-DD)
  checkOutDate: string;                // Data de saída (YYYY-MM-DD)
  status: 'confirmed' | 'pending' | 'cancelled'; // Status
  createdAt: string;                   // Data de criação (ISO 8601)
  updatedAt: string;                   // Data de atualização (ISO 8601)
  lockCode?: string;                   // Código da fechadura (opcional)
}
```

### Interface: StaysAccommodation
```typescript
interface StaysAccommodation {
  id: string;                    // ID da acomodação
  name: string;                  // Nome
  address: string;               // Endereço
  city: string;                  // Cidade
  country: string;               // País
  createdAt: string;             // Data de criação
  updatedAt: string;             // Data de atualização
}
```

### Interface: StaysResponse<T>
```typescript
interface StaysResponse<T> {
  success: boolean;              // Sucesso da requisição
  data?: T;                      // Dados retornados
  error?: string;                // Mensagem de erro
  timestamp: string;             // Timestamp da resposta
}
```

### Classe: StaysClient

#### Construtor
```typescript
constructor(
  clientId: string,              // ID do cliente
  clientSecret: string,          // Secret do cliente
  baseURL?: string,              // URL base (padrão: https://api.staysapp.com)
  enableMock?: boolean           // Ativar MOCK (padrão: false)
)
```

#### Métodos

##### listReservations()
```typescript
async listReservations(
  limit?: number,     // Quantidade de reservas (padrão: 100)
  offset?: number     // Offset para paginação (padrão: 0)
): Promise<StaysResponse<StaysReservation[]>>
```

**Exemplo:**
```typescript
const response = await staysClient.listReservations(50, 0);

if (response.success) {
  console.log(`${response.data.length} reservas carregadas`);
  response.data.forEach(res => {
    console.log(`Reserva ${res.id}: ${res.guestName} (${res.status})`);
  });
} else {
  console.error(response.error);
}
```

##### listAccommodations()
```typescript
async listAccommodations(
  limit?: number,     // Quantidade de acomodações (padrão: 100)
  offset?: number     // Offset para paginação (padrão: 0)
): Promise<StaysResponse<StaysAccommodation[]>>
```

**Exemplo:**
```typescript
const response = await staysClient.listAccommodations(20);

if (response.success) {
  response.data.forEach(acc => {
    console.log(`${acc.name} - ${acc.city}, ${acc.country}`);
  });
}
```

##### getReservationUpdatedSince()
```typescript
async getReservationUpdatedSince(
  timestamp: string,  // ISO 8601 (ex: "2025-10-23T00:00:00Z")
  limit?: number      // Quantidade de reservas (padrão: 100)
): Promise<StaysResponse<StaysReservation[]>>
```

**Exemplo:**
```typescript
const response = await staysClient.getReservationUpdatedSince(
  '2025-10-23T00:00:00Z',
  50
);

if (response.success) {
  console.log(`${response.data.length} reservas atualizadas`);
}
```

##### getConfig()
```typescript
getConfig(): {
  clientId: string;
  baseURL: string;
  timeout: number;
  maxRetries: number;
  enableMock: boolean;
}
```

---

## 🔧 Factory Function

### createStaysClient()
Função auxiliar para criar instância lendo variáveis de ambiente:

```typescript
import { createStaysClient } from './stays-client';

const staysClient = createStaysClient();
// Lê: STAYS_CLIENT_ID, STAYS_CLIENT_SECRET, STAYS_API_URL, STAYS_ENABLE_MOCK
```

---

## 🧪 Modo MOCK

### Ativar MOCK

**Opção 1: Variável de ambiente**
```env
STAYS_ENABLE_MOCK=true
```

**Opção 2: Construtor**
```typescript
const staysClient = new StaysClient(
  'client-id',
  'client-secret',
  'https://api.staysapp.com',
  true // enableMock
);
```

### Dados de Exemplo (MOCK)

#### Reservas
```javascript
[
  {
    id: 'RES-001',
    accommodationId: 'ACC-001',
    guestName: 'João Silva',
    checkInDate: '2025-10-24',
    checkOutDate: '2025-10-27',
    status: 'confirmed',
    createdAt: '2025-10-20T10:00:00Z',
    updatedAt: '2025-10-20T10:00:00Z',
    lockCode: '1234567'
  },
  // ... mais reservas
]
```

#### Acomodações
```javascript
[
  {
    id: 'ACC-001',
    name: 'Apartamento Centro',
    address: 'Rua Principal, 123',
    city: 'São Paulo',
    country: 'Brasil',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-10-20T00:00:00Z'
  },
  // ... mais acomodações
]
```

---

## 🔐 Autenticação Basic

O cliente implementa automaticamente autenticação Basic:

```
Authorization: Basic base64(client_id:client_secret)
```

**Exemplo:**
- client_id: `test-client`
- client_secret: `test-secret`
- Resultado: `Authorization: Basic dGVzdC1jbGllbnQ6dGVzdC1zZWNyZXQ=`

---

## ⏱️ Retry e Timeout

### Configurações
- **Timeout:** 10 segundos (10000ms)
- **Max Retries:** 3 tentativas
- **Backoff:** Exponencial (1s, 2s, 4s)

### Fluxo
```
Tentativa 1 → Erro → Aguarda 1s
Tentativa 2 → Erro → Aguarda 2s
Tentativa 3 → Erro → Aguarda 4s
Tentativa 4 → Falha Final
```

---

## 📝 Exemplos de Uso

### Exemplo 1: Listar todas as reservas confirmadas
```typescript
const staysClient = createStaysClient();

let todosReservadas = [];
let offset = 0;
const limit = 50;

while (true) {
  const response = await staysClient.listReservations(limit, offset);
  
  if (!response.success) {
    console.error(response.error);
    break;
  }
  
  const confirmadas = response.data.filter(r => r.status === 'confirmed');
  todosReservadas.push(...confirmadas);
  
  if (response.data.length < limit) {
    break; // Fim da paginação
  }
  
  offset += limit;
}

console.log(`Total de reservas confirmadas: ${todosReservadas.length}`);
```

### Exemplo 2: Sincronizar reservas atualizadas
```typescript
import { parse } from 'date-fns';

const staysClient = createStaysClient();

// Buscar reservas dos últimos 7 dias
const dataSeiseDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const timestamp = dataSeiseDiasAtras.toISOString();

const response = await staysClient.getReservationUpdatedSince(timestamp);

if (response.success) {
  console.log(`${response.data.length} reservas foram atualizadas`);
  
  // Processar cada reserva
  for (const reserva of response.data) {
    await atualizarFechaduraTemporaria(reserva);
  }
}
```

### Exemplo 3: Integração com banco de dados
```typescript
import { query } from '../config/database';

const staysClient = createStaysClient();

const response = await staysClient.listReservations(100);

if (response.success) {
  for (const reserva of response.data) {
    await query(
      'INSERT INTO stays_reservations (stays_id, guest_name, check_in, check_out, status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (stays_id) DO UPDATE SET status = $5',
      [reserva.id, reserva.guestName, reserva.checkInDate, reserva.checkOutDate, reserva.status]
    );
  }
}
```

---

## 🐛 Tratamento de Erros

Todos os métodos retornam `StaysResponse<T>` com campos `success` e `error`:

```typescript
const response = await staysClient.listReservations();

if (!response.success) {
  console.error(`Erro: ${response.error}`);
  // Tratar erro
} else {
  console.log(`Sucesso: ${response.data.length} items`);
}
```

### Erros Comuns

| Erro | Causa | Solução |
|------|-------|--------|
| `Falha ao listar reservas: timeout` | Timeout de 10s | Aumentar timeout ou verificar conexão |
| `Falha ao listar reservas: 401 Unauthorized` | Credenciais inválidas | Verificar STAYS_CLIENT_ID e STAYS_CLIENT_SECRET |
| `Timestamp inválido` | Formato ISO 8601 incorreto | Usar `new Date().toISOString()` |

---

## 📊 Logging

O cliente registra automaticamente:
- ✅ Retries com backoff
- ✅ Chamadas em modo MOCK
- ✅ Erros de requisição
- ✅ Timestamps de resposta

**Exemplo de output:**
```
[StaysClient] Retrying 1/3 after 1000ms
[StaysClient - MOCK] Returning 3 reservations
[StaysClient - MOCK] Returning 2 accommodations
```

---

## 🔗 Integração com Express

### Route Handler
```typescript
import { Router } from 'express';
import { createStaysClient } from '../src/lib/stays-client';

const router = Router();
const staysClient = createStaysClient();

router.get('/api/stays/reservations', async (req, res) => {
  const response = await staysClient.listReservations(
    parseInt(req.query.limit as string) || 100,
    parseInt(req.query.offset as string) || 0
  );
  
  if (response.success) {
    res.json({ success: true, data: response.data });
  } else {
    res.status(500).json({ success: false, error: response.error });
  }
});

export default router;
```

---

## 📦 Próximos Passos

1. ✅ Cliente criado
2. ⏳ Integração com banco de dados (PASSO 3)
3. ⏳ Rotas Express (PASSO 4)
4. ⏳ Sincronização automática (PASSO 5)
5. ⏳ Testes unitários (PASSO 6)

---

**Documento gerado:** 23/10/2025  
**Versão:** 1.0  
**Branch:** integration-stays
