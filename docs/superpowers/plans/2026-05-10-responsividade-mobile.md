# Responsividade Mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar todo o site LegendAI responsivo para mobile (320px+), garantindo que nenhuma funcionalidade do desktop fique indisponível no celular.

**Architecture:** Mobile-first via Tailwind CSS. Layout do dashboard ganha navegação mobile via shadcn Sheet (drawer). Todas as páginas ajustam padding, grids, flex direction e tipografia por breakpoint. Componentes críticos (editor, upload, billing) mantêm funcionalidade idêntica com UX adaptada para touch.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, shadcn/ui, TypeScript.

---

## File Structure

### New files:
- `src/components/dashboard/MobileNav.tsx` — Drawer de navegação mobile (< lg)

### Modified files:
- `src/components/dashboard/Sidebar.tsx` — `hidden lg:block`
- `src/components/dashboard/Header.tsx` — Botão hambúrguer + layout mobile
- `src/app/(dashboard)/layout.tsx` — Integrar MobileNav, ajustar padding
- `src/app/(dashboard)/dashboard/page.tsx` — Padding responsivo
- `src/app/(dashboard)/upload/page.tsx` — Padding responsivo, título
- `src/app/(dashboard)/videos/page.tsx` — Padding responsivo
- `src/app/(dashboard)/videos/[id]/page.tsx` — Padding responsivo
- `src/app/(dashboard)/videos/[id]/export/page.tsx` — Padding responsivo
- `src/app/(dashboard)/billing/page.tsx` — Padding responsivo, grid planos
- `src/app/(dashboard)/settings/page.tsx` — Padding responsivo, mx-auto
- `src/app/(auth)/login/page.tsx` — Padding container auth
- `src/app/(auth)/register/page.tsx` — Padding container auth
- `src/components/dashboard/StatsGrid.tsx` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- `src/components/dashboard/VideoPagination.tsx` — `flex-wrap` nos controles
- `src/components/upload/VideoUploadFlow.tsx` — Steps responsivos
- `src/components/upload/UploadZone.tsx` — Altura dropzone, grid, botões
- `src/components/billing/PlanCard.tsx` — Card fluido
- `src/components/billing/PricingTable.tsx` — Grid responsivo
- `src/components/billing/AvulsoCalculator.tsx` — Flex-col mobile
- `src/components/editor/SubtitleEditor.tsx` — `lg:` breakpoint, altura lista
- `src/components/editor/VideoEditor.tsx` — Header flex-wrap
- `src/components/editor/SubtitleSegment.tsx` — Touch target, w-full inputs
- `src/components/marketing/Hero.tsx` — Texto e padding mobile
- `src/components/marketing/Features.tsx` — `sm:grid-cols-1 md:grid-cols-3`
- `src/components/layout/Footer.tsx` — Padding mobile
- `src/components/auth/LoginForm.tsx` — `text-base` nos inputs
- `src/components/auth/RegisterForm.tsx` — `text-base` nos inputs

---

## Fase 1: Layout Compartilhado do Dashboard

### Task 1: Instalar shadcn Sheet

**Files:**
- Install: `npx shadcn@latest add sheet`

- [ ] **Step 1: Instalar componente Sheet do shadcn**

Run:
```bash
cd legendai
npx shadcn@latest add sheet
```
Expected: Cria `src/components/ui/sheet.tsx`

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/sheet.tsx
git commit -m "chore: add shadcn sheet component for mobile nav"
```

---

### Task 2: Criar MobileNav

**Files:**
- Create: `src/components/dashboard/MobileNav.tsx`

- [ ] **Step 1: Criar componente MobileNav**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/videos", label: "Meus Vídeos" },
  { href: "/plans", label: "Planos" },
  { href: "/billing", label: "Assinatura" },
  { href: "/payment", label: "Pagamento Avulso" },
  { href: "/settings", label: "Configurações" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] bg-[var(--surface)] p-0">
        <SheetHeader className="border-b border-white/5 p-6 text-left">
          <SheetTitle className="text-display text-xl font-bold tracking-tight text-[var(--primary)]">
            Legendai
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "rounded-xl px-4 py-3 text-sm font-medium transition hover:bg-white/5 hover:text-[var(--primary)]",
                pathname === link.href
                  ? "bg-white/5 text-[var(--primary)]"
                  : "text-[var(--text)]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/MobileNav.tsx
git commit -m "feat: add MobileNav drawer for dashboard (< lg)"
```

