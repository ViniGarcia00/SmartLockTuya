# 🚀 PASSO 20 - QUICK START GUIDE

## ⚡ Comando Rápido

```bash
npm run test:e2e
```

## 📋 Pré-requisitos (Checklist)

```bash
# 1. Verificar PostgreSQL
psql -U tuya_admin -d tuya_locks_db -c "SELECT 1"
# Esperado: 1 linha com valor "1"

# 2. Verificar Redis
redis-cli ping
# Esperado: PONG

# 3. Verificar API
curl http://localhost:3000/api/health
# Esperado: resposta com status

# 4. Verificar .env
cat .env | grep -E "DB_|REDIS_URL|API_URL"
# Esperado: todas as variáveis preenchidas
```

## 🎯 Fluxo de Teste

```
Sync Accommodations (5 criadas)
         ↓
Map Locks (5 mapeamentos)
         ↓
Receive Webhook (reserva criada)
         ↓
Generate PIN (T-2h)
         ↓
Validate PIN (mascarado)
         ↓
Revoke PIN (T-checkout)
         ↓
Verify Logs (estruturados)
         ↓
✓ SUCCESS
```

## 📊 Arquivos Criados

| Arquivo | Linhas | Propósito |
|---------|--------|----------|
| `src/__tests__/e2e/full-simulation.test.ts` | 600+ | Teste E2E principal |
| `docs/E2E-SIMULATION.md` | 450+ | Documentação completa |
| `scripts/run-e2e.js` | 120+ | Script helper |
| `PASSO_20_E2E_SIMULATION_FINAL.txt` | 300+ | Checklist final |

## 🔧 Executar Teste

### Opção 1: Básico
```bash
npm run test:e2e
```

### Opção 2: Com watch (desenvolvimento)
```bash
npm run test:e2e:watch
```

### Opção 3: Com script helper
```bash
node scripts/run-e2e.js
```

### Opção 4: Direto com Jest
```bash
npx jest src/__tests__/e2e/full-simulation.test.ts --detectOpenHandles
```

## 🐛 Troubleshooting Rápido

### ❌ "Falha ao registrar usuário"
```bash
# Solução: Resetar banco
npm run db:setup
```

### ❌ "Redis connection error"
```bash
# Solução: Iniciar Redis
redis-server
# Ou com Docker:
docker run -d -p 6379:6379 redis:alpine
```

### ❌ "API não respondeu"
```bash
# Solução: Iniciar API em outro terminal
npm run dev
```

### ❌ "Nenhuma acomodação foi criada"
```bash
# Solução: Iniciar mock server em outro terminal
npm run mock:stays
```

## 📈 Esperado na Saída

✓ Todas as 7 etapas com sucesso (verde)
✓ Tempo total < 10s
✓ Relatório final mostrando:
  - Acomodações criadas
  - Mapeamentos feitos
  - PINs gerados e revogados
  - Logs validados

## 🔐 Validações Principais

- ✅ 5+ acomodações sincronizadas
- ✅ 5+ mapeamentos criados
- ✅ Reserva processada com check_in_at e check_out_at
- ✅ PIN gerado e hasheado
- ✅ PIN mascarado corretamente (****XX)
- ✅ PIN revogado no checkout
- ✅ Logs estruturados sem dados sensíveis

## 📝 Documentação Completa

Ver arquivo detalhado: `docs/E2E-SIMULATION.md`

## 🆘 Precisa de Ajuda?

1. Verifique logs: `npm run dev 2>&1 | head -50`
2. Verifique banco: `psql -U tuya_admin -d tuya_locks_db -c "SELECT COUNT(*) FROM accommodations"`
3. Verifique Redis: `redis-cli INFO stats`
4. Verifique .env: `env | grep TUYA`

---

**Status:** ✅ Production Ready  
**Versão:** 1.0.0  
**Data:** Outubro 2025
