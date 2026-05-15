# Design de Responsividade Mobile — LegendAI

> Data: 2026-05-10
> Escopo: Site inteiro — todas as páginas e funcionalidades devem funcionar em mobile (320px+)
> Abordagem: Mobile-First com Componentes de Layout

---

## 1. Visão Geral

O site possui 3 grandes áreas:
1. **Marketing** (landing page)
2. **Auth** (login/register)
3. **Dashboard** (upload, vídeos, editor, billing, settings)

Atualmente, a landing page e auth já possuem alguma responsividade. O dashboard é a área crítica: a navegação lateral (`Sidebar`) desaparece em telas < `lg` sem alternativa, tornando o app inutilizável no celular. Além disso, páginas como editor de legendas e fluxo de upload têm layouts fixos que quebram em telas pequenas.

**Princípio diretor:** Nenhuma funcionalidade disponível na versão desktop pode estar indisponível no mobile. Se precisar de adaptação de UX (ex: drawer ao invés de sidebar), a funcionalidade em si permanece idêntica.

---

## 2. Componentes de Layout Compartilhados

### 2.1 MobileNav (novo componente)

**Responsabilidade:** Substituir a `Sidebar` em telas < `lg` (`max-width: 1023px`).

**Comportamento:**
- Botão hambúrguer fixo no `Header` do dashboard (esquerda, ao lado do título/logo)
- Ao clicar, abre um `Sheet` (shadcn) deslizando da esquerda com a lista de navegação
- Lista de links idêntica à Sidebar: Dashboard, Upload, Meus Vídeos, Assinatura, Configurações
- Ícone + label para cada link, com estado ativo destacado (igual à sidebar)
- Fecha automaticamente ao clicar em um link (navegação SPA)

**Arquivo:** `src/components/dashboard/MobileNav.tsx`

### 2.2 Sidebar (ajuste)

**Mudança:** Manter comportamento atual em `lg+`. Em telas < `lg`, não renderizar nada (o layout já faz isso via `lg:grid`).

**Arquivo:** `src/components/dashboard/Sidebar.tsx` — adicionar classe `hidden lg:block` na raiz.

### 2.3 DashboardLayout (ajuste)

**Mudança:** Adicionar `MobileNav` e ajustar padding mobile.

**Layout mobile:**
- Header com hambúrguer + logo + user menu
- Conteúdo com `px-4 py-6` (mobile) → `px-6 py-8` (md) → `p-6 lg:p-10` (lg+)
- Sem sidebar visível (navegação via MobileNav)

**Arquivo:** `src/app/(dashboard)/layout.tsx`

### 2.4 Header (ajuste)

**Mudança:** Adicionar slot para o botão hambúrguer à esquerda.

**Layout mobile:**
- `flex items-center justify-between px-4 py-3`
- Esquerda: Hamburger icon (`Menu` do Lucide)
- Centro: Logo pequeno ou título da página
- Direita: Avatar/Menu do usuário (mantém dropdown)

**Arquivo:** `src/components/dashboard/Header.tsx`

---

## 3. Páginas — Mudanças Específicas

### 3.1 Landing Page (`src/app/(marketing)/page.tsx`)

**Estado atual:** Delega para componentes marketing. Alguns já são responsivos.

**Mudanças necessárias:**
- Verificar cada componente em `src/components/marketing/*`
- Garantir que `Hero`, `Features`, `Comparison`, `Pricing`, `Testimonials`, `Demo` tenham:
  - `flex-col` em mobile → `md:flex-row` em desktop
  - Padding reduzido: `px-4` mobile → `px-6 md:px-12 lg:px-24`
  - Textos menores: `text-3xl` mobile → `text-4xl md:text-5xl lg:text-6xl`
  - Cards em grid: `grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-3`
  - Botões CTA empilhados verticalmente em mobile, lado a lado em desktop

### 3.2 Auth — Login (`src/app/(auth)/login/page.tsx`)

**Estado atual:** Layout centralizado com card.

**Mudanças necessárias:**
- Card com `w-full max-w-md mx-4` em mobile (não fixar largura)
- Padding interno: `p-6` mobile → `p-8` desktop
- Inputs com `text-base` (evita zoom no iOS Safari)