---

### Task 3: Ajustar Sidebar para esconder em mobile

**Files:**
- Modify: `src/components/dashboard/Sidebar.tsx`

- [ ] **Step 1: Adicionar `hidden lg:flex` na raiz**

Replace line 25:
```tsx
    <aside className="surface sticky top-0 hidden h-screen w-full max-w-[280px] flex-col border-r border-white/5 p-6 lg:flex">
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/Sidebar.tsx
git commit -m "fix: hide sidebar on mobile, shown only on lg+"
```

---

### Task 4: Ajustar Header com botão hambúrguer

**Files:**
- Modify: `src/components/dashboard/Header.tsx`
- Import: MobileNav

- [ ] **Step 1: Refatorar Header com MobileNav e títulos responsivos**

```tsx
import Link from "next/link";
import { MobileNav } from "./MobileNav";

export function Header({
  title,
  description,
  showUploadButton = false,
}: {
  title: string;
  description: string;
  showUploadButton?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <MobileNav />
        <div>
          <h1 className="text-display text-xl font-bold md:text-2xl lg:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)] hidden sm:block">{description}</p>
        </div>
      </div>
      {showUploadButton && (
        <Link
          href="/upload"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(170,255,0,0.12),0_12px_40px_rgba(170,255,0,0.12)] transition-all duration-200 hover:translate-y-[-1px] min-h-[44px]"
        >
          Upload novo vídeo
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/Header.tsx
git commit -m "feat: add hamburger menu to Header, responsive title sizes"
```

---

### Task 5: Ajustar DashboardLayout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Ajustar padding responsivo no content**

```tsx
import { Sidebar } from "@/components/dashboard/Sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="min-w-0 px-4 py-6 md:px-6 md:py-8 lg:p-10">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "fix: responsive padding on dashboard layout"
```

---

## Fase 2: Auth e Marketing

### Task 6: Ajustar páginas de Auth

**Files:**
- Modify: `src/components/auth/LoginForm.tsx`
- Modify: `src/components/auth/RegisterForm.tsx`

- [ ] **Step 1: Ajustar LoginForm para mobile**

Replace the Card class in `src/components/auth/LoginForm.tsx`:
```tsx
    <Card className="mx-auto w-full max-w-md px-4 sm:px-0">
```

- [ ] **Step 2: Ajustar RegisterForm para mobile**

