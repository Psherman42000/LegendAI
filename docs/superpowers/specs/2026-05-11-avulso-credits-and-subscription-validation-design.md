# Avulso Credits + Subscription Validation — Design

## 1. Resumo

Completar o ciclo de pagamento para que o sistema aja após a confirmação do Mercado Pago:

- **Avulso (PIX/Cartão):** Usuário ganha 1 crédito de vídeo quando o pagamento é confirmado
- **Assinatura:** Usuário pode upar até N vídeos/mês conforme o plano ativo
- **UI:** Billing mostra créditos disponíveis + confirmação visual

## 2. Arquitetura

```
[Usuário paga] 
    ↓ 
[MP envia webhook → /api/billing/webhook/mercadopago]
    ↓
├── Se payment (avulso):
│   ├── Atualiza Payment p/ PAID
│   ├── Incrementa user.creditsAvailable += 1
│   └── Envia email de confirmação
│
├── Se preapproval (assinatura):
│   ├── Upsert Subscription p/ ACTIVE
│   └── Envia email de confirmação
│
[Usuário faz upload]
    ↓
[/api/videos]
    ├── Se AVULSO: consume 1 credit (creditsAvailable--)
    └── Se SUBSCRIPTION: verifica MonthlyUsage < plan.videosPerMonth

[UI — PIX]
    └── Enquanto QR code está visível: polling GET /api/billing/avulso/:id
        ├── PAID → exibe "Pagamento confirmado! +1 crédito"
        ├── FAILED → exibe erro
        └── PENDING → continua polling (a cada 5s, máximo 10 min)
```

## 3. Mudanças no Banco (Prisma)

### User — novo campo
```prisma
model User {
  // ...existing fields...
  creditsAvailable Int @default(0)  // créditos avulsos disponíveis
}
```

### Nada mais — o resto já existe

## 4. Webhook — mudanças

**Arquivo:** `src/app/api/billing/webhook/mercadopago/route.ts`

### Fluxo payment (avulso) — expandir
```typescript
// No bloco "if (topic === 'payment')", após atualizar Payment p/ PAID:
if (mpPaymentStatus === "approved") {
  // Incrementa crédito do usuário
  await prisma.user.update({
    where: { id: payment.userId },
    data: { creditsAvailable: { increment: 1 } },
  });
  // Email já existe
  await sendAvulsoReceiptEmail({ ... });
}
```

> **Decisão:** 1 pagamento = 1 crédito, independente do valor. Como tudo custa R$ 0,50, a conta é 1:1.

### Fluxo preapproval (assinatura) — já funciona, sem mudanças

## 5. Videos API — validação expandida

**Arquivo:** `src/app/api/videos/route.ts`

### Avulso — duas formas de pagar

```typescript
if (paymentType === "AVULSO") {
  if (body.paymentId) {
    // Fluxo existente: pagamento vinculado a um vídeo específico
    // ...
  } else {
    // Novo fluxo: consumir crédito
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user || user.creditsAvailable < 1) {
      return NextResponse.json(
        { ok: false, error: "Nenhum crédito avulso disponível. Compre um crédito no Billing." },
        { status: 402 }
      );
    }
    // Consome o crédito
    await prisma.user.update({
      where: { id: session.user.id },
      data: { creditsAvailable: { decrement: 1 } },
    });
  }
}
```

### Subscription — validação de cota mensal

```typescript
if (paymentType === "SUBSCRIPTION") {
  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });
  if (!sub || sub.status !== "ACTIVE") {
    return NextResponse.json(
      { ok: false, error: "Nenhuma assinatura ativa. Assine um plano no Billing." },
      { status: 402 }
    );
  }
  
  const plan = PLANS[sub.plan as PlanId];
  if (!plan) {
    return NextResponse.json({ ok: false, error: "Plano inválido" }, { status: 400 });
  }

  // Verifica ou cria MonthlyUsage do mês corrente
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  const usage = await prisma.monthlyUsage.findUnique({
    where: { userId_year_month: { userId: session.user.id, year, month } },
  });
  
  if (usage && usage.videosCount >= plan.videosPerMonth) {
    return NextResponse.json(
      { ok: false, error: `Limite mensal atingido (${plan.videosPerMonth} vídeos). Assine um plano superior ou use pagamento avulso.` },
      { status: 402 }
    );
  }
}
```

## 6. Billing Page — confirmação visual

**Arquivo:** `src/app/(dashboard)/billing/page.tsx` + `src/app/api/billing/portal/route.ts`

### Portal API — adicionar creditsAvailable

