import { GoogleGenAI } from "@google/genai";
import { ChatMessage, EdiAnalysisResult, EdiFile, FixResult, LineError } from '../types';

const MODEL_TEXT_BASIC = 'gemini-3-flash-preview';
const MODEL_TEXT_COMPLEX = 'gemini-3-pro-preview';
const MODEL_IMAGE = 'gemini-3-pro-image-preview';
const MODEL_VIDEO = 'veo-3.1-fast-generate-preview';

const SYSTEM_INSTRUCTION_COPILOT = `
You are "EDI Studio Copilot", a senior EDI architect and AI assistant.
Always treat the currently opened file as the primary source of truth.
Silence commentary by default. Raw EDI for changes, markdown for explanations.
Recalculate SE/UNT counts and maintain control number consistency.
`;

const SYSTEM_INSTRUCTION_FIXER = `
You are the Inline EDI Validation Engine. Return JSON: { "line": num, "segment": "ID", "element": "ID", "message": "msg", "reason": "why", "fix": "corrected_segment", "explanation": "why_fix" }
`;

const SYSTEM_INSTRUCTION_VALIDATOR = `
Full X12/EDIFACT Validation + Auto-Fix Engine. Return JSON array of errors.
`;

const getGeminiAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

/**
 * Generic fetch wrapper for DeepSeek (OpenAI compatible)
 */
async function callDeepSeek(messages: any[], systemPrompt: string, responseJson: boolean = false) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DeepSeek API Key missing from environment.");

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
      response_format: responseJson ? { type: "json_object" } : { type: "text" }
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "DeepSeek API Error");
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export const hasValidApiKey = (provider: 'gemini' | 'deepseek' = 'gemini'): boolean => {
    if (provider === 'gemini') return !!process.env.API_KEY;
    return !!process.env.DEEPSEEK_API_KEY;
};

export const generateEdiFlowImage = async (prompt: string): Promise<string> => {
  const ai = getGeminiAi();
  // Refined prompt for Transaction Flow Diagrams between Client and TP
  const diagramPrompt = `
    Create a clean, professional EDI Transaction Flow Diagram. 
    The diagram must show the document exchange between a 'Client' and a 'Trading Partner (TP)'.
    Visual style: Flat vector icons (e.g., factory icon for Seller, person for Buyer, warehouse/truck for 3PL).
    Content: ${prompt}.
    Use simple arrows labeled with EDI transaction codes like 850, 856, 940, 945, 810.
    Background should be deep purple or white (minimalist).
    No complex photographic elements. Focus on clear connectivity and flow.
  `;
  
  const response = await ai.models.generateContent({
    model: MODEL_IMAGE,
    contents: { parts: [{ text: diagramPrompt }] },
    config: { imageConfig: { aspectRatio: "16:9", imageSize: "1K" } }
  });
  
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) return part.inlineData.data;
  }
  throw new Error("No image generated.");
};

export const generateEdiFlowVideo = async (prompt: string): Promise<string> => {
  const ai = getGeminiAi();
  if (!(await window.aistudio.hasSelectedApiKey())) await window.aistudio.openSelectKey();
  
  const videoPrompt = `
    High-quality animated motion graphics showing an EDI Transaction Flow.
    Exchange between 'Client' and 'Trading Partner (TP)'.
    Show documents (850, 855, 856, etc.) moving along arrows between entities.
    Style: Corporate minimalist, vector-based, clean lines, professional purple/blue color palette.
    Scenario: ${prompt}
  `;

  let operation = await ai.models.generateVideos({
    model: MODEL_VIDEO,
    prompt: videoPrompt,
    config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
  });
  while (!operation.done) {
    await new Promise(r => setTimeout(r, 10000));
    operation = await ai.operations.getVideosOperation({ operation });
  }
  const link = operation.response?.generatedVideos?.[0]?.video?.uri;
  const res = await fetch(`${link}&key=${process.env.API_KEY}`);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });
};

