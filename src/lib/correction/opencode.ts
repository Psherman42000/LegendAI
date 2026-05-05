import { getOpencodeClient } from "../opencode";
import type { TranscriptionSegment } from "@/types/subtitle";

const MODEL = process.env.OPENCODE_MODEL || "opencode-go/deepseek-v4-flash";

const SYSTEM_PROMPT = `Você é um revisor especialista em português brasileiro coloquial para criadores de conteúdo.
Sua tarefa é corrigir erros de transcrição automática mantendo o estilo falado do criador.

REGRAS OBRIGATÓRIAS:
1. Corrija TODOS os erros fonéticos do Whisper em PT-BR — o Whisper frequentemente troca:
   - "legenda" → "leginda", "legendador" → "legindador"
   - "não é" ↔ "né" (contexto coloquial)
   - "para" ↔ "pra" (contexto coloquial)
   - "está" ↔ "tá" (contexto coloquial)
   - "você" ↔ "cê" (contexto coloquial)
   - "a gente" ↔ "agente" (contexto)
   - Nomes próprios brasileiros: Anitta, Flamengo, Nubank, etc.
2. Mantenha expressões coloquiais: "né", "tá", "pra", "tô", "tava", "num" (= não), "cê" (= você)
3. Adicione pontuação natural onde falta (vírgulas, pontos finais, reticências)
4. NÃO formalize a linguagem — mantenha o tom falado
5. NÃO altere o timing dos segmentos
6. NÃO mude o significado de nenhuma frase
7. Se uma palavra parece errada no contexto, corrija — o Whisper erra muito em PT-BR

Retorne JSON com a mesma estrutura dos segmentos de entrada, apenas com os textos corrigidos.
Preserve os campos \`start\`, \`end\` e \`words\` exatamente como receber.`;

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
  const opencodeClient = await getOpencodeClient();
  try {
    const { data: session, error: createError } = await opencodeClient.session.create({});
    if (createError || !session) {
      throw new Error("Failed to create OpenCode session");
    }
    sessionId = session.id;

    const { data: response, error: promptError } = await opencodeClient.session.prompt({
      path: { id: sessionId },
      body: {
        model: getModel(MODEL),
        system: SYSTEM_PROMPT,
        parts: [{ type: "text", text: JSON.stringify(segments) }],
      },
    });

    if (promptError || !response) {
      throw new Error("Failed to prompt OpenCode session");
    }

    const parts: Array<{ type: string; text?: string }> = response.parts;
    const textParts = parts.filter((p) => p.type === "text");
    const rawText = textParts.map((p) => p.text ?? "").join("").trim();
    
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
