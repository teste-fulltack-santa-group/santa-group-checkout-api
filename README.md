# Santa Group Checkout API (Node + TS + Express + Prisma)

API de checkout com **PIX** e **Cartão** usando **PostgreSQL/Prisma**, validações com **Zod**, logs estruturados (**pino**), segurança básica (helmet, CORS, rate limit) e **seed** de produtos para teste.

---

## 🧱 Stack & Arquitetura

- **Node.js** 18+ (recomendado 18.17+ ou 20)
- **Express** + **TypeScript**
- **Prisma** + **PostgreSQL**
- **Zod** (validações)
- **pino / pino-http** (logs)
- **helmet**, **cors**, **express-rate-limit**
- **qrcode** (QR do PIX)

Estrutura (resumo):
```
prisma/
  schema.prisma
  migrations/
  seed.ts
src/
  index.ts
  server.ts
  lib/
    prisma.ts
    env.ts
    errors.ts
    validate.ts
    schemas.ts
    antifraud.ts
  routes/
    products.ts
    payments.pix.ts
    webhooks.pix.ts
    payments.card.ts
    orders.ts
```

---

## 🔧 Requisitos

- **Node** 18+  
- **PostgreSQL** (local ou Docker)
- (Opcional) **DBeaver** para visualizar o banco

---

## 🔐 Variáveis de ambiente

Crie um `.env` na raiz (NÃO versione) a partir do `.env.example`:

```env
PORT=4000
WEB_ORIGIN=http://localhost:3000
LOG_LEVEL=info
DATABASE_URL="postgresql://<usuario>:<senha>@localhost:5432/checkout?schema=public"
```

> Se usar Docker com outra porta (ex.: 5433), ajuste na URL.

---

## 🗄️ Banco de Dados

### Opção A) Postgres local (porta 5432)
1. Conecte no Postgres (ex.: DBeaver).
2. Crie a database **`checkout`** (UTF8).  
   (Opcional) Crie um usuário dedicado e defina como **owner**.

### Opção B) Docker (porta 5433)
```bash
docker run --name pg-checkout -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=checkout -p 5433:5432 -d postgres:16
```
`.env`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/checkout?schema=public"
```

---

## 🚀 Instalação & Setup

```bash
# instalar dependências
npm install

# gerar Prisma Client
npx prisma generate

# aplicar migração inicial (cria tabelas)
npx prisma migrate dev --name init

# seed de produtos (p1, p2, p3)
npm run db:seed
```

Scripts úteis no `package.json`:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",

    "prisma:format": "prisma format",
    "prisma:validate": "prisma validate",
    "prisma:generate": "prisma generate",
    "prisma:studio": "prisma studio",

    "db:setup": "npm run prisma:format && npm run prisma:validate && npm run prisma:generate && prisma migrate dev --name init && npm run db:seed",
    "db:migrate:new": "prisma migrate dev --name",
    "db:deploy": "prisma migrate deploy",
    "db:reset": "prisma migrate reset --force",
    "db:seed": "prisma db seed"
  }
}
```

---

## ▶️ Rodando a API

```bash
# desenvolvimento
npm run dev

# produção
npm run build
npm start
```

Health check:
```bash
curl http://localhost:4000/health
# → { "ok": true }
```

---

## 📚 Endpoints (contratos)

### Produtos
**GET `/products/:id`**  
Retorna o produto:
```json
{ "id": "p1", "name": "...", "priceCents": 19900, "seller": "..." }
```

---

### PIX
**POST `/payments/pix`**  
Body:
```json
{
  "productId": "p1",
  "customer": {
    "name": "Seu Nome",
    "email": "email@exemplo.com",
    "cpf": "12345678901",
    "phone": "51999999999"
  }
}
```
Resposta (201):
```json
{
  "orderId": "...",
  "paymentId": "...",
  "txid": "...",
  "qrBase64": "data:image/png;base64,...",
  "copyPaste": "BR.GOV.BCB.PIX|txid=...|amount=...",
  "status": "PENDING"
}
```

**POST `/webhooks/pix/simulate`** (simulação)
```json
{ "txid": "<txid>", "status": "APPROVED" }  // ou "EXPIRED"
```
Resposta:
```json
{ "ok": true, "status": "APPROVED" }
```

---