export const sendEdiChat = async (
    history: ChatMessage[], 
    newMessage: string, 
    contextFiles: EdiFile[], 
    options?: { useThinking?: boolean, useSearch?: boolean, provider?: 'gemini' | 'deepseek' }
): Promise<{ text: string, sources?: any[] }> => {
  const provider = options?.provider || 'gemini';

  if (provider === 'deepseek') {
    const context = contextFiles.map(f => `FILE: ${f.name}\n${f.content}\n`).join("\n");
    const messages = history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text }));
    messages.push({ role: 'user', content: `Context Files:\n${context}\n\nUser Question: ${newMessage}` });
    const text = await callDeepSeek(messages, SYSTEM_INSTRUCTION_COPILOT);
    return { text };
  }

  // Gemini logic
  const ai = getGeminiAi();
  const model = options?.useThinking ? MODEL_TEXT_COMPLEX : MODEL_TEXT_BASIC;
  const config: any = { systemInstruction: SYSTEM_INSTRUCTION_COPILOT };
  if (options?.useThinking) config.thinkingConfig = { thinkingBudget: 24576 };
  if (options?.useSearch && !options?.useThinking) config.tools = [{ googleSearch: {} }];

  const chat = ai.chats.create({
    model,
    config,
    history: history.filter(h => !h.image && !h.video).map(h => ({ 
      role: h.role === 'model' ? 'model' : 'user', 
      parts: [{ text: h.text }] 
    }))
  });

  const parts: any[] = [];
  contextFiles.forEach(f => {
    if (f.mimeType === 'application/pdf') parts.push({ inlineData: { mimeType: f.mimeType, data: f.content } });
    else parts.push({ text: `FILE: ${f.name}\n${f.content}\n` });
  });
  parts.push({ text: newMessage });

  const result = await chat.sendMessage({ message: parts });
  const sources = result.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web ? { uri: c.web.uri, title: c.web.title } : null).filter(s => s);
  return { text: result.text || "", sources };
};

