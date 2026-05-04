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

## Configuração e Setup Local

### Variáveis de Ambiente (.env.local)

Além das variáveis padrão de banco de dados e NextAuth, configure:

**Cloudflare R2 (Storage):**
```env
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://pub-xxx.r2.dev # Opcional, o sistema gera URLs pré-assinadas se for privado
```
*Nota: Em ambiente de desenvolvimento, se as variáveis do R2 não estiverem presentes, o sistema fará fallback automático para salvar uploads no disco local (`public/uploads/`).*

**Correção de Legendas (IA):**
```env
# Configuração do OpenCode SDK para correção de pontuação e gramática
OPENCODE_BASE_URL=http://127.0.0.1:4096
OPENCODE_MODEL=opencode-go/deepseek-v4-flash
```

### Rodando o Ambiente de Desenvolvimento

Para iniciar tanto o servidor Next.js quanto o Worker do BullMQ simultaneamente no Windows, utilize o script PowerShell:

```powershell
.\start-dev.ps1
```
Este script gerencia os processos e salva os logs separadamente na pasta `.next/` (`next.out.log`, `worker.out.log`, etc).

### Usuário de Teste (Dev)

Em ambiente de desenvolvimento (`NODE_ENV === "development"`), as rotas de API de vídeo fazem fallback para um usuário de teste chamado `dev-user` caso você não esteja autenticado. Certifique-se de criar este usuário no banco de dados para testar o fluxo de upload sem precisar fazer login.

## Auto Burn Pipeline (Production)

Required services:
- PostgreSQL
- Redis
- Worker process (`npm run worker:dev` for local, process manager in prod)
- FFmpeg available in PATH or `FFMPEG_PATH`
- Whisper provider (`WHISPER_API_URL` or `WHISPER_EXECUTABLE` or `OPENAI_API_KEY`)
- Cloudflare R2 (`R2_*` vars)

READY means both files exist:
- `processedUrl` (burnt MP4)
- `srtUrl` (subtitle file)

### Estratégias de Correção de Legenda

O pipeline utiliza o **OpenCode SDK** para correção de pontuação e gramática:
- **OpenCode SDK:** Usa o modelo configurado em `OPENCODE_MODEL` (ex: `opencode-go/deepseek-v4-flash`) via API local ou remota do OpenCode. Excelente qualidade em PT-BR mantendo o estilo coloquial.
- **Fallback:** Caso a correção via IA falhe, o sistema retorna os segmentos originais gerados pelo Whisper para garantir que o pipeline não seja interrompido.
