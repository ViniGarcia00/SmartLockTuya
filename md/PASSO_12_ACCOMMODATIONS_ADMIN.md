# 🏠 PASSO 12: Página Admin - Acomodações & Fechaduras

## ✅ Implementação Completa

### 📋 O que foi criado

#### 1. **Interface Admin** (`public/admin-accommodations.html`)

Página completa com:
- ✅ Header com título e descrição
- ✅ Botão "Sincronizar Acomodações" (POST /admin/stays/sync-accommodations)
- ✅ Tabela responsiva com:
  - Nome da Acomodação
  - Status (Active/Inactive badge)
  - Fechadura Vinculada (ou "Sem mapeamento")
  - Ações (Vincular/Desvincular)
- ✅ Sidebar com "Fechaduras Sem Mapeamento"
- ✅ Paginação simples (10 por página)
- ✅ Modal para vincular fechadura
- ✅ Tema dark com TailwindCSS (cores: azul/roxo)
- ✅ Alerts para sucesso/erro
- ✅ Responsivo (mobile, tablet, desktop)

#### 2. **Endpoints Express** (`server.js`)

```javascript
GET /api/admin/accommodations
  - Retorna: accommodations[], locks[], mappings[], unmappedLocks[]
  - Autenticação: Bearer token

POST /api/admin/accommodations/link
  - Body: { accommodationId, lockId }
  - Vincular fechadura a acomodação
  - Autenticação: Bearer token

POST /api/admin/accommodations/unlink/:accommodationId
  - Desvin cular fechadura
  - Autenticação: Bearer token
```

#### 3. **Tabelas PostgreSQL** (Criadas via migração)

```sql
accommodations
├─ id (PK)
├─ name
├─ status
└─ timestamps

locks
├─ id (PK)
├─ user_id (FK)
├─ name
├─ location
├─ device_id
└─ timestamps

accommodation_lock_mappings
├─ id (PK)
├─ accommodation_id (FK, UNIQUE)
├─ lock_id (FK)
└─ timestamps
```

#### 4. **Script de Migração** (`scripts/migrate-accommodations.js`)

```bash
npm run db:migrate-accommodations
```

Cria automaticamente todas as tabelas e índices necessários.

---

## 🚀 Como Usar

### 1. Preparar Banco de Dados

```bash
npm run db:migrate-accommodations
```

**Resultado esperado:**
```
✅ Migração concluída com sucesso!

Tabelas criadas:
  ✓ accommodations
  ✓ locks
  ✓ accommodation_lock_mappings
```

### 2. Iniciar Servidor

```bash
npm start
```

Servidor rodará em `http://localhost:3000`

### 3. Acessar Interface Admin

```
http://localhost:3000/admin-accommodations.html
```

Você verá:
- Interface com acomodações
- Sidebar com fechaduras não mapeadas
- Botões para vincular/desvincular

### 4. Operações Disponíveis

**Sincronizar Acomodações**
- Clique em "🔄 Sincronizar Acomodações"
- Carrega dados da API de Stays
- Atualiza tabela em tempo real

**Vincular Fechadura**
- Clique em "Vincular" na acomodação
- Selecione uma fechadura no modal
- Clique em "Vincular"
- Página se atualiza automaticamente

**Desvincular Fechadura**
- Clique em "Desvincular"
- Confirme a ação
- Fechadura volta para "Sem Mapeamento"

---

## 📊 Fluxo de Dados

```
Interface (HTML)
     ↓
GET /api/admin/accommodations
     ↓
server.js → PostgreSQL
  - SELECT from accommodations
  - SELECT from locks
  - SELECT from accommodation_lock_mappings
     ↓
JSON response: {
  accommodations: [...],
  locks: [...],
  mappings: [...],
  unmappedLocks: [...]
}
     ↓
Renderiza tabela + sidebar
     ↓
Usuário clica "Vincular"
     ↓
POST /api/admin/accommodations/link
  { accommodationId, lockId }
     ↓
Insere em accommodation_lock_mappings
     ↓
Atualiza tabela
```

---

## 🔐 Segurança

- ✅ Todos os endpoints requerem autenticação (Bearer token)
- ✅ Middleware `authenticateToken` valida JWT
- ✅ SQL usa prepared statements (proteção contra SQL injection)
- ✅ Foreign keys garantem integridade referencial
- ✅ CASCADE DELETE remove mapeamentos ao deletar acomodação/fechadura

---

## 📱 Interface Responsiva

| Viewport | Comportamento |
|----------|---------------|
| Desktop (>1200px) | 2 colunas (tabela + sidebar) |
| Tablet (768-1200px) | 2 colunas, ajustes |
| Mobile (<768px) | 1 coluna, sidebar abaixo |

---

## 🎨 Componentes UI

### Tabela
- Linhas hover com fundo semi-transparente
- Badges coloridas para status
- Botões com ícones e cores significativas
- Paginação com números