```typescript
const user = await prisma.user.findUnique({
  where: { id: session.user.id },
  select: { creditsAvailable: true },
});

return NextResponse.json({
  ok: true,
  data: { subscription, payments, creditsAvailable: user?.creditsAvailable ?? 0 },
});
```

### Billing Page — mostrar créditos

```
[Header: "Assinatura e billing"]
[CheckoutStatus: mensagem de sucesso se veio de redirect]
[PricingTable: planos + plano atual]

--- NOVA SEÇÃO: "Créditos Avulsos" ---
Se creditsAvailable > 0:
  "Você tem N crédito(s) avulso(s) disponíveis. Cada crédito permite enviar 1 vídeo."
Se creditsAvailable == 0:
  "Nenhum crédito avulso disponível. Compre um no painel abaixo."
--- FIM ---

[AvulsoCalculator: comprar crédito]
```

## 7. PIX Polling — AvulsoCalculator

**Arquivo:** `src/components/billing/AvulsoCalculator.tsx`

### Problema
PIX é pagamento assíncrono. Usuário paga no app do banco, mas a página não sabe que foi pago. Ao contrário do cartão (que redireciona de volta com `?payment=success`), o PIX não tem redirect.

### Solução: polling com 3 estados

```typescript
// Estados do PIX:
// ┌──────────┐    ┌──────────┐    ┌───────────┐
// │ PENDING  │ → │ CONFIRMED│ → │ (some da UI)│
// │ (QR code│    │          │    └───────────┘
// │  visível)│    └──────────┘
// │ polling  │    ┌──────────┐
// │  5s     │ → │ EXPIRED   │ → "Prazo expirado"
// └──────────┘    └──────────┘
```

### Implementação

1. **Avulso POST** retorna `paymentId` — AvulsoCalculator salva no state
2. **useEffect** quando `pixData` muda: inicia `setInterval` de 5s
3. A cada tick: `GET /api/billing/avulso/{paymentId}` → checa `data.status`
4. Se `PAID`: para polling, exibe "Pagamento confirmado! +1 crédito disponível", some após 5s
5. Se `FAILED`: para polling, exibe erro
6. Se `PENDING` mas `pixExpiration` passou: para polling, exibe "PIX expirado"
7. Timeout máximo de 10 minutos (120 ticks) — safety net

```typescript
useEffect(() => {
  if (!pixData || !paymentId) return;
  
  const interval = setInterval(async () => {
    const res = await fetch(`/api/billing/avulso/${paymentId}`);
    const json = await res.json();
    
    if (json.data?.mpStatus === "approved" || json.data?.status === "PAID") {
      clearInterval(interval);
      setPixStatus("confirmed");
      setPixData(null); // remove QR code após confirmação
      return;
    }
    
    if (json.data?.status === "FAILED" || json.data?.status === "REFUNDED") {
      clearInterval(interval);
      setPixStatus("failed");
      return;
    }
    
    // Check expiration
    if (pixData.pixExpiration && new Date(pixData.pixExpiration) < new Date()) {
      clearInterval(interval);
      setPixStatus("expired");
      return;
    }
  }, 5000);
  
  return () => clearInterval(interval);
}, [pixData, paymentId]);
```

### Estados visuais

| Status | O que mostra |
|--------|-------------|
| `pending` | QR code + "Aguardando pagamento..." + contagem regressiva |
| `confirmed` | ✅ "Pagamento confirmado! Você tem N créditos disponíveis." (auto-some 5s) |
| `failed` | ❌ "Pagamento recusado. Tente novamente." |
| `expired` | ⏰ "QR Code expirado. Gere um novo." |

## 7. Segurança

- **Webhook:** HMAC validation já existe, idempotency via WebhookLog já existe
- **Créditos:** Usar `{ increment: 1 }` / `{ decrement: 1 }` do Prisma — atômico, sem race conditions
- **MonthlyUsage:** `findUnique` + verificação antes de criar — pode ter race condition em upload simultâneo. Aceitável para MVP; se virar problema, usar transação Prisma com upsert condicional

## 9. Rollout

1. Rodar `prisma migrate dev` para adicionar `creditsAvailable` ao User
2. Alterar webhook — incrementar crédito
3. Alterar videos API — consumir crédito + validar assinatura
4. Alterar portal API — retornar creditsAvailable
5. Alterar billing page — mostrar créditos e créditos disponíveis
6. Adicionar polling no AvulsoCalculator para PIX

## 10. Fora de Escopo (YAGNI)

- Histórico de transações de crédito (audit trail) — email notification já serve
- Créditos expirarem — R$ 0,50, sem necessidade
- Créditos para assinantes — assinatura usa cota mensal, não crédito
- Cancelamento/refund — simples: só não criar o crédito se não confirmar
