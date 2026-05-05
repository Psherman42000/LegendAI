import type { TranscriptionSegment } from "@/types/subtitle";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const API_KEY = process.env.GEMINI_API_KEY;

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

export async function correctWithGemini(
  segments: TranscriptionSegment[]
): Promise<TranscriptionSegment[]> {
  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: JSON.stringify(segments) }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  // Extract text from Gemini response format
  const candidate = data.candidates?.[0];
  const rawText = candidate?.content?.parts?.[0]?.text?.trim() || "";

  if (!rawText) {
    throw new Error("Gemini returned empty response");
  }

  // Extract JSON from markdown code blocks if present
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonString = jsonMatch ? jsonMatch[1] : rawText;

  const parsed = JSON.parse(jsonString);

  if (!isValidTranscriptionResponse(parsed)) {
    throw new Error("Invalid segment structure returned from Gemini");
  }

  return parsed;
}