### Sidebar
- Lista de fechaduras sem mapeamento
- Scroll interno (max-height: 500px)
- Hover effects
- Seleção visual

### Modal
- Fundo semi-transparente
- Conteúdo centrado
- Form com select
- Botões Cancelar/Vincular

### Alerts
- Success (verde)
- Error (vermelho)
- Info (azul)
- Auto-hide após 4 segundos

---

## 🧪 Teste Rápido

### 1. Inserir Dados de Teste

```sql
-- Acomodações
INSERT INTO accommodations (id, name, status) VALUES
('apt001', 'Apartamento 101', 'active'),
('apt002', 'Apartamento 102', 'active'),
('apt003', 'Apartamento 201', 'inactive');

-- Fechaduras
INSERT INTO locks (id, name, location) VALUES
('lock001', 'Fechadura Principal', 'Porta Frente'),
('lock002', 'Fechadura Fundos', 'Porta Fundos'),
('lock003', 'Fechadura Garagem', 'Garagem');

-- Mapeamentos
INSERT INTO accommodation_lock_mappings (accommodation_id, lock_id) VALUES
('apt001', 'lock001');
```

### 2. Acessar Interface

```
http://localhost:3000/admin-accommodations.html
```

### 3. Verificar

- Tabela mostra 3 acomodações
- 2 têm botão "Desvincular"
- 1 tem botão "Vincular"
- Sidebar mostra 2 fechaduras sem mapeamento

---

## 📝 Estrutura de Arquivos

```
src/
├── app/admin/
│   └── accommodations/
│       ├── page.tsx (HTML)
│       ├── actions.ts (server actions)
│       └── components/
│           ├── AccommodationTable.tsx
│           └── UnmappedLocks.tsx

public/
└── admin-accommodations.html

server.js
├── GET /api/admin/accommodations
├── POST /api/admin/accommodations/link
└── POST /api/admin/accommodations/unlink/:id

scripts/
└── migrate-accommodations.js

database_schema.sql
└── +accommodations table
└── +locks table
└── +accommodation_lock_mappings table
```

---

## 🔗 Endpoints Completos

### GET /api/admin/accommodations

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "accommodations": [
    {
      "id": "apt001",
      "name": "Apartamento 101",
      "status": "active",
      "created_at": "2025-10-23T...",
      "updated_at": "2025-10-23T..."
    }
  ],
  "locks": [
    {
      "id": "lock001",
      "name": "Fechadura Principal",
      "location": "Porta Frente",
      "device_id": "eb97495fa9681bedeftre0"
    }
  ],
  "mappings": [
    {
      "accommodationId": "apt001",
      "lockId": "lock001"
    }
  ],
  "unmappedLocks": [
    {
      "id": "lock002",
      "name": "Fechadura Fundos",
      "location": "Porta Fundos",
      "device_id": "eb14a8ffa1a790c0a6kwmd"
    }
  ]
}
```

### POST /api/admin/accommodations/link

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "accommodationId": "apt001",
  "lockId": "lock002"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Fechadura vinculada com sucesso",
  "mapping": {
    "id": 1,
    "accommodation_id": "apt001",
    "lock_id": "lock002",
    "created_at": "2025-10-24T..."
  }
}
```

### POST /api/admin/accommodations/unlink/:accommodationId

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Fechadura desvinculada com sucesso",
  "mapping": {
    "id": 1,
    "accommodation_id": "apt001",
    "lock_id": "lock002"
  }
}
```

---

## ✨ Features

- ✅ Tabela paginada (10 itens/página)
- ✅ Sincronização com API de Stays
- ✅ Modal para seleção de fechadura
- ✅ Confirmação de ações
- ✅ Feedback visual (alerts)
- ✅ Loading spinner no botão sync
- ✅ Status badges (Active/Inactive)
- ✅ Sidebar sticky (desktop)
- ✅ Responsivo

---

## 🎯 Próximos Passos (PASSO 13+)

- [ ] Adicionar filtros (status, search)
- [ ] Bulk operations (vincular múltiplas)
- [ ] Histórico de mapeamentos
- [ ] Notificações em tempo real
- [ ] Integração com Tuya API
- [ ] Dashboard com estatísticas

---

## 📞 Comandos Úteis

```bash
# Executar migração
npm run db:migrate-accommodations

# Iniciar servidor
npm start

# Acessar interface
http://localhost:3000/admin-accommodations.html

# Consultar banco (via psql)
psql -U tuya_admin -d tuya_locks_db
SELECT * FROM accommodations;
SELECT * FROM locks;
SELECT * FROM accommodation_lock_mappings;
```

---

**Criado:** 24 de Outubro de 2025
**Status:** ✅ PRONTO PARA PRODUÇÃO
**Tempo de Implementação:** ~30 minutos