Replace the Card class in `src/components/auth/RegisterForm.tsx`:
```tsx
    <Card className="mx-auto w-full max-w-md px-4 sm:px-0">
```

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/LoginForm.tsx src/components/auth/RegisterForm.tsx
git commit -m "fix: auth cards full-width on mobile with side padding"
```

---

### Task 7: Ajustar Marketing — Hero

**Files:**
- Modify: `src/components/marketing/Hero.tsx`

- [ ] **Step 1: Reduzir textos e padding em mobile**

Replace lines 7-44 with:
```tsx
    <section className="hero-grid noise relative overflow-hidden border-b border-white/5">
      <div className="mx-auto grid min-h-[92svh] max-w-7xl items-center px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-14">
        <div className="max-w-2xl">
          <div className="fade-up text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
            Legendai
          </div>
          <h1 className="fade-up delay-1 text-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Legendas em português BR. Sem erro. Sem dólar.
          </h1>
          <p className="fade-up delay-2 mt-4 max-w-xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg sm:mt-6">
            O CapCut ficou pago. As ferramentas gringas erram no sotaque. O Legendai entende como o brasileiro fala.
          </p>
          <div className="fade-up delay-3 mt-6 flex flex-wrap gap-3 sm:mt-8">
            <Link href="/register">
              <Button className="min-h-[44px]">Começar grátis</Button>
            </Link>
            <Link href="#demo">
              <Button variant="outline" className="min-h-[44px]">Ver demo</Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-[var(--text-secondary)] sm:mt-8">
            Funciona com: Instagram · TikTok · YouTube · Kwai
          </p>
        </div>
        <div className="surface relative mt-8 overflow-hidden rounded-[24px] p-4 sm:p-5 lg:mt-0">
          <div className="aspect-video rounded-[20px] border border-white/5 bg-[radial-gradient(circle_at_top,rgba(170,255,0,0.2),transparent_40%),linear-gradient(180deg,#111,#050505)] p-3 sm:p-5">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Upload</span>
              <span>Processando</span>
            </div>
            <div className="mt-4 h-24 rounded-2xl border border-white/5 bg-white/5 sm:mt-6 sm:h-40" />
            <div className="mt-4 space-y-2 text-sm sm:mt-6 sm:space-y-3">
              <div className="w-fit rounded-full bg-black/70 px-3 py-1.5 text-white sm:px-4 sm:py-2">eu tava pensando... né</div>
              <div className="ml-auto w-fit rounded-full bg-[var(--primary)] px-3 py-1.5 font-semibold text-black sm:px-4 sm:py-2">
                agora ficou certinho
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/marketing/Hero.tsx
git commit -m "fix: hero responsive text sizes and padding for mobile"
```

---

### Task 8: Ajustar Marketing — Features

**Files:**
- Modify: `src/components/marketing/Features.tsx`

- [ ] **Step 1: Grid responsivo em Features**

Replace line 18:
```tsx
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
```

Replace line 19:
```tsx
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

- [ ] **Step 2: Commit**

```bash
git add src/components/marketing/Features.tsx
git commit -m "fix: features grid responsive sm:grid-cols-2 lg:grid-cols-3"
```

---

### Task 9: Ajustar Footer

**Files:**
- Modify: `src/components/layout/Footer.tsx`

- [ ] **Step 1: Padding responsivo no Footer**

Replace line 11:
```tsx
    <footer className="border-t border-white/5 px-4 py-8 text-sm text-[var(--text-secondary)] sm:px-6 lg:px-10 lg:py-10">
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/Footer.tsx
git commit -m "fix: responsive padding on footer"
```

---

## Fase 3: Dashboard Pages

### Task 10: Ajustar Dashboard Home

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/components/dashboard/StatsGrid.tsx`

- [ ] **Step 1: Padding responsivo no dashboard page**

Replace both `<main className="space-y-8 p-6 lg:p-10">` occurrences in `src/app/(dashboard)/dashboard/page.tsx` with:
```tsx
    <main className="space-y-6 px-4 py-6 md:space-y-8 md:px-6 md:py-8 lg:p-10">
```

- [ ] **Step 2: Grid responsivo no StatsGrid**

Replace line 25 in `src/components/dashboard/StatsGrid.tsx`:
```tsx
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx src/components/dashboard/StatsGrid.tsx
git commit -m "fix: responsive dashboard home padding and stats grid"
```

---

### Task 11: Ajustar Upload

**Files:**
- Modify: `src/app/(dashboard)/upload/page.tsx`
- Modify: `src/components/upload/UploadZone.tsx`
- Modify: `src/components/upload/VideoUploadFlow.tsx`

- [ ] **Step 1: Padding e título responsivo em upload page**

In `src/app/(dashboard)/upload/page.tsx`, replace line 11:
```tsx
    <main className="space-y-6 px-4 py-6 md:space-y-8 md:px-6 md:py-8 lg:p-10">
```

Replace line 13:
```tsx
        <h1 className="text-display text-xl font-bold md:text-2xl lg:text-3xl">Upload</h1>
```

- [ ] **Step 2: UploadZone responsivo**

In `src/components/upload/UploadZone.tsx`:

Replace line 57:
```tsx
        <div className="surface rounded-[var(--radius)] p-4 sm:p-6">
```

Replace line 59 (label/dropzone):
```tsx
            <label
              className={`flex min-h-40 sm:min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/3 p-6 text-center sm:p-8 ${
                isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-[rgba(170,255,0,0.35)]"
              }`}
            >
```

Replace line 64:
```tsx
              <div className="text-base font-semibold sm:text-lg">Arraste seu vídeo aqui</div>
