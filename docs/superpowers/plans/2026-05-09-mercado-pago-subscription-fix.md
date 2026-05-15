# Correção do Fluxo de Pagamento e Assinaturas — Mercado Pago

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o fluxo de pagamento para que funcione corretamente em produção: checkout via Mercado Pago, webhook confirmando pagamento, e assinatura ativada apenas após confirmação.

**Architecture:** Fluxo de assinatura em 2 etapas: (1) Frontend chama `/api/billing/checkout` → backend cria PreApproval no MP → retorna `init_point` → frontend redireciona o usuário para a tela de pagamento do MP. (2) MP envia webhook → backend verifica com API do MP → ativa a assinatura no banco. O plano FREE não passa por checkout.

**Tech Stack:** Next.js App Router, Prisma (PostgreSQL), Mercado Pago SDK v2 (`mercadopago`), NextAuth, TypeScript.

---

## Contexto do Problema

### Sintomas
- Clicar em "Assinar agora" ativa o plano instantaneamente sem pagamento
- Nunca redireciona para a tela de pagamento do Mercado Pago
- Pagamento "sempre aprovado"

### Root Causes
1. **PlanCard chama endpoint mock** (`/api/subscription`) ao invés do real (`/api/billing/checkout`)
2. **Subscription criada ANTES do pagamento** — tanto no mock quanto no endpoint real
3. **STARTER e PRO sem `mpPlanId`** no `.env` — `criarAssinatura` retorna fallback local
4. **Webhook não verifica com API do MP** — aceita payload sem confirmação
5. **Webhook marca `PAID` cegamente** — ignora status real do MP
6. **`MP_WEBHOOK_SECRET` vazio** — validação HMAC comprometida
7. **Credenciais sandbox** — `APP_USR` prefix, pagamentos auto-aprovados
8. **Endpoints mock ativos** — `/api/subscription`, `/api/payment/pix`, `/api/payment/card`
9. **PCI-DSS violation** — `CardPayment.tsx` coleta dados de cartão raw

### Fluxo Correto (Produção)
```
Usuário clica "Assinar"
  → POST /api/billing/checkout { planId }
  → Backend cria PreApproval no MP (NÃO cria subscription no banco)
  → Retorna init_point
  → Frontend redireciona para init_point (tela de pagamento MP)
  → Usuário paga no MP
  → MP redireciona para /billing?status=success
  → MP envia webhook POST /api/billing/webhook/mercadopago
  → Webhook valida HMAC → consulta API MP → cria/atualiza Subscription
  → Usuário vê plano atualizado
```

---

## Fase 1: Criar Planos no Mercado Pago

### Task 1.1: Criar PreApprovalPlans no Dashboard do MP (Sandbox)

**Ação manual no dashboard do Mercado Pago.**

- [ ] **Step 1: Acessar o dashboard de sandbox**

Ir em: https://www.mercadopago.com.br/developers/panel/sandbox (logado com conta de teste)

- [ ] **Step 2: Criar plano STARTER**

Usar a API diretamente (o dashboard não tem UI para PreApprovalPlans). Executar no terminal:

```bash
curl -X POST https://api.mercadopago.com/preapproval_plan \
  -H "Authorization: Bearer APP_USR-3242057579362221-042315-a95da62ee39be36e0941c83b2014d890-3356347782" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "LegendAI — Plano Starter",
    "back_url": "http://localhost:3000/billing",
    "external_reference": "plan-STARTER",
    "auto_recurring": {
      "frequency": 1,
      "frequency_type": "months",
      "transaction_amount": 29.90,
      "currency_id": "BRL"
    },
    "payment_methods_allowed": {
      "payment_types": [{}],
      "payment_methods": [{}]
    }
  }'
```

Guardar o `id` retornado (ex: `"2c938084726fca480172750000000000"`).

- [ ] **Step 3: Criar plano PRO**

```bash
curl -X POST https://api.mercadopago.com/preapproval_plan \
  -H "Authorization: Bearer APP_USR-3242057579362221-042315-a95da62ee39be36e0941c83b2014d890-3356347782" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "LegendAI — Plano Pro",
    "back_url": "http://localhost:3000/billing",
    "external_reference": "plan-PRO",
    "auto_recurring": {
      "frequency": 1,
      "frequency_type": "months",
      "transaction_amount": 59.90,
      "currency_id": "BRL"
    },
    "payment_methods_allowed": {
      "payment_types": [{}],
      "payment_methods": [{}]
    }
  }'
```

Guardar o `id` retornado.

- [ ] **Step 4: Verificar plano UNLIMITED existente**

