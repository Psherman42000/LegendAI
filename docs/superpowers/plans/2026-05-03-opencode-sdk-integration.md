# OpenCode SDK Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the OpenAI SDK with the OpenCode SDK (`@opencode-ai/sdk`) to perform subtitle correction using the `opencode-go/deepseek-v4-flash` model.

**Architecture:** We will install the `@opencode-ai/sdk`, create a new client instance pointing to the local OpenCode server, and update the `correctTranscription` function to create a temporary session and send the prompt using the OpenCode SDK.

**Tech Stack:** Next.js, TypeScript, `@opencode-ai/sdk`

---

### Task 1: Install OpenCode SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

Run: `npm install @opencode-ai/sdk`
Expected: PASS

### Task 2: Create OpenCode Client

**Files:**
- Create: `src/lib/opencode.ts`

- [ ] **Step 1: Create the OpenCode client instance**

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk";

// Initialize the client pointing to the local OpenCode server
export const opencodeClient = createOpencodeClient({
  baseUrl: process.env.OPENCODE_BASE_URL || "http://127.0.0.1:4096",
});
```

### Task 3: Update Subtitle Correction Logic

**Files:**
- Modify: `src/lib/gpt-correction.ts`

- [ ] **Step 1: Update the `correctTranscription` function to use OpenCode SDK**

```typescript
import { opencodeClient } from "./opencode";
import type { TranscriptionSegment } from "@/types/subtitle";

const SYSTEM_PROMPT = `Você é um revisor especialista em português brasileiro coloquial para criadores de conteúdo.
Sua tarefa é corrigir erros de transcrição automática mantendo o estilo falado do criador.

REGRAS OBRIGATÓRIAS:
1. Mantenha expressões coloquiais: "né", "tá", "pra", "tô", "tava", "num" (= não), "cê" (= você)
2. Corrija apenas erros CLAROS de transcrição — não formalize a linguagem
3. Preserve nomes próprios brasileiros: Anitta, Flamengo, Nubank, Mercado Livre, Receita Federal, etc.
4. Adicione pontuação natural onde falta (vírgulas, pontos finais, reticências)
5. Corrija confusões fonéticas comuns do Whisper em PT-BR:
   - "não é" → "né" quando no contexto coloquial
   - "para" → "pra" quando no contexto coloquial
   - "está" → "tá" quando no contexto coloquial  
   - "você" → "cê" quando no contexto coloquial
   - "a gente" vs "agente" — atenção ao contexto
6. Mantenha gírias regionais como estão
7. NÃO altere o timing dos segmentos
8. NÃO mude o significado de nenhuma frase

Retorne JSON com a mesma estrutura dos segmentos de entrada, apenas com os textos corrigidos.`;

export async function correctTranscription(
  segments: TranscriptionSegment[],
): Promise<TranscriptionSegment[]> {
  try {
    // Create a temporary session for the prompt
    const session = await opencodeClient.session.create({ body: {} });
    
    if (!session.data?.id) {
      throw new Error("Failed to create OpenCode session");
    }

    // Send the prompt to the OpenCode server
    const response = await opencodeClient.session.prompt({
      path: { id: session.data.id },
      body: {
        model: "opencode-go/deepseek-v4-flash",
        parts: [
          { type: "text", text: SYSTEM_PROMPT + "\n\n" + JSON.stringify(segments) }
        ],
      },
    });

    // Clean up the session
    await opencodeClient.session.delete({ path: { id: session.data.id } });

    // Extract the text from the response
    // The response structure contains parts with the text
    const responseText = response.data?.parts?.find(p => p.type === "text")?.text || "";
    const rawText = responseText.trim();
    
    // Try to parse the JSON response
    // Sometimes models wrap JSON in markdown blocks
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
    const jsonString = jsonMatch[1];
    
    const parsed = JSON.parse(jsonString) as TranscriptionSegment[];
    return parsed;
  } catch (error) {
    console.error("Error correcting transcription with OpenCode:", error);
    return segments;
  }
}
```

- [ ] **Step 2: Commit the changes**

```bash
git add package.json package-lock.json src/lib/opencode.ts src/lib/gpt-correction.ts
git commit -m "feat: integrate OpenCode SDK for subtitle correction using deepseek-v4-flash"
```