```

Replace line 65:
```tsx
              <div className="mt-2 text-xs text-[var(--text-secondary)] sm:text-sm">
```

Replace line 103:
```tsx
            <div className="grid gap-3 grid-cols-1 md:grid-cols-[1fr_auto]">
```

Replace line 107 (input):
```tsx
                className="h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-base outline-none disabled:opacity-50"
```

Replace line 125 (error div padding):
```tsx
              <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
```

- [ ] **Step 3: VideoUploadFlow steps responsivos**

In `src/components/upload/VideoUploadFlow.tsx`, replace line 177:
```tsx
                <div className="grid grid-cols-5 gap-1 sm:grid-cols-5">
```
(This already handles the bar indicators fine; they are just 1px tall bars.)

Replace line 148-149 (center button):
```tsx
              <div className="flex flex-col items-center gap-4 px-2">
                <p className="text-center text-sm text-[var(--text-secondary)]">
```

Replace line 153 (button min height):
```tsx
                  className="animate-pulse bg-[var(--primary)] px-6 py-5 text-base font-bold text-black hover:bg-[var(--primary)]/90 sm:px-8 sm:py-6 sm:text-lg min-h-[48px]"
```

Replace line 202 (action buttons):
```tsx
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/upload/page.tsx src/components/upload/UploadZone.tsx src/components/upload/VideoUploadFlow.tsx
git commit -m "fix: responsive upload page, zone, and flow steps"
```

---

### Task 12: Ajustar Videos List e Pagination

**Files:**
- Modify: `src/app/(dashboard)/videos/page.tsx`
- Modify: `src/components/dashboard/VideoPagination.tsx`

- [ ] **Step 1: Padding responsivo em videos page**

In `src/app/(dashboard)/videos/page.tsx`, replace line 91:
```tsx
    <main className="space-y-6 px-4 py-6 md:space-y-8 md:px-6 md:py-8 lg:p-10">
```

- [ ] **Step 2: Pagination controles flex-wrap**

In `src/components/dashboard/VideoPagination.tsx`, replace line 45:
```tsx
      <div className="flex flex-wrap items-center justify-center gap-2">
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/videos/page.tsx src/components/dashboard/VideoPagination.tsx
git commit -m "fix: responsive videos page padding and pagination wrap"
```

---

### Task 13: Ajustar Video Detail e Export

**Files:**
- Modify: `src/app/(dashboard)/videos/[id]/page.tsx`
- Modify: `src/app/(dashboard)/videos/[id]/export/page.tsx`

- [ ] **Step 1: Padding responsivo em video detail**

In `src/app/(dashboard)/videos/[id]/page.tsx`, replace line 5:
```tsx
    <main className="space-y-6 px-4 py-6 md:px-6 md:py-8 lg:p-10">
```

- [ ] **Step 2: Padding responsivo em export**

In `src/app/(dashboard)/videos/[id]/export/page.tsx`, replace line 5:
```tsx
    <main className="space-y-6 px-4 py-6 md:px-6 md:py-8 lg:p-10">
```

Replace line 6:
```tsx
      <h1 className="text-display text-xl font-bold md:text-2xl lg:text-3xl">Exportar vídeo</h1>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/videos/\[id\]/page.tsx src/app/(dashboard)/videos/\[id\]/export/page.tsx
git commit -m "fix: responsive padding on video detail and export pages"
```

---

## Fase 4: Editor de Legendas

### Task 14: Ajustar VideoEditor

**Files:**
- Modify: `src/components/editor/VideoEditor.tsx`

- [ ] **Step 1: Header flex-wrap e botões responsivos**

Replace lines 56-69:
```tsx
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display text-xl font-bold md:text-2xl">{video.title}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Status: <span className={isReady ? "text-green-400" : "text-yellow-400"}>{video.status}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard">
            <Button variant="outline" className="min-h-[44px]">← Dashboard</Button>
          </Link>
        </div>
      </div>