O plano UNLIMITED já tem ID `752c4f04aa3742b88acf0514af886359`. Verificar se o preço está correto (R$99,90/mês):

```bash
curl -s https://api.mercadopago.com/preapproval_plan/752c4f04aa3742b88acf0514af886359 \
  -H "Authorization: Bearer APP_USR-3242057579362221-042315-a95da62ee39be36e0941c83b2014d890-3356347782" | jq '.auto_recurring.transaction_amount'
```

Se o preço estiver errado, atualizar:

```bash
curl -X PUT https://api.mercadopago.com/preapproval_plan/752c4f04aa3742b88acf0514af886359 \
  -H "Authorization: Bearer APP_USR-3242057579362221-042315-a95da62ee39be36e0941c83b2014d890-3356347782" \
  -H "Content-Type: application/json" \
  -d '{
    "auto_recurring": {
      "frequency": 1,
      "frequency_type": "months",
      "transaction_amount": 99.90,
      "currency_id": "BRL"
    }
  }'
```

- [ ] **Step 5: Atualizar `.env` com os IDs dos planos**

Substituir os valores vazios pelos IDs retornados:

```env
MP_PLAN_STARTER_ID="<id-do-plano-starter-retornado>"
MP_PLAN_PRO_ID="<id-do-plano-pro-retornado>"
MP_PLAN_UNLIMITED_ID="752c4f04aa3742b88acf0514af886359"
```

- [ ] **Step 6: Configurar Webhook no Dashboard do MP**

1. Ir em: https://www.mercadopago.com.br/developers/panel/webhooks
2. Adicionar URL: `https://SEU-DOMINIO.com/api/billing/webhook/mercadopago` (em produção) ou usar ngrok para testes locais
3. Ativar os tópicos: `payment`, `subscription_preapproval`, `subscription_authorized_payment`
4. Copiar o `secret` gerado e colocar em `MP_WEBHOOK_SECRET` no `.env`

---

## Fase 2: Corrigir o Fluxo de Checkout

### Task 2.1: Trocar PlanCard para usar endpoint real

**Files:**
- Modify: `src/components/plans/PlanCard.tsx`

- [ ] **Step 1: Alterar o endpoint de `/api/subscription` para `/api/billing/checkout`**

Em `src/components/plans/PlanCard.tsx`, linha 39, trocar:

```typescript
// ANTES:
const res = await fetch("/api/subscription", {

// DEPOIS:
const res = await fetch("/api/billing/checkout", {
```

- [ ] **Step 2: Adicionar tratamento para plano FREE (sem checkout)**

O plano FREE não precisa de checkout no MP. Adicionar lógica antes do fetch:

```typescript
async function handleSubscribe() {
  if (isCurrentPlan) return;

  // Plano FREE não precisa de checkout — ativa diretamente
  if (plan.price === 0) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao ativar plano grátis");
        return;
      }
      // Para FREE, o backend retorna a billing page diretamente
      if (json.data?.initPoint) {
        window.location.href = json.data.initPoint;
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
    return;
  }

  setIsLoading(true);
  setError(null);

  try {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Erro ao processar assinatura");
      return;
    }

    if (json.ok && json.data?.initPoint) {
      window.location.href = json.data.initPoint;
    } else {
      setError("Resposta inesperada do servidor");
    }
  } catch {
    setError("Erro de conexão. Tente novamente.");
  } finally {
    setIsLoading(false);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/plans/PlanCard.tsx
git commit -m "fix: PlanCard calls /api/billing/checkout instead of mock /api/subscription"
```

### Task 2.2: Corrigir endpoint de checkout — não criar subscription antes do pagamento

**Files:**
- Modify: `src/app/api/billing/checkout/route.ts`

- [ ] **Step 1: Reescrever o endpoint para NÃO criar subscription antes do pagamento**

