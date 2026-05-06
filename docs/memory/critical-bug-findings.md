# LegendAI — achados críticos de debug

Atualizado em: 2026-05-06

## Regras operacionais desta investigação

- Antes de subir o projeto, parar tudo com `./start-dev.ps1 -Stop`.
- Depois iniciar com `./start-dev.ps1 -SkipWhisper -SkipOpencode`.
- Rodar `npm run build` somente no final, após corrigir os bugs.
- Prisma 7 neste projeto deve ser acessado via `src/lib/db.ts`; `new PrismaClient()` cru pode falhar por faltar adapter.

## Bug: troca de conta Google mantém `brasilianluxury7`

### Evidência principal

- A tabela local `Account` tinha múltiplos `providerAccountId` do Google apontando para o mesmo usuário `brasilianluxury7@gmail.com`.
- Não havia usuário `pedroid199@gmail.com` no banco local, mesmo após selecionar essa conta no seletor do Google.
- O fluxo antigo chamava `signIn("google", { callbackUrl: "/dashboard" })` enquanto já existia uma sessão ativa.

### Causa raiz aprendida

No NextAuth v4 com `PrismaAdapter` e sessão de banco, se já existe `sessionToken` e o callback OAuth retorna uma conta Google ainda não vinculada, o NextAuth faz account-linking na sessão atual. Ou seja: escolher outra conta no Google não troca usuário; vincula a nova conta Google ao usuário logado e continua com ele.

Arquivo confirmado: `node_modules/next-auth/core/lib/callback-handler.js` — no callback OAuth, com sessão ativa e sem `userByAccount`, chama `linkAccount({ ...account, userId: user.id })`.

### Correção aplicada/esperada

- Antes de iniciar login/cadastro Google, chamar `signOut({ redirect: false })`.
- Depois chamar `signIn("google", { callbackUrl: "/dashboard" }, { prompt: "select_account", max_age: "0" })`.
- Evitar `SessionProvider` duplicado no layout do dashboard; o provider global em `src/app/layout.tsx` já cobre a aplicação.

### Reparo local executado (2026-05-06)

1. Backup salvo em `tmp/db-backup/accounts-*.json` e `sessions-*.json`.
2. Decodificados `id_token` das contas Google para mapear `providerAccountId → email`.
3. Removido Account `102111106645284693320` (email real: `pedroid199@gmail.com`) que estava vinculado ao usuário `brasilianluxury7@gmail.com`.
4. Removido Account `107132659884124123495` (email real: `pedro@integra.do`) que estava vinculado ao usuário `cardgiftcontato@gmail.com`.
5. Removida sessão ativa do `brasilianluxury7` para forçar login novo.

**Estado pós-reparo:**
- Brasilian Luxury: 1 conta Google correta (`brasilianluxury7`), 0 sessões.
- Card Gift: 1 conta Google correta (`cardgiftcontato`), sessões intactas.
- pedroid199: sem Account no DB — ao logar criará usuário novo.

### Técnica útil: decodificar `id_token` do Google

O `Account.id_token` no banco é um JWT assinado pelo Google que contém `email`, `name`, `sub` (mesmo que `providerAccountId`) e `email_verified`. Dá para decodificar **sem verificar assinatura** para diagnóstico:

```ts
const payload = JSON.parse(
  Buffer.from(account.id_token.split(".")[1], "base64url").toString()
);
// { sub: "107469098846313175538", email: "brasilianluxury7@gmail.com", ... }
```

Isso permite mapear `providerAccountId → email` no banco local para identificar contas Google órfãs ou vinculadas ao usuário errado.

## Bug: vídeos presos em `QUEUED`/`PROCESSING`

### Evidência principal

- BullMQ mostrou job ativo para o vídeo `cmot8iy3v00000gv30ua37ana`.
- O banco mostrou status `PROCESSING`, progresso travado e `errorMessage` contendo saída do ffmpeg terminando com:
  `File '...tmp\1778022224882-WhatsApp%20Video%202026-05-04%20at%2021.39.04.wav' already exists. Overwrite? [y/N]`

### Causa raiz aprendida