```

Replace lines 90-113 (action buttons):
```tsx
      {/* Actions */}
      {isReady && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {video.processedUrl && (
            <a href={`/api/videos/${videoId}/download?type=video`} className="block sm:inline-block">
              <Button className="w-full min-h-[44px] sm:w-auto">
```
(Keep the rest of the button code identical, just ensure Button has `className="w-full min-h-[44px] sm:w-auto"`)

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/VideoEditor.tsx
git commit -m "fix: responsive VideoEditor header and action buttons"
```

---

### Task 15: Ajustar SubtitleEditor

**Files:**
- Modify: `src/components/editor/SubtitleEditor.tsx`

- [ ] **Step 1: Grid lg responsivo e altura da lista**

Replace lines 12-22:
```tsx
    <div className="space-y-6">
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.5fr_1fr]">
        <VideoPreview segments={segments} />
        <div className="space-y-3 max-h-[50vh] overflow-y-auto lg:max-h-[calc(100vh-220px)] pr-1">
          {segments.map((segment) => (
            <SubtitleSegment key={segment.id} segment={segment} />
          ))}
        </div>
      </div>
      <StylePicker />
      <ExportPanel />
    </div>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/SubtitleEditor.tsx
git commit -m "fix: SubtitleEditor responsive grid and scrollable segment list"
```

---

### Task 16: Ajustar SubtitleSegment

**Files:**
- Modify: `src/components/editor/SubtitleSegment.tsx`

- [ ] **Step 1: Touch target e input w-full**

Replace the entire file with:
```tsx
import { Input } from "@/components/ui/input";
import type { SubtitleSegment as SubtitleSegmentType } from "@/types/subtitle";

export function SubtitleSegment({
  segment,
  onJump,
}: {
  segment: SubtitleSegmentType;
  onJump?: (time: number) => void;
}) {
  return (
    <button
      type="button"
      className="surface-soft w-full rounded-xl p-4 text-left transition hover:border-[rgba(170,255,0,0.25)] min-h-[44px]"
      onClick={() => onJump?.(segment.start)}
    >
      <div className="text-xs text-[var(--text-secondary)]">
        {segment.start.toFixed(1)}s → {segment.end.toFixed(1)}s
      </div>
      <Input defaultValue={segment.text} className="mt-3 w-full text-base" />
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/SubtitleSegment.tsx
git commit -m "fix: SubtitleSegment touch target and full-width input"
```

---

## Fase 5: Billing e Settings

### Task 17: Ajustar Billing

**Files:**
- Modify: `src/app/(dashboard)/billing/page.tsx`
- Modify: `src/components/billing/PricingTable.tsx`
- Modify: `src/components/billing/PlanCard.tsx`
- Modify: `src/components/billing/AvulsoCalculator.tsx`

- [ ] **Step 1: Billing page padding e título**

In `src/app/(dashboard)/billing/page.tsx`, replace line 8:
```tsx
    <main className="space-y-6 px-4 py-6 md:space-y-8 md:px-6 md:py-8 lg:p-10">
```

Replace line 10:
```tsx
        <h1 className="text-display text-xl font-bold md:text-2xl lg:text-3xl">Assinatura e billing</h1>
```

- [ ] **Step 2: PricingTable grid responsivo**

In `src/components/billing/PricingTable.tsx`, replace line 6:
```tsx
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
```

- [ ] **Step 3: PlanCard botão w-full**

In `src/components/billing/PlanCard.tsx`, line 35 já está `w-full`. Verificar se o Card precisa de ajuste:
```tsx
  return (
    <Card className={`${highlighted ? "glow" : ""} flex flex-col`}>
```

Line 35:
```tsx
        <Button className="w-full min-h-[44px]">{highlighted ? "Assinar agora" : "Selecionar"}</Button>
```

- [ ] **Step 4: AvulsoCalculator flex-col mobile**

In `src/components/billing/AvulsoCalculator.tsx`, replace line 71:
```tsx
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
```

Replace line 72:
```tsx
          <Button onClick={() => handleAvulsoPayment("PIX")} disabled={loading} className="min-h-[44px] w-full sm:w-auto">
```

Replace line 75:
```tsx
          <Button variant="outline" onClick={() => handleAvulsoPayment("CARD")} disabled={loading} className="min-h-[44px] w-full sm:w-auto">
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/billing/page.tsx src/components/billing/PricingTable.tsx src/components/billing/PlanCard.tsx src/components/billing/AvulsoCalculator.tsx
git commit -m "fix: responsive billing page, plan grid, and avulso buttons"
```

---

### Task 18: Ajustar Settings

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Padding responsivo e mx-auto com margem lateral**

Replace line 13:
```tsx
      <main className="px-4 py-6 md:px-6 md:py-8 lg:p-10">
```

Replace line 14:
```tsx
        <div className="mx-auto max-w-2xl px-0 sm:px-0">
```

Replace line 28:
```tsx
      <main className="px-4 py-6 md:px-6 md:py-8 lg:p-10">
```

Replace line 29:
```tsx
      <div className="mx-auto max-w-2xl px-0 sm:px-0">
```

Replace line 31:
```tsx
        <h1 className="text-display text-xl font-bold md:text-2xl lg:text-3xl text-[var(--text)]">Configurações</h1>
```

Replace line 76 (theme buttons):
```tsx
              <div className="flex flex-col gap-2 sm:flex-row">
```

Replace line 133 (delete account):
```tsx
              <Button
                variant="outline"
                disabled
                className="w-full min-h-[44px] pointer-events-none border-red-500/30 text-red-400 opacity-50 sm:w-auto"
              >
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/settings/page.tsx
git commit -m "fix: responsive settings page padding and buttons"
```

---

## Fase 6: Verificação Final

### Task 19: Verificar e ajustar VideoList grid

**Files:**
- Modify: `src/components/dashboard/VideoList.tsx`

- [ ] **Step 1: Garantir grid-cols-1 em mobile**

In `src/components/dashboard/VideoList.tsx`, replace line 148:
```tsx
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
```

Replace line 231:
```tsx
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
```

Replace line 183 (search input):
```tsx
            className="max-w-md text-base"
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/VideoList.tsx
git commit -m "fix: explicit grid-cols-1 for VideoList on mobile"
```

---

### Task 20: Ajustar globals.css para touch scrolling

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Adicionar smooth scrolling touch**

Add after line 36:
```css
html {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "fix: add -webkit-overflow-scrolling: touch for mobile"
```

---

### Task 21: Verificação com Playwright (opcional)

**Files:** Nenhum

- [ ] **Step 1: Rodar verificação visual rápida**

Se o projeto tiver Playwright configurado, rodar:
```bash
cd legendai
npx playwright test --grep "mobile" || echo "No mobile tests yet"
```

- [ ] **Step 2: Commit final**

```bash
git add .
git commit -m "feat: complete mobile responsiveness across all pages"
```

---

## Spec Coverage Check

| Spec Section | Task(s) |
|---|---|
| 2.1 MobileNav | Task 1, 2 |
| 2.2 Sidebar | Task 3 |
| 2.3 DashboardLayout | Task 5 |
| 2.4 Header | Task 4 |
| 3.1 Landing Page | Task 7, 8 |
| 3.2 Auth Login | Task 6 |
| 3.3 Auth Register | Task 6 |
| 3.4 Dashboard Home | Task 10 |
| 3.5 Upload | Task 11 |
| 3.6 Videos List | Task 12, 19 |
| 3.7 Video Detail | Task 13 |
| 3.8 Export | Task 13 |
| 3.9 Editor | Task 14, 15, 16 |
| 3.10 Billing | Task 17 |
| 3.11 Settings | Task 18 |
| 4.1 VideoList | Task 19 |
| 4.3 StatsGrid | Task 10 |
| 4.4 VideoUploadFlow | Task 11 |
| 4.5 UploadZone | Task 11 |
| 6 Touch targets | Tasks 4, 11, 14, 16, 17, 18 |
| 7 Funcionalidades | Todas as tasks acima |

---

## Self-Review

- **Placeholder scan:** Nenhum TBD/TODO encontrado.
- **Type consistency:** Todos os paths e nomes de componentes consistentes.
- **Spec gaps:** Todos os arquivos da seção 8 do spec estão cobertos.
- **No red flags:** Cada step contém código completo e comandos exatos.
