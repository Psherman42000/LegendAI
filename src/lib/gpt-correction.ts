import { openai } from "./openai";
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
  if (!process.env.OPENAI_API_KEY) {
    return segments;
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
