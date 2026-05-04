# Relatório de Teste Front-End - LegendaAI

> Worktree: `feat-auto-burn-pipeline`  
> Data: 2026-05-03  
> Servidor: http://localhost:3000 (rodando)

---

## 1. Rotas Testadas (Status HTTP)

| Rota | Status | Observação |
|------|--------|------------|
| `/` (Home) | 200 | Landing page carrega corretamente |
| `/login` | 200 | Página de login funcional |
| `/register` | 200 | Página de registro funcional |
| `/dashboard` | 200 | Dashboard carrega (dados mockados) |
| `/upload` | 200 | Página de upload carrega |
| `/videos` | 200 | Lista de vídeos (dados mockados) |
| `/videos/1` | 200 | Detalhe do vídeo funcional |
| `/videos/1/export` | 200 | Exportação funcional |
| `/billing` | 200 | Página de planos carrega |
| `/settings` | 200 | Página de configurações (vazia) |

---

## 2. Botões e Ações - MAPEAMENTO DE PROBLEMAS

### ❌ Botões SEM AÇÃO (não fazem nada ao clicar)

| Página | Botão | Problema |
|--------|-------|----------|
| **Home** | "Ver demo" | Não tem onClick nem href |
| **Home** | "Selecionar" (plano FREE) | Não tem onClick |
| **Home** | "Assinar agora" (plano STARTER) | Não tem onClick |
| **Home** | "Selecionar" (plano PRO) | Não tem onClick |
| **Home** | "Selecionar" (plano UNLIMITED) | Não tem onClick |
| **Home** | "Pagar com PIX" | Não tem onClick |
| **Home** | "Pagar com Cartão" | Não tem onClick |
| **Login** | "Continuar com Google" | Não tem onClick - **CRÍTICO** |
| **Register** | "Criar conta com Google" | Não tem onClick - **CRÍTICO** |
| **Dashboard** | "Upload novo vídeo" | Não tem onClick |
| **Upload** | "PIX" | Não tem onClick |
| **Upload** | "Cartão" | Não tem onClick |
| **Upload** | "Enviar URL" | Não tem onClick |
| **Upload** | "Pagar com PIX" | Não tem onClick |
| **Upload** | "Pagar com Cartão" | Não tem onClick |
| **Billing** | "Selecionar" / "Assinar agora" | Não tem onClick |
| **Billing** | "Pagar com PIX" / "Pagar com Cartão" | Não tem onClick |

### ❌ Links sem rota (href="#")

| Página | Link | Problema |
|--------|------|----------|
| **Home** | "Termos" | href="#" |
| **Home** | "Privacidade" | href="#" |
| **Home** | "Contato" | href="#" |

### ✅ Botões/Links FUNCIONANDO

| Página | Elemento | Ação |
|--------|----------|------|
| **Home** | "Começar grátis" | Link para `/register` |
| **Dashboard/Sidebar** | "Dashboard" | Link para `/dashboard` |
| **Dashboard/Sidebar** | "Upload" | Link para `/upload` |
| **Dashboard/Sidebar** | "Meus Vídeos" | Link para `/videos` |
| **Dashboard/Sidebar** | "Assinatura" | Link para `/billing` |
| **Dashboard/Sidebar** | "Configurações" | Link para `/settings` |
| **Video Detail** | "Baixar SRT" | Botão funcional |
| **Video Detail** | "Baixar VTT" | Botão funcional |
| **Video Export** | "Baixar SRT" | Botão funcional |
| **Video Export** | "Baixar VTT" | Botão funcional |

---

## 3. APIs do Backend - Status

| Endpoint | Status | Resposta |
|----------|--------|----------|
| `/api/health` | 200 | `{"ok":true}` |
| `/api/user/me` | 401 | Não autenticado |
| `/api/user/usage` | 401 | Não autenticado |
| `/api/videos` | 401 | Não autenticado |
| `/api/billing/plans` | 200 | Lista de planos OK |
| `/api/uploadthing` | 501 | UploadThing não configurado |

---

## 4. O que falta para conectar Front-end com Banco de Dados

### 🔴 CRÍTICO - Autenticação

1. **Login com Google não funciona**
   - Os botões "Continuar com Google" e "Criar conta com Google" não têm handlers
   - O NextAuth está configurado (`src/lib/auth.ts`) mas os formulários não chamam `signIn('google')`
   - É necessário implementar o fluxo de autenticação nos componentes `LoginForm.tsx` e `RegisterForm.tsx`

2. **Middleware de proteção de rotas**
   - O `middleware.ts` atual só faz rate-limiting para `/api/billing/*`
   - Não há proteção de rotas autenticadas (dashboard, upload, videos, etc.)
   - Qualquer usuário pode acessar o dashboard sem login

### 🟡 IMPORTANTE - Integração de Dados

3. **Dashboard mostra dados mockados**
   - `VideoList.tsx` usa array estático de vídeos
   - `StatsGrid.tsx` provavelmente também usa dados mockados
   - Precisa fazer fetch da API `/api/videos` (mas requer autenticação)

4. **Upload não está conectado**
   - O componente `UploadZone.tsx` precisa integrar com a API de upload
   - A API `/api/upload` existe mas o front não a consome
   - O fluxo de pagamento avulso (PIX/Cartão) não está integrado com Mercado Pago

5. **Planos de assinatura não são selecionáveis**
   - Os botões de plano não chamam a API de checkout (`/api/billing/checkout`)
   - O componente `PlanCard.tsx` não recebe handler de onSelect

6. **Página de configurações vazia**
   - `/settings` não tem conteúdo
   - Deveria ter opções de perfil, preferências, etc.

### 🟢 MENOR PRIORIDADE

7. **Links do footer**
   - Termos, Privacidade e Contato apontam para `#`
   - Precisam de páginas estáticas ou modais

8. **Botão "Ver demo"**
   - Não tem funcionalidade
   - Poderia abrir um vídeo de demonstração ou modal

---

## 5. Próximos Passos Recomendados

### Prioridade 1: Autenticação
- [ ] Implementar `signIn('google')` nos botões de Login/Register
- [ ] Adicionar proteção de rotas no middleware.ts (redirecionar para /login se não autenticado)
- [ ] Configurar variáveis de ambiente GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET

### Prioridade 2: Conectar Dashboard com API
- [ ] Criar hooks de fetch para `/api/videos`, `/api/user/me`, `/api/user/usage`
- [ ] Substituir dados mockados por dados reais do banco
- [ ] Implementar loading states e tratamento de erro

### Prioridade 3: Funcionalidade de Upload
- [ ] Conectar UploadZone com a API de upload
- [ ] Implementar fluxo de pagamento avulso via Mercado Pago
- [ ] Conectar com fila de processamento (BullMQ/Worker)

### Prioridade 4: Planos e Pagamentos
- [ ] Implementar seleção de planos com chamada a `/api/billing/checkout`
- [ ] Integrar webhook do Mercado Pago para atualizar assinatura
- [ ] Implementar portal de gerenciamento de assinatura

### Prioridade 5: UI/UX
- [ ] Criar páginas de Termos e Privacidade
- [ ] Implementar funcionalidade do botão "Ver demo"
- [ ] Adicionar conteúdo na página de Configurações

---

*Relatório gerado automaticamente via Playwright*
