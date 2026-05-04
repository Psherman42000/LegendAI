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
    throw new Error(`Invalid model format: ${modelString}. Expected providerID/modelID`);
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
  let sessionId: string | undefined;
  try {
    const { data: session, error: createError } = await opencodeClient.session.create({});
    if (createError || !session) {
      throw new Error("Failed to create OpenCode session");
    }
    sessionId = session.id;

    const { data: response, error: promptError } = await opencodeClient.session.prompt({
      path: { id: sessionId },
      body: {
        agent: "general",
        model: getModel(MODEL),
        system: SYSTEM_PROMPT,
        parts: [{ type: "text", text: JSON.stringify(segments) }],
      },
    });

    if (promptError || !response) {
      throw new Error("Failed to prompt OpenCode session");
    }

    const textParts = response.parts.filter((p: any) => p.type === "text");
    const rawText = textParts.map((p: any) => p.text).join("").trim();
    
    if (!rawText) {
      console.warn("[Correction] OpenCode returned empty response");
      throw new Error("OpenCode returned empty response");
    }

    // Extract JSON from markdown code blocks if present
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : rawText;

    const parsed = JSON.parse(jsonString);
    
    if (!isValidTranscriptionResponse(parsed)) {
      console.warn("[Correction] OpenCode returned invalid segment structure");
      throw new Error("Invalid segment structure returned from OpenCode");
    }

    return parsed;
  } catch (error) {
    console.error("[Correction] OpenCode correction failed:", error);
    throw error;
  } finally {
    if (sessionId) {
      try {
        await opencodeClient.session.delete({ path: { id: sessionId } });
      } catch (cleanupError) {
        console.error("[Correction] Failed to cleanup OpenCode session:", cleanupError);
      }
    }
  }
}
