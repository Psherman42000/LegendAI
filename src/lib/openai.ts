import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

export async function generateSubtitleInsights(text: string): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) {
    return text
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5);
  }

  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    input: `Resuma as melhores palavras-chave do conteúdo: ${text}`,
  });

  return response.output_text.split("\n").map((item) => item.trim()).filter(Boolean);
}
