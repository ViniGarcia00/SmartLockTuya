# Smart Lock (Tuya)

Controle de fechaduras inteligentes via integração com a Tuya Cloud.

## 🧱 Stack
- Node.js + Express
- (DB) Postgres/MySQL/SQLite — defina no `.env`
- Integração: Tuya Cloud API

## ⚙️ Pré-requisitos
- Node 18+
- NPM ou Yarn
- Arquivo `.env` (baseie-se no `.env.example`)

## 🔐 Variáveis de ambiente
Copie `.env.example` para `.env` e preencha:
```
TUYA_ACCESS_ID=
TUYA_ACCESS_KEY=
DB_HOST=
DB_PORT=
DB_USER=
DB_PASS=
DB_NAME=
PORT=3000
NODE_ENV=development
```

## ▶️ Como rodar
```bash
npm install
npm run dev
# ou
npm run start
```

## 🧪 Scripts
- `npm run dev` – inicia servidor em modo dev
- `npm run start` – inicia servidor em prod
- `npm run lint` – checa problemas de lint
- `npm run lint:fix` – corrige lint quando possível
- `npm run format` – formata com Prettier

## 📁 Estrutura (sugerida)
```
config/
middleware/
models/
routes/
public/
server.js
```

## 🔌 API (rascunho)
- `GET /health` — status da API
- `POST /locks/:id/open` — abre fechadura
- `POST /locks/:id/close` — fecha fechadura
> Documentar com Swagger (próximo passo sugerido).

## 🔐 Segurança
- Nunca versione `.env`.
- Gire credenciais se suspeitar de vazamento.

## 🗺️ Roadmap
- [ ] Documentação OpenAPI
- [ ] Serviço Tuya isolado (retries, timeouts)
- [ ] Logs estruturados
- [ ] Tests (unit/integration)
- [ ] CI (lint/test/build)
