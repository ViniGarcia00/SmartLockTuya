# PASSO 17 - Testes de Integração Completos

## 📋 Visão Geral

Testes de integração completos que validam todo o fluxo do sistema:
- Criação, atualização e cancelamento de reservas
- Geração e revogação de PINs
- Mapeamento de locks e acomodações
- Webhooks Stays
- Reconciliação

## 📁 Estrutura

```
src/__tests__/integration/
├── full-flow.test.ts           # Fluxo completo (criar, atualizar, cancelar, reconciliar)
├── webhook-flow.test.ts        # Fluxo de webhooks (POST, armazenamento, criação)
├── mapping-flow.test.ts        # Fluxo de mapeamento (criar, validar, desmapar)
└── pin-generation-flow.test.ts # Fluxo de geração de PIN (criar, expirar, revogar)
```

## 🚀 Como Rodar

### Todos os testes de integração

```bash
npm run test:integration
```

### Em modo watch (development)

```bash
npm run test:integration:watch
```

### Com coverage

```bash
npm run test:coverage -- --testPathPattern=__tests__/integration
```

### Teste específico

```bash
npm test -- full-flow.test.ts
npm test -- webhook-flow.test.ts
npm test -- mapping-flow.test.ts
npm test -- pin-generation-flow.test.ts
```

## 📋 Testes Incluídos

### 1. **full-flow.test.ts** - Fluxo Completo

Cenários testados:

#### Cenário 1: Criação de Reserva
- ✅ Criar Reservation via webhook
- ✅ Agendar PIN generation job (2h antes check-in)
- ✅ Agendar PIN revocation job (24h após check-out)
- ✅ Verificar jobs agendados

#### Cenário 2: Atualização de Reserva
- ✅ Antecipação de check-in
- ✅ Reagendar jobs com novo delay
- ✅ Validar novo schedule

#### Cenário 3: Cancelamento
- ✅ Marcar Reservation como CANCELLED
- ✅ Revogar PIN (desativar Credential)
- ✅ Cancelar jobs pendentes
- ✅ Validar estado final

#### Cenário 4: Reconciliação Recupera Reserva
- ✅ Deletar Reservation (simular perda de dados)
- ✅ Executar reconciliação
- ✅ Verificar Reservation re-criado

#### Teste: Consistência ACID
- ✅ Criar múltiplos credentials concorrentemente
- ✅ Validar integridade de dados

### 2. **webhook-flow.test.ts** - Fluxo de Webhooks

Testes:

#### Teste 1: POST Webhook
- ✅ Enviar payload válido
- ✅ Receber status 200

#### Teste 2: Webhook Armazenado
- ✅ Verificar webhook no banco
- ✅ Validar payload

#### Teste 3: Reservation Criado
- ✅ Criar Reservation do payload
- ✅ Validar dados

#### Teste 4: EventId Retornado
- ✅ Verificar eventId na response
- ✅ Timestamp correto

#### Teste 5: Webhook Inválido
- ✅ Rejeitar payload incompleto
- ✅ Retornar status 400

#### Teste 6: Idempotência
- ✅ Detectar webhook duplicado
- ✅ Não processar duas vezes

### 3. **mapping-flow.test.ts** - Fluxo de Mapeamento

Testes:

#### Teste 1: Criar Mapping
- ✅ Mapear Lock à Accommodation
- ✅ Verificar no banco

#### Teste 2: Validar 1:1
- ✅ Enforcer constraint de mapeamento único
- ✅ Prevenir múltiplos locks por accommodation

#### Teste 3: Desmapar
- ✅ Remover mapping
- ✅ Verificar remoção

#### Teste 4: Remapar
- ✅ Mudar Lock de uma Accommodation
- ✅ Atualizar mapping

#### Teste 5: Cascade Delete
- ✅ Deletar Lock remove mapping
- ✅ Validar cascade

#### Teste 6: Query Mappings
- ✅ Listar todos os mappings
- ✅ Incluir dados do Lock

### 4. **pin-generation-flow.test.ts** - Fluxo de PIN

Testes:

#### Teste 1: Gerar PIN
- ✅ Gerar PIN aleatório (7 dígitos)
- ✅ Hash do PIN com SHA256
- ✅ Chamar mock lock provider
- ✅ Criar Credential