### Cartão (mock)
**POST `/payments/card`**  
Body (cartão **tokenizado no front**; não enviar PAN/CVV):
```json
{
  "productId": "p1",
  "customer": {
    "name": "Seu Nome",
    "email": "email@exemplo.com",
    "cpf": "12345678901",
    "phone": "51999999999"
  },
  "token": "tok_opaco",
  "last4": "4242",
  "brand": "visa",
  "exp": "12/30",
  "holder": "Seu Nome",
  "jti": "uuid-aleatorio",
  "iat": 1730000000000,
  "expAt": 1730000600000
}
```
Resposta (201):
```json
{ "orderId": "...", "paymentId": "...", "status": "APPROVED", "reason": "OK" }
```

> Regras de antifraude mock: rejeita CPF inválido, ticket muito alto, e-mails descartáveis e `last4` suspeitos (`0000`/`1234`).  
> Anti-replay: `token` é **@unique**; `expAt` deve ser > `Date.now()`.

---

### Pedidos
**GET `/orders/:id/status`**  
```json
{ "status": "PENDING|APPROVED|DECLINED|EXPIRED" }
```

**GET `/orders/:id`**  
Detalhes seguros do pedido (produto, cliente, pagamentos – sem dados sensíveis).

---

## 🧪 Testes rápidos

### cURL (Unix)
```bash
# Produto
curl http://localhost:4000/products/p1

# PIX → criar
curl -X POST http://localhost:4000/payments/pix \
  -H "Content-Type: application/json" \
  -d '{"productId":"p1","customer":{"name":"Tester","email":"t@e.com","cpf":"12345678901","phone":"51999999999"}}'

# PIX → aprovar (use o txid da resposta acima)
curl -X POST http://localhost:4000/webhooks/pix/simulate \
  -H "Content-Type: application/json" \
  -d '{"txid":"<txid>","status":"APPROVED"}'

# Status do pedido
curl http://localhost:4000/orders/<orderId>/status

# Cartão (gera iat/expAt dinâmicos)
NOW=$(node -e "console.log(Date.now())"); EXP=$(node -e "console.log(Date.now()+120000)")
curl -X POST http://localhost:4000/payments/card \
  -H "Content-Type: application/json" \
  -d "{\"productId\":\"p1\",\"customer\":{\"name\":\"Tester\",\"email\":\"t@e.com\",\"cpf\":\"12345678901\",\"phone\":\"51999999999\"},\"token\":\"tok_$(uuidgen)\",\"last4\":\"4242\",\"brand\":\"visa\",\"exp\":\"12/30\",\"holder\":\"Tester\",\"jti\":\"jti_$(uuidgen)\",\"iat\":$NOW,\"expAt\":$EXP}"
```

### PowerShell (Windows)
```powershell
$now  = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$exp  = $now + 120000
$token = [guid]::NewGuid().ToString()
$jti   = [guid]::NewGuid().ToString()

$body = @{
  productId = "p1"
  customer  = @{ name="Tester"; email="t@e.com"; cpf="12345678901"; phone="51999999999" }
  token=$token; last4="4242"; brand="visa"; exp="12/30"; holder="Tester"
  jti=$jti; iat=$now; expAt=$exp
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:4000/payments/card" -ContentType "application/json" -Body $body
```

---

## 🔒 Decisões & Trade-offs

- **Tokenização no cliente**: backend **não** recebe PAN/CVV — apenas `token` opaco + metadados (`last4`, `brand`, `exp`, `holder`).  
- **Anti-replay**: `token` **@unique** + janela curta (`expAt`) + `jti`.  
- **PIX**: `txid` único, QR (data URL) e código copia-e-cola; webhook de simulação para **aprovar/expirar**.  
- **Validações** com **Zod** em todas as entradas.  
- **Segurança**: `helmet`, `cors` (origens configuráveis), **rate limit** em pagamentos, **redaction** em logs (`authorization`, `token`).  
- **Observabilidade**: `pino-http` com `requestId` por requisição.

---

## 🧭 Roadmap

- **Fulfillment**: acionar entrega (e-mail/licença) ao aprovar pagamento.
- **Expiração automática** de `PENDING` após X min (worker).
- **Assincronismo real**: filas para webhooks externos.
- **Testes automatizados**: Vitest + Supertest (fluxos PIX e Cartão).

---

## 🆘 Troubleshooting

- **`@prisma/client did not initialize yet`** → `npx prisma generate`.  
- **`undefined (reading 'create')`** → client desatualizado; `npm i -D prisma@latest && npm i @prisma/client@latest && npx prisma generate`.  
- **Seed não aparece no DBeaver** → verifique se DBeaver e `.env` usam **mesmo host/porta**.  
- **`token_expired`** no cartão → gere `iat/expAt` no momento do envio.  
- **`token_reused`** → gere `token/jti` novos a cada requisição.  

---