O endpoint deve apenas criar o PreApproval no MP e retornar o `init_point`. A subscription será criada pelo webhook quando o pagamento for confirmado.

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { criarAssinatura } from "@/lib/mercadopago";
import type { PlanId } from "@/lib/plans";
import { PLANS } from "@/lib/plans";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as { planId: PlanId };
  const plan = PLANS[body.planId];

  if (!plan) {
    return NextResponse.json({ ok: false, error: "Plano inválido" }, { status: 400 });
  }

  // Plano FREE não precisa de checkout no MP
  if (plan.price === 0) {
    return NextResponse.json({
      ok: true,
      data: {
        initPoint: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/billing?status=free`,
        planId: body.planId,
      },
    });
  }

  // Plano sem mpPlanId configurado — erro de configuração
  if (!plan.mpPlanId) {
    console.error(`[checkout] Plano ${body.planId} sem mpPlanId configurado no .env`);
    return NextResponse.json(
      { ok: false, error: "Plano indisponível no momento. Tente novamente mais tarde." },
      { status: 503 },
    );
  }

  try {
    const result = await criarAssinatura({
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name ?? "Usuário",
      planId: body.planId,
      backUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/billing`,
    });

    // NÃO criar subscription no banco aqui — será criada pelo webhook
    // Apenas retornar o init_point para redirecionamento
    return NextResponse.json({
      ok: true,
      data: {
        initPoint: result.initPoint,
        planId: body.planId,
      },
    });
  } catch (error) {
    console.error("[checkout] Erro ao criar assinatura no MP:", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao processar pagamento. Tente novamente." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/billing/checkout/route.ts
git commit -m "fix: checkout endpoint no longer creates subscription before payment"
```

### Task 2.3: Corrigir `criarAssinatura` para não retornar fallback local

**Files:**
- Modify: `src/lib/mercadopago.ts`

- [ ] **Step 1: Remover o fallback local e adicionar error handling**

```typescript
export async function criarAssinatura(data: {
  userId: string;
  userEmail: string;
  userName: string;
  planId: PlanId;
  backUrl: string;
}): Promise<{ initPoint: string; subscriptionId: string }> {
  const plan = PLANS[data.planId];

  if (!plan.mpPlanId) {
    // Não deveria chegar aqui — o checkout route já valida isso
    throw new Error(`Plano ${data.planId} não tem mpPlanId configurado`);
  }

  try {
    const preapproval = await preApprovalClient.create({
      body: {
        preapproval_plan_id: plan.mpPlanId,
        payer_email: data.userEmail,
        back_url: data.backUrl,
        external_reference: `${data.userId}:${data.planId}`,
      },
    });

    const initPoint = preapproval.init_point;
    const subscriptionId = String(preapproval.id);

    if (!initPoint) {
      throw new Error("Mercado Pago não retornou init_point");
    }

    return { initPoint, subscriptionId };
  } catch (error) {
    console.error("[criarAssinatura] Erro ao criar PreApproval:", error);
    throw error;
  }
}
```

Nota: `external_reference` agora inclui `userId:planId` para que o webhook possa identificar qual plano o usuário estava tentando assinar.

- [ ] **Step 2: Adicionar error handling nas outras funções**

```typescript
export async function cancelarAssinatura(mpSubscriptionId: string): Promise<void> {
  if (!mpSubscriptionId || !accessToken) {
    console.warn("[cancelarAssinatura] ID vazio ou access token não configurado");
    return;
  }

  try {
    await preApprovalClient.update({
      id: mpSubscriptionId,
      body: { status: "cancelled" },
    });
  } catch (error) {
    console.error("[cancelarAssinatura] Erro ao cancelar assinatura:", error);
    throw error;
  }
}

export async function criarPagamentoAvulso(data: {
  userId: string;
  userEmail: string;
  userName: string;
  paymentId: string;
  durationSeconds: number;
  method: "PIX" | "CARD";
  notificationUrl: string;
}): Promise<{
  preferenceId: string;
  initPoint: string;
  pixQrCode?: string;
  pixQrCodeText?: string;
  pixExpiration?: string;
}> {
  const { priceInCentavos } = calcularPrecoAvulso(data.durationSeconds);
  const amount = priceInCentavos / 100;

  try {
    if (data.method === "PIX") {
      const payment = await paymentClient.create({
        body: {
          transaction_amount: amount,
          description: `LegendAI — vídeo avulso (${Math.ceil(data.durationSeconds / 60)} min)`,
          payment_method_id: "pix",
          payer: {
            email: data.userEmail,
            first_name: data.userName.split(" ")[0] ?? data.userName,
          },
          external_reference: data.paymentId,
          notification_url: data.notificationUrl,
          date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
      });

      return {
        preferenceId: String(payment.id ?? data.paymentId),
        initPoint: "",
        pixQrCode: payment.point_of_interaction?.transaction_data?.qr_code_base64 ?? undefined,
        pixQrCodeText: payment.point_of_interaction?.transaction_data?.qr_code ?? undefined,
        pixExpiration: payment.date_of_expiration ?? undefined,
      };
    }

    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: data.paymentId,
            title: `LegendAI — vídeo avulso (${Math.ceil(data.durationSeconds / 60)} min)`,
            quantity: 1,
            unit_price: amount,
            currency_id: "BRL",
          },
        ],
        payer: {
          email: data.userEmail,
        },
        external_reference: data.paymentId,
        notification_url: data.notificationUrl,
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard?payment=success`,
          failure: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/billing?payment=failed`,
          pending: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/billing?payment=pending`,
        },
        auto_return: "approved",
      },
    });

    return {
      preferenceId: String(preference.id ?? data.paymentId),
      initPoint: preference.init_point ?? "",
    };
  } catch (error) {
    console.error("[criarPagamentoAvulso] Erro:", error);
    throw error;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/mercadopago.ts
git commit -m "fix: remove local fallback from criarAssinatura, add error handling"
```

---

## Fase 3: Corrigir o Webhook Handler

### Task 3.1: Reescrever webhook com verificação MP e mapeamento de status correto

**Files:**
- Modify: `src/app/api/billing/webhook/mercadopago/route.ts`

- [ ] **Step 1: Reescrever o webhook handler completo**

```typescript
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { consultarPagamento, consultarAssinatura } from "@/lib/mercadopago";
import { sendWebhookNotification } from "@/lib/email";
import type { PlanId } from "@/lib/plans";

function validarAssinaturaMP(request: Request): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  // Em desenvolvimento, permitir sem secret (logar aviso)
  if (!secret) {
    console.warn("[webhook] MP_WEBHOOK_SECRET não configurado — pulando validação de assinatura");
    return true;
  }

  const xSignature = request.headers.get("x-signature") ?? "";
  const xRequestId = request.headers.get("x-request-id") ?? "";
  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id") ?? "";

  const parts = xSignature.split(",");
  const ts = parts.find((part) => part.startsWith("ts="))?.split("=")[1];
  const v1 = parts.find((part) => part.startsWith("v1="))?.split("=")[1];
  if (!ts || !v1) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  return hmac === v1;
}

// Mapear status do MP para status interno
function mapPaymentStatus(mpStatus: string): "PENDING" | "PAID" | "FAILED" | "REFUNDED" {
  const statusMap: Record<string, "PENDING" | "PAID" | "FAILED" | "REFUNDED"> = {
    pending: "PENDING",
    in_process: "PENDING",
    approved: "PAID",
    authorized: "PAID",
    rejected: "FAILED",
    cancelled: "FAILED",
    refunded: "REFUNDED",
    charged_back: "REFUNDED",
  };
  return statusMap[mpStatus] ?? "PENDING";
}

export async function POST(request: Request) {
  // 1. Validar assinatura HMAC
  if (!validarAssinaturaMP(request)) {
    return NextResponse.json({ ok: false, error: "Assinatura inválida" }, { status: 401 });
  }

  // 2. Parse do payload
  let payload: {
    type?: string;
    topic?: string;
    data?: { id?: string };
    action?: string;
    live_mode?: boolean;
  };

  try {
    const rawBody = await request.text();
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 });
  }

  const topic = payload.topic ?? payload.type ?? "";
  const notificationId = payload.data?.id;

  console.log(`[webhook] Recebido: topic=${topic}, id=${notificationId}, live_mode=${payload.live_mode}`);

  if (!notificationId) {
    return NextResponse.json(
      { ok: false, error: "payload.data.id is required for idempotency" },
      { status: 400 },
    );
  }

  // 3. Idempotency check
  try {
    await prisma.webhookLog.create({
      data: {
        provider: "mercadopago",
        topic,
        notificationId,
        payload: payload as object,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      console.log(`[webhook] Notificação duplicada: ${topic}/${notificationId}`);
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw error;
  }

  // 4. Processar por tipo de notificação
  try {
    switch (topic) {
      case "payment": {
        await handlePaymentNotification(notificationId);
        break;
      }
      case "preapproval": {
        await handlePreapprovalNotification(notificationId);
        break;
      }
      case "subscription_authorized_payment": {
        await handleAuthorizedPaymentNotification(notificationId);
        break;
      }
      default: {
        console.log(`[webhook] Tipo desconhecido: ${topic}`);
      }
    }
  } catch (error) {
    console.error(`[webhook] Erro ao processar ${topic}/${notificationId}:`, error);
    // Retornar 200 para o MP não ficar reenviando, mas logar o erro
  }

  return NextResponse.json({ ok: true });
}

// === Handlers ===

async function handlePaymentNotification(mpPaymentId: string) {
  // Verificar com a API do MP
  let mpPayment: Awaited<ReturnType<typeof consultarPagamento>>;
  try {
    mpPayment = await consultarPagamento(mpPaymentId);
  } catch (error) {
    console.error(`[webhook] Erro ao consultar pagamento ${mpPaymentId}:`, error);
    return;
  }

  const mpStatus = String(mpPayment.status);
  const internalStatus = mapPaymentStatus(mpStatus);

  console.log(`[webhook] Pagamento ${mpPaymentId}: MP status=${mpStatus}, interno=${internalStatus}`);

  const payment = await prisma.payment.findFirst({
    where: { mpPaymentId: mpPaymentId },
  });

  if (!payment) {
    console.warn(`[webhook] Pagamento ${mpPaymentId} não encontrado no banco`);
    return;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: internalStatus,
      mpStatus: mpStatus,
      ...(internalStatus === "PAID" ? { paidAt: new Date() } : {}),
    },
  });

  if (internalStatus === "PAID") {
    await sendWebhookNotification(`Pagamento avulso ${payment.id} aprovado.`);
  }
}

async function handlePreapprovalNotification(preapprovalId: string) {
  // Verificar com a API do MP
  let mpSubscription: Awaited<ReturnType<typeof consultarAssinatura>>;
  try {
    mpSubscription = await consultarAssinatura(preapprovalId);
  } catch (error) {
    console.error(`[webhook] Erro ao consultar assinatura ${preapprovalId}:`, error);
    return;
  }

  const mpStatus = String(mpSubscription.status);
  console.log(`[webhook] PreApproval ${preapprovalId}: status=${mpStatus}`);

  // Extrair userId e planId do external_reference (formato: "userId:planId")
  const externalRef = String(mpSubscription.external_reference ?? "");
  const [userId, planId] = externalRef.split(":") as [string, string | undefined];

  if (!userId) {
    console.error(`[webhook] PreApproval ${preapprovalId} sem external_reference`);
    return;
  }

  // Buscar subscription existente ou criar
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (mpStatus === "authorized" || mpStatus === "active") {
    // Assinatura autorizada — criar ou atualizar
    const planIdToSet: PlanId = (planId && ["STARTER", "PRO", "UNLIMITED"].includes(planId))
      ? (planId as PlanId)
      : (existingSubscription?.plan ?? "FREE");

    // Calcular período atual a partir dos dados do MP
    const currentPeriodEnd = mpSubscription.auto_recurring?.end_date
      ? new Date(mpSubscription.auto_recurring.end_date)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const currentPeriodStart = mpSubscription.auto_recurring?.start_date
      ? new Date(mpSubscription.auto_recurring.start_date)
      : new Date();

    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: planIdToSet,
        mpSubscriptionId: preapprovalId,
        mpPreapprovalPlanId: String(mpSubscription.preapproval_plan_id ?? ""),
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
      },
      update: {
        plan: planIdToSet,
        mpSubscriptionId: preapprovalId,
        mpPreapprovalPlanId: String(mpSubscription.preapproval_plan_id ?? ""),
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
      },
    });

    await sendWebhookNotification(
      `Assinatura autorizada: usuário ${userId}, plano ${planIdToSet}, MP ID ${preapprovalId}`,
    );
  } else if (mpStatus === "cancelled") {
    // Assinatura cancelada
    if (existingSubscription) {
      await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          plan: "FREE",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: new Date(),
        },
      });
    }
    await sendWebhookNotification(
      `Assinatura cancelada: usuário ${userId}, MP ID ${preapprovalId}`,
    );
  } else if (mpStatus === "paused") {
    if (existingSubscription) {
      await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: { cancelAtPeriodEnd: true },
      });
    }
  }
}

async function handleAuthorizedPaymentNotification(paymentId: string) {
  // Pagamento recorrente autorizado (cobrança mensal automática)
  console.log(`[webhook] Pagamento recorrente autorizado: ${paymentId}`);

  // Verificar com MP
  let mpPayment: Awaited<ReturnType<typeof consultarPagamento>>;
  try {
    mpPayment = await consultarPagamento(paymentId);
  } catch (error) {
    console.error(`[webhook] Erro ao consultar pagamento autorizado ${paymentId}:`, error);
    return;
  }

  const mpStatus = String(mpPayment.status);
  const internalStatus = mapPaymentStatus(mpStatus);

  // Se aprovado, estender o período da assinatura
  if (internalStatus === "PAID") {
    const externalRef = String(mpPayment.external_reference ?? "");
    const [userId] = externalRef.split(":");

    if (userId) {
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
      });

      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            currentPeriodStart: new Date(),
          },
        });
      }
    }
  }

  await sendWebhookNotification(
    `Pagamento recorrente processado: ${paymentId}, status=${mpStatus}`,
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/billing/webhook/mercadopago/route.ts
git commit -m "fix: webhook verifies with MP API, maps statuses correctly, handles preapproval lifecycle"
```

---

## Fase 4: Remover Endpoints Mock e Componentes Inseguros

### Task 4.1: Remover endpoint mock `/api/subscription`

**Files:**
- Delete: `src/app/api/subscription/route.ts`

- [ ] **Step 1: Deletar o arquivo**

```bash
rm src/app/api/subscription/route.ts
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove mock /api/subscription endpoint"
```

### Task 4.2: Remover endpoints mock de pagamento `/api/payment/pix` e `/api/payment/card`

**Files:**
- Delete: `src/app/api/payment/pix/route.ts`
- Delete: `src/app/api/payment/card/route.ts`

- [ ] **Step 1: Deletar os arquivos**

```bash
rm src/app/api/payment/pix/route.ts
rm src/app/api/payment/card/route.ts
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove mock payment endpoints (pix/card)"
```

### Task 4.3: Remover componente CardPayment (PCI-DSS violation)

**Files:**
- Delete: `src/components/payment/CardPayment.tsx`
- Delete: `src/components/payment/PixPayment.tsx` (se for mock)
- Modify: qualquer componente que importe CardPayment ou PixPayment

- [ ] **Step 1: Verificar imports de CardPayment e PixPayment**

Buscar por imports desses componentes no codebase e remover/ajustar.

- [ ] **Step 2: Deletar os componentes mock**

```bash
rm src/components/payment/CardPayment.tsx
rm src/components/payment/PixPayment.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove mock payment components (PCI-DSS violation)"
```

---

## Fase 5: Adicionar Validação e Tratamento de Retorno

### Task 5.1: Adicionar validação de env vars no startup

**Files:**
- Modify: `src/lib/mercadopago.ts`

- [ ] **Step 1: Adicionar validação no topo do arquivo**

```typescript
// Validação de configuração
function validateConfig() {
  const errors: string[] = [];

  if (!process.env.MP_ACCESS_TOKEN) {
    errors.push("MP_ACCESS_TOKEN não configurado");
  }

  if (process.env.NODE_ENV === "production") {
    if (!process.env.MP_WEBHOOK_SECRET) {
      errors.push("MP_WEBHOOK_SECRET não configurado (obrigatório em produção)");
    }
    // Verificar se todos os planos têm mpPlanId
    for (const plan of Object.values(PLANS)) {
      if (plan.price > 0 && !plan.mpPlanId) {
        errors.push(`Plano ${plan.id} sem MP_PLAN_ID configurado`);
      }
    }
  }

  if (errors.length > 0) {
    console.error("[mercadopago] Erros de configuração:", errors);
  }

  return errors;
}

const configErrors = validateConfig();
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/mercadopago.ts
git commit -m "feat: add MP config validation on startup"
```

### Task 5.2: Adicionar tratamento de retorno na página `/billing`

**Files:**
- Modify: `src/app/(dashboard)/billing/page.tsx`

- [ ] **Step 1: Adicionar componente de status de pagamento**

Criar `src/components/billing/CheckoutStatus.tsx`:

```typescript
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function CheckoutStatus() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<"success" | "error" | "info" | null>(null);

  useEffect(() => {
    const status = searchParams.get("status");
    const checkout = searchParams.get("checkout");

    if (status === "free") {
      setMessage("Plano grátis ativado com sucesso!");
      setType("success");
    } else if (checkout === "success" || status === "approved") {
      setMessage("Pagamento aprovado! Seu plano será atualizado em instantes.");
      setType("success");
    } else if (checkout === "failed" || status === "rejected") {
      setMessage("Pagamento recusado. Tente novamente.");
      setType("error");
    } else if (checkout === "pending" || status === "pending" || status === "in_process") {
      setMessage("Pagamento pendente. Você será notificado quando for confirmado.");
      setType("info");
    }
  }, [searchParams]);

  if (!message) return null;

  const colors = {
    success: "bg-green-900/50 text-green-300 border-green-700",
    error: "bg-red-900/50 text-red-300 border-red-700",
    info: "bg-blue-900/50 text-blue-300 border-blue-700",
  };

  return (
    <div className={`rounded-lg border p-4 ${type ? colors[type] : ""}`}>
      <p className="text-sm">{message}</p>
    </div>
  );
}
```

- [ ] **Step 2: Usar o componente na página de billing**

Modificar `src/app/(dashboard)/billing/page.tsx`:

```typescript
import { PricingTable } from "@/components/billing/PricingTable";
import { AvulsoCalculator } from "@/components/billing/AvulsoCalculator";
import { CheckoutStatus } from "@/components/billing/CheckoutStatus";
import { Suspense } from "react";

export default function BillingPage() {
  return (
    <main className="space-y-8 p-6 lg:p-10">
      <header className="space-y-3">
        <h1 className="text-display text-3xl font-bold">Assinatura e billing</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Escolha um plano ou faça uma compra avulsa para este vídeo.
        </p>
      </header>
      <Suspense>
        <CheckoutStatus />
      </Suspense>
      <PricingTable />
      <AvulsoCalculator durationSeconds={300} />
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/billing/CheckoutStatus.tsx src/app/\(dashboard\)/billing/page.tsx
git commit -m "feat: add checkout status banner on billing page"
```

---

## Fase 6: Schema — Adicionar `status` à Subscription

### Task 6.1: Adicionar campo `status` ao modelo Subscription

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar enum `SubscriptionStatus` e campo `status` ao modelo**

```prisma
enum SubscriptionStatus {
  PENDING
  ACTIVE
  CANCELLED
  PAUSED
}

model Subscription {
  id                   String             @id @default(cuid())
  userId               String             @unique
  plan                 PlanType           @default(FREE)
  status               SubscriptionStatus @default(PENDING)
  mpCustomerId         String?            @unique
  mpSubscriptionId     String?            @unique
  mpPreapprovalPlanId  String?
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean            @default(false)
  cancelledAt          DateTime?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("subscriptions")
}
```

- [ ] **Step 2: Gerar e aplicar migration**

```bash
npx prisma migrate dev --name add_subscription_status
```

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add SubscriptionStatus enum and status/cancelledAt fields"
```

### Task 6.2: Atualizar uso de `usePlan` para considerar `status`

**Files:**
- Modify: `src/app/api/user/usage/route.ts`
- Modify: `src/hooks/usePlan.ts` (se necessário)

- [ ] **Step 1: Atualizar a query de usage para filtrar por `status = ACTIVE`**

No endpoint `/api/user/usage`, ao buscar a subscription, verificar se `status === "ACTIVE"`:

```typescript
const subscription = await prisma.subscription.findUnique({
  where: { userId: session.user.id },
});

// Se a assinatura não estiver ativa, tratar como FREE
const effectivePlan: PlanId = subscription?.status === "ACTIVE" ? subscription.plan : "FREE";
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/user/usage/route.ts
git commit -m "feat: consider subscription status when determining effective plan"
```

---

## Fase 7: Produção — Trocar Credenciais e Configurar

### Task 7.1: Checklist de produção (ação manual)

- [ ] **Step 1: Obter credenciais de produção no MP Dashboard**

1. Ir em https://www.mercadopago.com.br/developers/panel
2. Selecionar a aplicação → Credenciais de produção
3. Copiar `ACCESS_TOKEN` de produção (prefixo diferente de `APP_USR`)
4. Copiar `PUBLIC_KEY` de produção

- [ ] **Step 2: Criar PreApprovalPlans em produção**

Repetir os curls da Task 1.1, mas com o `ACCESS_TOKEN` de produção e URLs reais:

```bash
# STARTER
curl -X POST https://api.mercadopago.com/preapproval_plan \
  -H "Authorization: Bearer <PRODUCTION_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "LegendAI — Plano Starter",
    "back_url": "https://legendai.com.br/billing",
    "external_reference": "plan-STARTER",
    "auto_recurring": {
      "frequency": 1,
      "frequency_type": "months",
      "transaction_amount": 29.90,
      "currency_id": "BRL"
    },
    "payment_methods_allowed": {
      "payment_types": [{}],
      "payment_methods": [{}]
    }
  }'

# PRO
curl -X POST https://api.mercadopago.com/preapproval_plan \
  -H "Authorization: Bearer <PRODUCTION_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "LegendAI — Plano Pro",
    "back_url": "https://legendai.com.br/billing",
    "external_reference": "plan-PRO",
    "auto_recurring": {
      "frequency": 1,
      "frequency_type": "months",
      "transaction_amount": 59.90,
      "currency_id": "BRL"
    },
    "payment_methods_allowed": {
      "payment_types": [{}],
      "payment_methods": [{}]
    }
  }'

# UNLIMITED (criar novo se necessário)
curl -X POST https://api.mercadopago.com/preapproval_plan \
  -H "Authorization: Bearer <PRODUCTION_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "LegendAI — Plano Ilimitado",
    "back_url": "https://legendai.com.br/billing",
    "external_reference": "plan-UNLIMITED",
    "auto_recurring": {
      "frequency": 1,
      "frequency_type": "months",
      "transaction_amount": 99.90,
      "currency_id": "BRL"
    },
    "payment_methods_allowed": {
      "payment_types": [{}],
      "payment_methods": [{}]
    }
  }'
```

- [ ] **Step 3: Configurar variáveis de ambiente em produção**

No deploy (Vercel/Railway/etc.), configurar:

```env
MP_ACCESS_TOKEN="<production-token>"
MP_PUBLIC_KEY="<production-public-key>"
NEXT_PUBLIC_MP_PUBLIC_KEY="<production-public-key>"
MP_WEBHOOK_SECRET="<secret-from-dashboard>"
MP_PLAN_STARTER_ID="<production-starter-plan-id>"
MP_PLAN_PRO_ID="<production-pro-plan-id>"
MP_PLAN_UNLIMITED_ID="<production-unlimited-plan-id>"
NEXT_PUBLIC_APP_URL="https://legendai.com.br"
```

- [ ] **Step 4: Configurar HTTPS e domínio**

O webhook URL precisa ser HTTPS. Configurar no MP Dashboard:
- URL: `https://legendai.com.br/api/billing/webhook/mercadopago`
- Tópicos: `payment`, `subscription_preapproval`, `subscription_authorized_payment`

- [ ] **Step 5: Testar com o simulador de webhook do MP**

1. Ir em https://www.mercadopago.com.br/developers/panel/webhooks
2. Usar o simulador para enviar notificações de teste
3. Verificar se o endpoint responde 200 e processa corretamente

---

## Fase 8: Testes End-to-End

### Task 8.1: Testar fluxo completo em sandbox

- [ ] **Step 1: Testar plano FREE**

1. Fazer login
2. Ir para `/plans`
3. Clicar em "Começar grátis"
4. Verificar: redireciona para `/billing?status=free`
5. Verificar: plano atualizado para FREE no banco

- [ ] **Step 2: Testar plano STARTER (sandbox)**

1. Fazer login com conta de teste do MP
2. Ir para `/plans`
3. Clicar em "Assinar agora" no STARTER
4. Verificar: redireciona para a tela de checkout do MP
5. Completar o pagamento com credenciais de teste
6. Verificar: redireciona de volta para `/billing`
7. Verificar: webhook recebido e processado
8. Verificar: plano atualizado para STARTER no banco

- [ ] **Step 3: Testar webhook com simulador**

1. Enviar notificação `preapproval` com status `authorized`
2. Verificar: subscription criada com `status = ACTIVE`
3. Enviar notificação `preapproval` com status `cancelled`
4. Verificar: subscription atualizada para `plan = FREE`, `status = CANCELLED`

- [ ] **Step 4: Testar pagamento avulso (PIX)**

1. Ir para `/billing`
2. Usar o calculador avulso
3. Selecionar PIX
4. Verificar: QR code gerado
5. Simular pagamento via webhook
6. Verificar: payment atualizado para PAID

---

## Ordem de Execução Recomendada

1. **Fase 1** (Task 1.1) — Criar planos no MP sandbox e configurar `.env`
2. **Fase 6** (Tasks 6.1-6.2) — Schema migration (precisa rodar antes do deploy)
3. **Fase 2** (Tasks 2.1-2.3) — Corrigir fluxo de checkout
4. **Fase 3** (Task 3.1) — Corrigir webhook handler
5. **Fase 4** (Tasks 4.1-4.3) — Remover mocks
6. **Fase 5** (Tasks 5.1-5.2) — Validação e UI de retorno
7. **Fase 8** (Task 8.1) — Testes end-to-end em sandbox
8. **Fase 7** (Task 7.1) — Produção (após testes passarem)

---

## Notas Importantes

- **Preços em centavos no `plans.ts`**: STARTER=2900 (R$29,00), PRO=5900 (R$59,00), UNLIMITED=9900 (R$99,00). No MP, os valores são em reais: 29.90, 59.90, 99.90. **Verificar se os preços no MP batem com os do `plans.ts`.**
- **`external_reference`**: Agora usa o formato `userId:planId` para que o webhook saiba qual plano ativar.
- **Webhook em sandbox**: O MP não envia webhooks reais em sandbox. Usar o simulador do dashboard para testar.
- **`MP_WEBHOOK_SECRET` vazio**: Em desenvolvimento, o webhook permite requisições sem assinatura (com aviso). Em produção, é obrigatório.
- **Plano FREE**: Não passa por checkout — o backend retorna a URL de billing diretamente.