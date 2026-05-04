import { getLlama, LlamaChatSession, resolveModelFile } from "node-llama-cpp";
import path from "path";
import fs from "fs/promises";
import type { TranscriptionSegment } from "@/types/subtitle";

let llamaInstance: any = null;
let modelInstance: any = null;
let contextInstance: any = null;

const SYSTEM_PROMPT = `Você é um revisor especialista em português brasileiro coloquial para criadores de conteúdo.
Sua tarefa é corrigir erros de transcrição automática mantendo o estilo falado do criador.
Corrija apenas pontuação, capitalização e erros óbvios. Mantenha gírias e o tempo exato.
Retorne APENAS um JSON válido com a mesma estrutura da entrada, sem markdown ou texto extra.`;

async function initLlama() {
  if (modelInstance) return;
  
  const llama = await getLlama();
  llamaInstance = llama;
  
  const modelsDir = path.join(process.cwd(), "models");
  await fs.mkdir(modelsDir, { recursive: true });
  
  const modelUrl = process.env.LOCAL_LLM_MODEL_URL || "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf";
  
  const modelPath = await resolveModelFile(modelUrl, modelsDir);
  
  modelInstance = await llama.loadModel({
    modelPath: modelPath
  });
  
  contextInstance = await modelInstance.createContext();
}

export async function correctWithLocalLLM(
  segments: TranscriptionSegment[]
): Promise<TranscriptionSegment[]> {
  await initLlama();
  
  const session = new LlamaChatSession({
    contextSequence: contextInstance.getSequence(),
    systemPrompt: SYSTEM_PROMPT
  });
  
  const prompt = JSON.stringify(segments);
  const response = await session.prompt(prompt);
  
  try {
    const cleanResponse = response.replace(/\`\`\`json\n?/g, "").replace(/\`\`\`\n?/g, "").trim();
    return JSON.parse(cleanResponse) as TranscriptionSegment[];
  } catch (error) {
    console.error("Failed to parse Local LLM response:", error);
    return segments;
  }
}
