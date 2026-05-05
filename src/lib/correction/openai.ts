import { openai } from "../openai";
import type { TranscriptionSegment } from "@/types/subtitle";

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

export async function correctWithOpenAI(
  segments: TranscriptionSegment[]
): Promise<TranscriptionSegment[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify(segments),
      },
    ],
  });

  const rawText = response.output_text.trim();
  try {
    const parsed = JSON.parse(rawText) as TranscriptionSegment[];
    return parsed;
  } catch {
    return segments.map((segment) => ({ ...segment, text: rawText || segment.text }));
  }
}