#### Teste 2: PIN Seguro
- ✅ PIN não exposto em queries
- ✅ Apenas hash retornado

#### Teste 3: Rotação de PIN
- ✅ Criar novo PIN
- ✅ Desativar antigo
- ✅ Validar novo como ativo

#### Teste 4: Expiração
- ✅ Criar PIN com data de expiração
- ✅ Verificar expiração
- ✅ Query apenas PINs válidos

#### Teste 5: Revogar
- ✅ Chamar mock lock provider revoke
- ✅ Marcar como inativo
- ✅ Registrar revokedAt

#### Teste 6: Query por Reservation
- ✅ Listar todos os credentials
- ✅ Filtrar apenas ativos
- ✅ Validar dados

#### Teste 7: Gerador de PIN
- ✅ Validar formato (7 dígitos)
- ✅ Verificar unicidade
- ✅ Consistência

## 🔧 Configuração

### Variáveis de Ambiente (testes)

```env
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5432/tuya_locks_test
REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test-secret-key
```

### jest.setup.js

- Timeout padrão: 30 segundos (ideal para DB)
- Mock de env vars
- Console disponível para logging

### jest.config.js

- Preset: ts-jest
- Environment: node
- Test pattern: `**/__tests__/**/*.test.ts`
- Module path aliases: `@/` → `src/`

## 📊 O que é Testado

| Componente | Testes | Status |
|-----------|--------|--------|
| Accommodation | CRUD, query, cascade | ✅ |
| Lock | CRUD, query | ✅ |
| AccommodationLock | 1:1 mapping, cascade | ✅ |
| Reservation | CRUD, status changes | ✅ |
| Credential | Create, rotate, expire, revoke | ✅ |
| Webhook | Store, parse, idempotent | ✅ |
| PIN Generation | Hash, security, expiration | ✅ |
| Jobs (BullMQ) | Schedule, reschedule, cancel | ✅ |

## 🎯 Cobertura Esperada

```
Statements   : 85%+
Branches     : 80%+
Functions    : 85%+
Lines        : 85%+
```

## 🐛 Debugging

### Logs Detalhados

Cada teste mostra logs detalhados:

```
=== Setup: Full Flow Tests ===

✅ Accommodation criado
✅ Lock criado
✅ Mapping criado
✅ Reservation criado
✅ Setup completo

--- Cenário 1: Criação de Reserva ---

✅ Reservation criado: uuid-123
✅ Credentials para jogging de dados
✅ Jobs agendados: gen-uuid-123, rev-uuid-123
✅ Cenário 1 completo
```

### Rodar com Verbose

```bash
npm test -- --verbose full-flow.test.ts
```

### Pausar em Erro

```bash
npm test -- --bail full-flow.test.ts
```

## ⚠️ Pré-requisitos

1. **PostgreSQL**
   - Banco de testes criado
   - Schema migrado (`npx prisma migrate dev`)

2. **Redis**
   - Rodando em `localhost:6379`
   - Banco 1 para testes

3. **Node.js**
   - v16+ recomendado

## 🚀 CI/CD Integration

### GitHub Actions

```yaml
- name: Run Integration Tests
  run: npm run test:integration
  env:
    DATABASE_URL: postgres://user:pass@localhost:5432/test_db
    REDIS_URL: redis://localhost:6379/1
```

### GitLab CI

```yaml
test:integration:
  script:
    - npm run test:integration
  services:
    - postgres:14
    - redis:7
```

## 📈 Próximos Passos

1. ✅ Testes de integração criados
2. ⏳ E2E tests com testcafé ou Cypress
3. ⏳ Performance tests (load testing)
4. ⏳ Security tests (penetration)
5. ⏳ API contract tests

## 📞 Suporte

Para problemas:

1. Verificar que PostgreSQL e Redis estão rodando
2. Checkar variáveis de ambiente
3. Limpar banco de testes: `npx prisma migrate reset`
4. Rodar com `--verbose` para mais detalhes

## 📚 Referências

- [Jest Documentation](https://jestjs.io/)
- [Prisma Testing](https://www.prisma.io/docs/guides/testing/unit-testing)
- [BullMQ Testing](https://docs.bullmq.io/guide/testing)
- [TypeScript Jest](https://kulshekhar.github.io/ts-jest/)
