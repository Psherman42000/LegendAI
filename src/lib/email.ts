import { Resend } from "resend";
import { absoluteUrl } from "./utils";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }

  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }

  return resend;
}

function baseTemplate(title: string, body: string): string {
  return `<!doctype html>
  <html lang="pt-BR">
    <body style="margin:0;background:#0a0a0a;color:#f5f5f5;font-family:Inter,Arial,sans-serif;padding:32px">
      <div style="max-width:600px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:32px">
        <p style="margin:0 0 12px;color:#aaff00;font-weight:700;letter-spacing:.04em;text-transform:uppercase">${title}</p>
        <div style="font-size:18px;line-height:1.6">${body}</div>
        <p style="margin-top:28px;color:#888">Legendai • feito com 🇧🇷 para criadores brasileiros</p>
      </div>
    </body>
  </html>`;
}

export async function sendWelcomeEmail(user: { name: string; email: string }): Promise<void> {
  const client = getResend();
  if (!client) return;
  await client.emails.send({
    from: process.env.EMAIL_FROM ?? "Legendai <oi@legendai.com.br>",
    to: user.email,
    subject: "Bem-vindo ao Legendai",
    html: baseTemplate("Boas-vindas", `<p>Oi, ${user.name}. Sua conta está pronta.</p>`),
  });
}

export async function sendVideoReadyEmail(data: {
  userEmail: string;
  userName: string;
  videoTitle: string;
  videoUrl: string;
}): Promise<void> {
  const client = getResend();
  if (!client) return;
  await client.emails.send({
    from: process.env.EMAIL_FROM ?? "Legendai <oi@legendai.com.br>",
    to: data.userEmail,
    subject: `Seu vídeo "${data.videoTitle}" está pronto`,
    html: baseTemplate(
      "Vídeo pronto",
      `<p>Oi, ${data.userName}. Seu vídeo <strong>${data.videoTitle}</strong> já terminou o processamento.</p>
       <p><a href="${absoluteUrl(data.videoUrl)}" style="color:#aaff00">Abrir editor</a></p>`,
    ),
  });
}

export async function sendAvulsoReceiptEmail(data: {
  userEmail: string;
  userName: string;
  videoTitle: string;
  amount: string;
  duration: string;
  paymentMethod: string;
}): Promise<void> {
  const client = getResend();
  if (!client) return;
  await client.emails.send({
    from: process.env.EMAIL_FROM ?? "Legendai <oi@legendai.com.br>",
    to: data.userEmail,
    subject: "Recebemos seu pagamento avulso",
    html: baseTemplate(
      "Pagamento confirmado",
      `<p>Obrigado, ${data.userName}. Recebemos <strong>${data.amount}</strong> para <strong>${data.videoTitle}</strong>.</p>
       <p>Duração: ${data.duration} • Método: ${data.paymentMethod}</p>`,
    ),
  });
}

export async function sendLimitReachedEmail(data: {
  userEmail: string;
  userName: string;
  plan: string;
  upgradeUrl: string;
}): Promise<void> {
  const client = getResend();
  if (!client) return;
  await client.emails.send({
    from: process.env.EMAIL_FROM ?? "Legendai <oi@legendai.com.br>",
    to: data.userEmail,
    subject: "Seu plano atingiu o limite",
    html: baseTemplate(
      "Limite atingido",
      `<p>Oi, ${data.userName}. O plano <strong>${data.plan}</strong> atingiu o limite.</p>
       <p><a href="${absoluteUrl(data.upgradeUrl)}" style="color:#aaff00">Fazer upgrade</a></p>`,
    ),
  });
}

export async function sendWebhookNotification(message: string): Promise<void> {
  const client = getResend();
  if (!client) return;
  await client.emails.send({
    from: process.env.EMAIL_FROM ?? "Legendai <oi@legendai.com.br>",
    to: process.env.EMAIL_FROM ?? "oi@legendai.com.br",
    subject: "Legendai webhook",
    html: baseTemplate("Webhook", `<p>${message}</p>`),
  });
}
