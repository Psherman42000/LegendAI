# LegendaAI

Plataforma SaaS para gerar legendas em português brasileiro, com frontend em Next.js 16, TypeScript e Tailwind, backend com Prisma/PostgreSQL, billing via Mercado Pago, fila BullMQ para o worker e preparação para um app mobile React Native.

## Stack

- Next.js App Router
- TypeScript strict
- Tailwind CSS
- PostgreSQL + Prisma 7
- NextAuth com Google OAuth
- Mercado Pago
- BullMQ + worker separado
- Resend para e-mails

## Scripts

```bash
npm run dev
npm run build
npm run worker:dev
npm run db:push
npm run db:migrate
npm run db:seed
```

## Estrutura

- `src/app` - rotas públicas, dashboard e API
- `src/components` - UI do produto
- `src/lib` - auth, banco, billing, vídeo, IA e utilitários
- `src/hooks` - lógica portável para web e mobile
- `src/workers` - processamento de vídeo fora da Vercel
- `prisma` - schema e seed

## Observações

- O build foi validado localmente com `npm run build`.
- O worker de vídeo foi desenhado para rodar fora da Vercel.
- `src/app/api/README.md` documenta a API para consumo futuro pelo app mobile.
