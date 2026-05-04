import { opencodeClient } from "../opencode";
import type { TranscriptionSegment } from "@/types/subtitle";

const MODEL = process.env.OPENCODE_MODEL || "opencode-go/deepseek-v4-flash";

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

function getModel(modelString: string) {
  const parts = modelString.split("/");
  if (parts.length < 2) {
    throw new Error(\`Invalid model format: \${modelString}. Expected providerID/modelID\`);
  }
  return {
    providerID: parts[0],
    modelID: parts.slice(1).join("/"),
  };
}

function isValidSegment(data: unknown): data is TranscriptionSegment {
  return (
    typeof data === "object" &&
    data !== null &&
    "start" in data &&
    "end" in data &&
    "text" in data
  );
}

function isValidTranscriptionResponse(data: unknown): data is TranscriptionSegment[] {
  return Array.isArray(data) && data.every(isValidSegment);
}

export async function correctWithOpenCode(
  segments: TranscriptionSegment[]
): Promise<TranscriptionSegment[]> {
  let session;
  try {
    session = await opencodeClient.session.create({
      body: {
        agent: "general",
        model: getModel(MODEL),
        prompt: SYSTEM_PROMPT,
      },
    });

    const response = await session.prompt({
      body: {
        prompt: JSON.stringify(segments),
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) {
      console.warn("[Correction] OpenCode returned empty response");
      return segments;
    }

    // Extract JSON from markdown code blocks if present
    const jsonMatch = rawText.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/);
    const jsonString = jsonMatch ? jsonMatch[1] : rawText;

    const parsed = JSON.parse(jsonString);
    
    if (!isValidTranscriptionResponse(parsed)) {
      console.warn("[Correction] OpenCode returned invalid segment structure");
      return segments;
    }

    return parsed;
  } catch (error) {
    console.error("[Correction] OpenCode correction failed:", error);
    return segments;
  } finally {
    if (session) {
      try {
        await session.delete();
      } catch (cleanupError) {
        console.error("[Correction] Failed to cleanup OpenCode session:", cleanupError);
      }
    }
  }
}