### 3.3 Auth — Register (`src/app/(auth)/register/page.tsx`)

**Mesmas mudanças do Login.**

### 3.4 Dashboard Home (`src/app/(dashboard)/dashboard/page.tsx`)

**Estado atual:** `p-6 lg:p-10` apenas.

**Mudanças necessárias:**
- Padding: `px-4 py-6 md:px-6 md:py-8 lg:p-10`
- `StatsGrid`: garantir que cards empilhem verticalmente em mobile (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`)
- `VideoList`: já possui `sm:grid-cols-2 xl:grid-cols-3` — verificar se precisa de `grid-cols-1` explícito
- Título da página: `text-xl md:text-2xl lg:text-3xl`

### 3.5 Upload (`src/app/(dashboard)/upload/page.tsx`)

**Estado atual:** `p-6 lg:p-10`. UploadZone parcialmente responsivo.

**Mudanças necessárias:**
- Padding: `px-4 py-6 md:px-6 md:py-8 lg:p-10`
- `VideoUploadFlow`: progresso de 5 passos em `grid-cols-5` quebra em mobile
  - **Solução:** Em mobile, mostrar apenas o passo atual com label, não os 5 de uma vez. Ou usar scroll horizontal com `overflow-x-auto flex gap-2`
  - Alternativa: usar flex-wrap com `grid-cols-2 sm:grid-cols-3 md:grid-cols-5`
- `UploadZone`:
  - Área de drop: `min-h-[160px]` mobile → `min-h-[200px]` desktop
  - Grid interno: `grid-cols-1 md:grid-cols-[1fr_auto]`
  - Botões de pagamento: empilhados verticalmente (`flex-col`) em mobile
- Título: `text-xl md:text-2xl`

### 3.6 Vídeos — Lista (`src/app/(dashboard)/videos/page.tsx`)

**Estado atual:** `p-6 lg:p10`.

**Mudanças necessárias:**
- Padding: `px-4 py-6 md:px-6 md:py-8 lg:p-10`
- `VideoList`: já tem grid responsivo, mas verificar:
  - `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` (garantir coluna única em mobile)
  - Gap menor em mobile: `gap-4` universal está OK
- `VideoPagination`: garantir que controles de paginação não quebrem (`flex-wrap`)
- Título + ações: `flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`

### 3.7 Vídeos — Detalhe (`src/app/(dashboard)/videos/[id]/page.tsx`)

**Estado atual:** `p-6 lg:p-10`.

**Mudanças necessárias:**
- Padding: `px-4 py-6 md:px-6 md:py-8 lg:p-10`
- Layout do vídeo: player em `aspect-video` (já é responsivo)
- Info abaixo do vídeo: `flex-col gap-4 md:flex-row md:justify-between`
- Botões de ação (Baixar SRT/VTT): `flex-col sm:flex-row gap-3`
- Metadados: empilhados verticalmente em mobile

### 3.8 Vídeos — Export (`src/app/(dashboard)/videos/[id]/export/page.tsx`)

**Estado atual:** `p-6 lg:p-10`. Usa `ExportPanel`.

**Mudanças necessárias:**
- Padding: `px-4 py-6 md:px-6 md:py-8 lg:p-10`
- `ExportPanel`:
  - Preview do vídeo: `aspect-video` (OK)
  - Formulário de opções: `flex-col gap-6` em mobile → `md:flex-row` se tiver preview lado a lado
  - Se for grid de opções: `grid-cols-1 md:grid-cols-2`
  - Botão de exportar: `w-full` em mobile, `w-auto` em desktop

### 3.9 Editor de Legendas (`src/app/(dashboard)/videos/[id]/page.tsx` com `VideoEditor`)

**Estado atual:** CRÍTICO. `SubtitleEditor` só fica 2-colunas em `xl`.

**Mudanças necessárias:**
- `VideoEditor` container:
  - Padding: `px-4 py-6 md:px-6 md:py-8 lg:p-10`
- `SubtitleEditor`:
  - Grid: `grid-cols-1 lg:grid-cols-[1.5fr_1fr]` (muda de `xl` para `lg`)
  - Preview do vídeo: full-width em mobile
  - Lista de segmentos: scroll vertical com `max-h-[50vh]` em mobile, `max-h-[calc(100vh-200px)]` em desktop
  - Cada segmento: `flex-col gap-2` em mobile → `sm:flex-row` em tablet+
  - Inputs de timing: `w-full` em mobile
  - `TimingAdjuster`: garantir que os botões (+/-) não fiquem muito pequenos em mobile (`min-w-[44px] min-h-[44px]` para touch)
  - `StylePicker`: se for grid de estilos, `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`
- `VideoPreview`: `aspect-video` (OK, mas garantir que não tenha largura mínima)

**Princípio:** O editor deve ser totalmente funcional no celular. Usuários devem conseguir:
- Ver o preview do vídeo
- Editar textos das legendas
- Ajustar timings
- Aplicar estilos
- Exportar

### 3.10 Billing (`src/app/(dashboard)/billing/page.tsx`)

**Estado atual:** `p-6 lg:p-10`.

**Mudanças necessárias:**
- Padding: `px-4 py-6 md:px-6 md:py-8 lg:p-10`
- `PlansList` / `PlanCard`:
  - Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (cards de planos)
  - Card individual: não ter largura fixa
  - Botão "Selecionar": `w-full` em mobile
- `PricingTable`: se for tabela, transformar em cards empilhados em mobile (tabelas não funcionam bem em mobile) ou adicionar `overflow-x-auto` com `min-w-[600px]`
- `AvulsoCalculator`:
  - Input de duração + resultado: `flex-col` mobile → `sm:flex-row`
  - Botões de pagamento: `flex-col gap-3` mobile → `sm:flex-row`

### 3.11 Settings (`src/app/(dashboard)/settings/page.tsx`)

**Estado atual:** `p-6 lg:p-10`, `mx-auto max-w-2xl`.

**Mudanças necessárias:**
- Padding: `px-4 py-6 md:px-6 md:py-8 lg:p-10`
- `max-w-2xl` com `mx-4 sm:mx-auto` (não colar nas bordas em mobile)
- Formulários: labels acima dos inputs em mobile (já devem estar assim, verificar)
- Botões de ação: `w-full` em mobile

---

## 4. Componentes Compartilhados — Ajustes

### 4.1 VideoList (`src/components/dashboard/VideoList.tsx`)

**Mudança:** Garantir `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` explícito.

### 4.2 VideoCard (`src/components/dashboard/VideoCard.tsx`)

**Mudança:** Verificar se thumbnail não tem altura fixa que distorça. Usar `aspect-video`.

### 4.3 StatsGrid (`src/components/dashboard/StatsGrid.tsx`)

**Mudança:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.

### 4.4 VideoUploadFlow (`src/components/upload/VideoUploadFlow.tsx`)

**Mudança:** Progresso de passos.
- Desktop: 5 colunas visíveis
- Mobile: Scroll horizontal ou mostrar apenas "Passo X de 5" com título do passo atual

### 4.5 UploadZone (`src/components/upload/UploadZone.tsx`)

**Mudança:**
- Área de drop: altura mínima responsiva
- Grid interno: coluna única em mobile
- Botões de pagamento: empilhados

### 4.6 SubtitleEditor, TimingAdjuster, StylePicker

**Vide seção 3.9.**

### 4.7 Footer (`src/components/layout/Footer.tsx`)

**Mudança:** Já é responsivo (`flex-col md:flex-row`). Verificar se precisa de ajustes de padding/spacing.

---

## 5. Breakpoints Padronizados

Usar os breakpoints padrão do Tailwind:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

**Regra de ouro:** Começar o layout mobile sem prefixo, e adicionar `sm:`, `md:`, `lg:` para telas maiores.

**Exemplo:**
```
<div className="flex flex-col gap-4 md:flex-row md:items-center">
```

---

## 6. Touch & Acessibilidade Mobile

- Todos os botões clicáveis devem ter `min-h-[44px]` e `min-w-[44px]` (área mínima de toque)
- Inputs devem ter `text-base` (16px) para evitar zoom automático no iOS Safari
- Scroll em containers com `overflow-x-auto` deve ter `-webkit-overflow-scrolling: touch`
- Evitar `hover:` como única forma de revelar ação — mobile não tem hover
- Sheet/drawer deve fechar ao tocar fora ou swipe

---

## 7. Funcionalidades que DEVEM funcionar idêntico no mobile

| Funcionalidade | Desktop | Mobile |
|---|---|---|
| Login com Google | ✅ | ✅ |
| Upload de vídeo | ✅ | ✅ (file picker funciona nativamente) |
| Pagamento PIX/Cartão | ✅ | ✅ |
| Visualizar lista de vídeos | ✅ | ✅ |
| Reproduzir preview do vídeo | ✅ | ✅ |
| Editar textos das legendas | ✅ | ✅ |
| Ajustar timing das legendas | ✅ | ✅ |
| Aplicar estilos de legenda | ✅ | ✅ |
| Exportar SRT/VTT | ✅ | ✅ |
| Baixar arquivo exportado | ✅ | ✅ |
| Alterar plano de assinatura | ✅ | ✅ |
| Cancelar assinatura | ✅ | ✅ |

---

## 8. Arquivos a Modificar (lista completa)

### Novos arquivos:
1. `src/components/dashboard/MobileNav.tsx`

### Modificações:
1. `src/app/(dashboard)/layout.tsx` — adicionar MobileNav, ajustar padding
2. `src/components/dashboard/Sidebar.tsx` — `hidden lg:block`
3. `src/components/dashboard/Header.tsx` — adicionar botão hambúrguer
4. `src/app/(dashboard)/dashboard/page.tsx` — padding, títulos
5. `src/app/(dashboard)/upload/page.tsx` — padding, títulos
6. `src/components/upload/VideoUploadFlow.tsx` — steps responsivos
7. `src/components/upload/UploadZone.tsx` — grid, altura, botões
8. `src/app/(dashboard)/videos/page.tsx` — padding, títulos
9. `src/app/(dashboard)/videos/[id]/page.tsx` — padding, layout info
10. `src/app/(dashboard)/videos/[id]/export/page.tsx` — padding, layout
11. `src/components/editor/VideoEditor.tsx` — header flex-wrap
12. `src/components/editor/SubtitleEditor.tsx` — grid lg, segmentos flex-col
13. `src/components/editor/TimingAdjuster.tsx` — touch targets
14. `src/components/editor/StylePicker.tsx` — grid responsivo
15. `src/app/(dashboard)/billing/page.tsx` — padding, planos
16. `src/components/billing/PlanCard.tsx` — w-full button, card sizing
17. `src/components/billing/PricingTable.tsx` — cards vs table
18. `src/components/billing/AvulsoCalculator.tsx` — flex-col mobile
19. `src/app/(dashboard)/settings/page.tsx` — padding, mx-4
20. `src/app/(marketing)/page.tsx` — verificar/ajustar se necessário
21. `src/components/marketing/*` — Hero, Features, Pricing, etc.
22. `src/app/(auth)/login/page.tsx` — w-full card
23. `src/app/(auth)/register/page.tsx` — w-full card
24. `src/components/auth/LoginForm.tsx` — text-base inputs
25. `src/components/auth/RegisterForm.tsx` — text-base inputs

---

## 9. Critérios de Aceitação

- [ ] Todas as páginas são navegáveis em um iPhone SE (375px)
- [ ] Todas as páginas são navegáveis em um iPhone 14 Pro Max (430px)
- [ ] Todas as funcionalidades listadas na seção 7 funcionam em mobile
- [ ] Navegação do dashboard funciona sem sidebar visível (via hambúrguer)
- [ ] Nenhum conteúdo fica cortado ou com scroll horizontal indesejado
- [ ] Touch targets têm no mínimo 44x44px
- [ ] Inputs de texto não causam zoom no iOS
- [ ] Preview de vídeo mantém `aspect-ratio` em todas as telas
- [ ] Editor de legendas é utilizável em modo portrait (altura do segment list ajustada)