export const analyzeEdiContent = async (content: string, provider: 'gemini' | 'deepseek' = 'gemini'): Promise<EdiAnalysisResult> => {
  const prompt = `Analyze this EDI and return JSON analysis: ${content.substring(0, 10000)}`;
  if (provider === 'deepseek') {
    const text = await callDeepSeek([{ role: "user", content: prompt }], "Analyze EDI and return JSON", true);
    return JSON.parse(text);
  }
  const ai = getGeminiAi();
  const response = await ai.models.generateContent({
    model: MODEL_TEXT_BASIC,
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "{}");
};

export const validateEdiContent = async (content: string, provider: 'gemini' | 'deepseek' = 'gemini'): Promise<LineError[]> => {
  const prompt = `Validate EDI and return JSON array: ${content.substring(0, 5000)}`;
  if (provider === 'deepseek') {
    const text = await callDeepSeek([{ role: "user", content: prompt }], SYSTEM_INSTRUCTION_VALIDATOR, true);
    return JSON.parse(text);
  }
  const ai = getGeminiAi();
  const response = await ai.models.generateContent({
    model: MODEL_TEXT_BASIC,
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION_VALIDATOR, responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "[]");
};

export const generateEdiFix = async (seg: string, err: string, ctx: string, provider: 'gemini' | 'deepseek' = 'gemini'): Promise<FixResult | null> => {
  const prompt = `Error: ${err}\nSegment: ${seg}\nContext: ${ctx}`;
  try {
    if (provider === 'deepseek') {
        const text = await callDeepSeek([{ role: "user", content: prompt }], SYSTEM_INSTRUCTION_FIXER, true);
        const res = JSON.parse(text);
        return { segment: res.fix, explanation: res.explanation };
    }
    const ai = getGeminiAi();
    const response = await ai.models.generateContent({
      model: MODEL_TEXT_BASIC,
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION_FIXER, responseMimeType: "application/json" }
    });
    const res = JSON.parse(response.text || "{}");
    return { segment: res.fix, explanation: res.explanation };
  } catch { return null; }
};

export const translateEdiToHuman = async (edi: string, provider: 'gemini' | 'deepseek' = 'gemini') => {
  const prompt = `Translate to human readable markdown:\n${edi.substring(0, 8000)}`;
  if (provider === 'deepseek') {
      return await callDeepSeek([{ role: "user", content: prompt }], "Translate EDI to Human");
  }
  const ai = getGeminiAi();
  const response = await ai.models.generateContent({
    model: MODEL_TEXT_BASIC,
    contents: prompt
  });
  return response.text || "";
};

export const convertEdiToFormat = async (edi: string, fmt: string, provider: 'gemini' | 'deepseek' = 'gemini') => {
  const prompt = `Convert to ${fmt} (raw output only):\n${edi.substring(0, 5000)}`;
  if (provider === 'deepseek') {
      return await callDeepSeek([{ role: "user", content: prompt }], "Convert EDI to Format");
  }
  const ai = getGeminiAi();
  const response = await ai.models.generateContent({
    model: MODEL_TEXT_BASIC,
    contents: prompt
  });
  return response.text || "";
};

export const generateSampleEdi = async (type: string, provider: 'gemini' | 'deepseek' = 'gemini') => {
  const prompt = `Generate a valid ${type} EDI file (raw output only).`;
  if (provider === 'deepseek') {
      return await callDeepSeek([{ role: "user", content: prompt }], "EDI Generator");
  }
  const ai = getGeminiAi();
  const response = await ai.models.generateContent({
    model: MODEL_TEXT_BASIC,
    contents: prompt
  });
  return response.text || "";
};

export const generateRelatedTransaction = async (src: string, type: string, provider: 'gemini' | 'deepseek' = 'gemini') => {
  const prompt = `Based on this EDI, generate matching ${type}:\n${src.substring(0, 5000)}`;
  if (provider === 'deepseek') {
      return await callDeepSeek([{ role: "user", content: prompt }], "EDI Relation Generator");
  }
  const ai = getGeminiAi();
  const response = await ai.models.generateContent({
    model: MODEL_TEXT_BASIC,
    contents: prompt
  });
  return response.text || "";
};

export const generateXsltWithAi = async (src: string, target: string, type: string, provider: 'gemini' | 'deepseek' = 'gemini') => {
  const prompt = `Generate XSLT for EDI: ${src}\nSchema: ${target}`;
  if (provider === 'deepseek') {
      return await callDeepSeek([{ role: "user", content: prompt }], "XSLT Developer");
  }
  const ai = getGeminiAi();
  const response = await ai.models.generateContent({
    model: MODEL_TEXT_COMPLEX,
    contents: prompt
  });
  return response.text || "";
};

export const extractValidationRules = async (spec: any, provider: 'gemini' | 'deepseek' = 'gemini') => {
  const prompt = `Extract JSON array of TPRules from spec: ${typeof spec === 'string' ? spec : 'File data provided'}`;
  if (provider === 'deepseek') {
      const text = await callDeepSeek([{ role: "user", content: prompt }], "Return JSON array of TPRules.", true);
      return JSON.parse(text);
  }
  const ai = getGeminiAi();
  const response = await ai.models.generateContent({
    model: MODEL_TEXT_COMPLEX,
    contents: prompt,
    config: { systemInstruction: "Return JSON array of TPRules.", responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "[]");
};

export const explainEdiDiff = async (diff: string, provider: 'gemini' | 'deepseek' = 'gemini') => {
  const prompt = `Explain business impact of these EDI changes:\n${diff}`;
  if (provider === 'deepseek') {
      return await callDeepSeek([{ role: "user", content: prompt }], "EDI Auditor");
  }
  const ai = getGeminiAi();
  const response = await ai.models.generateContent({
    model: MODEL_TEXT_BASIC,
    contents: prompt
  });
  return response.text || "";
};

// Add generateStediGuideJson to support Stedi integration
export const generateStediGuideJson = async (content: string): Promise<string> => {
  const ai = getGeminiAi();
  const response = await ai.models.generateContent({
    model: MODEL_TEXT_BASIC,
    contents: `Convert this EDI content to Stedi Guide JSON format for outbound transaction generation. Return only valid JSON. Content: ${content.substring(0, 10000)}`,
    config: { responseMimeType: "application/json" }
  });
  return response.text || "{}";
};
