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
npm run test              # testes unitários (Node test runner + tsx)
npm run worker:dev        # worker contínuo (dev)
npm run worker:start      # worker on-demand (checa fila → inicia → auto-shutdown)
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

**Cloudflare R2 (Storage) - Obrigatório para upload em produção:**
```env
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com      # Obrigatório para ativar o R2
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```
> ⚠️ **Importante:** `R2_ENDPOINT` é obrigatório. Sem ele, o sistema cai no fallback de disco (`public/uploads/`), que retorna URLs relativas e pode causar erro `Invalid URL` no worker.

**Limites de Upload:**
- Tamanho máximo por arquivo: **500 MB**
- Após o upload, o vídeo é enfileirado automaticamente e o worker é disparado (best-effort).

**Aplicação:**
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Necessário para URLs absolutas no fallback de disco
```

**Correção de Legendas (IA):**
```env
# Configuração do OpenCode SDK (precisa do servidor OpenCode rodando localmente)
OPENCODE_BASE_URL=http://127.0.0.1:4096
OPENCODE_MODEL=opencode-go/deepseek-v4-flash

# Fallback quando OpenCode não está disponível
OPENAI_API_KEY=sk-...
```
> ℹ️ **Comportamento:** O sistema tenta usar o OpenCode primeiro. Se falhar (servidor offline), faz fallback automático para OpenAI. Se OpenAI também falhar, retorna os segmentos originais do Whisper.

**Worker On-Demand (obrigatório para produção):**
```env
WORKER_START_URL=http://localhost:3000/api/worker/start
WORKER_SECRET=change-me-em-producao
# WORKER_IDLE_TIMEOUT_MS=60000   # opcional — padrão 60s
```
> ⚠️ **Importante:** `WORKER_SECRET` é usado tanto pelo endpoint `/api/worker/start` quanto pelo script `npm run worker:start`. Configure um segredo compartilhado entre API e worker host.

### Rodando o Ambiente de Desenvolvimento

Para iniciar todos os serviços de desenvolvimento no Windows, utilize o script PowerShell:

```powershell
.\start-dev.ps1
```

Este script gerencia automaticamente:
1. PostgreSQL
2. Redis (versão 6.2+ recomendada)
3. Whisper API (`localhost:8000`, opcional `-SkipWhisper`)
4. **OpenCode Server** (`localhost:4096`, opcional `-SkipOpenCode`)
5. Next.js Dev Server (`localhost:3000`)
6. Worker BullMQ (processamento de vídeo em background)

**Logs:** São salvos separadamente na pasta `.next/` (`dev-server-out.log`, `worker-out.log`, `opencode.log`, etc).

**Parar tudo:**
```powershell
.\start-dev.ps1 -Stop
```

**Pular serviços opcionais:**
```powershell
.\start-dev.ps1 -SkipWhisper      # Se não tiver Whisper local
.\start-dev.ps1 -SkipOpenCode     # Se não tiver OpenCode local
```

### Usuário de Teste (Dev)

Em ambiente de desenvolvimento (`NODE_ENV === "development"`), as rotas de API de vídeo fazem fallback para um usuário de teste chamado `dev-user` caso você não esteja autenticado. Certifique-se de criar este usuário no banco de dados para testar o fluxo de upload sem precisar fazer login.

## Auto Burn Pipeline (Production)

Required services:
- PostgreSQL
- Redis
- Worker process (on-demand)
- FFmpeg available in PATH or `FFMPEG_PATH`
- Whisper provider (`WHISPER_API_URL` or `WHISPER_EXECUTABLE` or `OPENAI_API_KEY`)
- Cloudflare R2 (`R2_*` vars)

### Worker On-Demand (Produção)

O worker processa vídeos sob demanda e desliga automaticamente após idle:

1. **API dispara o worker imediatamente** quando um vídeo entra na fila (`triggerWorker()`).
2. **Cron job de segurança** a cada 5 min executa `npm run worker:start`, que checa se há jobs pendentes e inicia o worker se necessário.
3. **Auto-shutdown:** o worker se encerra sozinho após `WORKER_IDLE_TIMEOUT_MS` (padrão 60s) sem jobs ativos.

> **Vercel:** não suporta processos longos. O worker deve rodar em um host persistente (Railway, Render, VPS) e `WORKER_START_URL` deve apontar para esse host.

READY means both files exist:
- `processedUrl` (burnt MP4)
- `srtUrl` (subtitle file)

**Status dos vídeos:**
- `QUEUED` — enviado para fila, aguardando processamento
- `PROCESSING` — worker ativo (transcrição, correção, burn)
- `READY` — legendas geradas, arquivos disponíveis
- `EXPORTED` — vídeo com legendas queimadas disponível
- `ERROR` — falha no pipeline; use "Tentar novamente" para reprocessar

### Troubleshooting

Para diagnósticos de bugs conhecidos, causas raiz e reparos manuais, consulte:

- **`docs/memory/critical-bug-findings.md`** — documentação técnica de bugs corrigidos, incluindo troca de conta Google, worker travado, e reparo de banco local.

### Health Check

Endpoint `/api/health` retorna status real de PostgreSQL, Redis e R2. Útil para monitoramento e load balancers.

### Migrações Manuais (Offline)

Se o PostgreSQL local estiver offline e `prisma migrate dev` falhar com `P1001`, crie a migration manualmente:

1. Crie a pasta: `prisma/migrations/YYYYMMDDhhmmss_nome_descritivo/`
2. Escreva o SQL em `migration.sql`
3. Execute: `npx prisma validate` e `npx prisma generate`

> ⚠️ Não use `pg_ctl start` dentro de scripts automatizados se o banco já estiver configurado como serviço do Windows.

### Requisitos Adicionais

**FFmpeg (Windows):**
- Baixe em https://www.gyan.dev/ffmpeg/builds/ e extraia em `C:\tools\ffmpeg\`
- Configure no `.env.local`: `FFMPEG_PATH=C:\tools\ffmpeg\ffmpeg-8.1-essentials_build\bin\ffmpeg.exe`

**Redis:**
- Versão 6.2+ recomendada (a versão 5.0 funciona mas mostra warnings)
- Extraia o Redis para a pasta `redis5/` na raiz do projeto

### Estratégias de Correção de Legenda

O pipeline utiliza o **OpenCode SDK** como padrão para correção de pontuação e gramática:
- **OpenCode SDK:** Usa o modelo configurado em `OPENCODE_MODEL` (ex: `opencode-go/deepseek-v4-flash`) via API local na porta 4096. Excelente qualidade em PT-BR mantendo o estilo coloquial.
- **OpenAI Fallback:** Quando o OpenCode não está disponível, usa `gpt-4o-mini` via OpenAI SDK.
- **Interface:** Na tela de upload, há um toggle **"Usar correção com IA"** (ligado por padrão) que envia a flag `useAiCorrection` para o worker.
- **Último Fallback:** Se ambos falharem, retorna os segmentos originais do Whisper para garantir que o pipeline não seja interrompido.