`src/lib/ffmpeg.ts` gerava o áudio com `videoPath.replace(/\.[^.]+$/, ".wav")`. Em retries ou uploads repetidos com mesmo basename, o `.wav` já existia. Como o comando não passava `-y` nem `-nostdin`, o ffmpeg perguntava se podia sobrescrever e ficava aguardando entrada, prendendo o worker/job.

### Correção aplicada/esperada

- Comandos ffmpeg devem ser não-interativos: `-y` + `-nostdin`.
- Artefatos temporários derivados do vídeo devem ter nomes únicos por execução, não só trocar extensão do upload.
- O cleanup do worker continua importante para apagar `videoPath`, `audioPath`, thumbnail, SRT e output final.

### Achado adicional: worker não voltava após idle no Windows

- Após o worker dev logar `No jobs for 60000ms — shutting down`, chamar `/api/worker/start` retornava HTTP 200, mas o log mostrava `Worker spawned (PID undefined)` e nenhum processo novo de `videoProcessor.ts` aparecia.
- Causa aprendida: `spawn("npx", ["tsx", workerScript], { detached: true })` não é confiável no Windows/PowerShell porque `npx` é resolvido como shim `.cmd`; com `stdio: "ignore"`, o endpoint podia reportar sucesso sem PID real.
- Correção aplicada/esperada: iniciar o worker com `process.execPath` apontando para o Node atual e chamar diretamente `node_modules/tsx/dist/cli.mjs`, retornando erro 500 se o child process não expuser PID.

## Hipóteses descartadas ou secundárias

- Alterar apenas `prompt: "select_account"`/`max_age: 0` não resolve auth, porque o problema ocorre depois que o Google retorna a conta: é account-linking do NextAuth com sessão ativa.
- O worker idle timeout pode ser um problema de arquitetura em outro cenário, mas a evidência concreta deste travamento foi ffmpeg esperando resposta interativa.

## Bug: SRT igual com e sem correção de IA

### Evidência principal

- Dois arquivos SRT exportados (`subtitles(1).srt` e `subtitles(2).srt`) vieram idênticos mesmo alternando a flag de correção.
- O teste direto do provider com `.env.local` confirmou que a correção estava disponível: `correctTranscription(..., true)` usando Gemini retornou textos corrigidos como `Mandando porcaria de tarefa` e `Porra, menino digitou e mandou os digitados.`
- Logo, o problema não estava na flag do upload nem necessariamente no provider: a correção acontecia antes do SRT, mas era perdida depois.

### Causa raiz aprendida

`src/workers/videoProcessor.ts` passa os segmentos corrigidos para `splitSegmentsByWords()`, mas também preserva/reatribui `segment.words` vindos da transcrição bruta. Antes da correção, `src/lib/segment-splitter.ts` sempre montava `text` dos chunks com `words[].word` quando havia timestamps de palavra:

```ts
text: chunkWords.map((w) => w.word.trim()).join(" ").trim()
```

Como `words[].word` ainda continha o texto cru do Whisper, o SRT final voltava para frases como `carnissa`, `jitou`, `jitados`, mesmo quando `segment.text` já tinha sido corrigido pelo provider.

### Correção aplicada/esperada

- `segment.text` deve ser tratado como texto canônico, possivelmente corrigido por IA.
- Se `segment.text` e `segment.words` tiverem a mesma quantidade de tokens, preservar timestamps e substituir apenas os labels (`word`) pelos tokens corrigidos.
- Se a correção mudar a quantidade de tokens, abandonar `words` bruto e usar interpolação por `segment.text`, para não reverter a legenda para a transcrição original.
- Regressões adicionadas em `tests/segment-splitter.test.ts` cobrindo correção com mesma quantidade de palavras e com quantidade diferente.

### Verificação executada

- `npx tsx --test tests/segment-splitter.test.ts` falhou antes da correção mostrando `Mandando carnissa de tarefa` em vez de `Mandando carniça de tarefa.`
- Após a correção: `npm test` passou 6/6, ESLint dos arquivos alterados passou, e `npm run build` concluiu com sucesso.
