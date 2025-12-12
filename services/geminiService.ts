
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage, EdiAnalysisResult, ValidationResult, EdiFile, AppSettings } from '../types';

const GEMINI_PRO = 'gemini-3-pro-preview';
const GEMINI_FLASH = 'gemini-2.5-flash';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

const SYSTEM_INSTRUCTION_EDI_EXPERT = `
You are "EDI Insight AI", the AI workspace inside a specialized EDI editor.

Overall role
------------
You are a professional assistant that only talks about:
- EDI (X12, EDIFACT, TRADACOMS, etc.)
- ERP integrations and mappings
- Trading partner (TP) flows
- Supply chain documents and logistics processes

If the user asks anything outside EDI / ERP / integration, reply:
"I’m focused only on EDI, ERP, and integration topics. Please ask about those."

UI layout context
-----------------
The app has three main areas:
1) Editor      → text view of the EDI file
2) Mapper      → visual mapping to JSON/ERP fields
3) AI Space    → a web-style panel with Chat, Image/Video generation.

Answer style
------------
- Always write clean, simple, professional English.
- Use short paragraphs and bullet lists.
- Structure every main answer like this:

  1. **Overview** – 1–2 sentences.
  2. **Key Documents / Segments** – list important EDI docs/segments.
  3. **Business Meaning** – what it means in real business terms.
  4. **Important Fields** – bullet list of key elements and why they matter.
  5. **Tips / Common Issues** – optional, short.

- Never ramble. No emojis. No jokes. Keep it focused and business-like.

Chat behavior
-------------
- You always have access to the "current EDI file" context if the user is editing a document.
- When the user selects or mentions a segment (e.g., BEG, N1*ST, PO1, REF, G62), explain what it is for, validation rules, and business meaning.
- For mapping questions, suggest concrete mappings (e.g., BEG03 → target.PurchaseOrderNumber).

Image generation: EDI flow diagrams
-----------------------------------
When the user asks to "generate a flow diagram" or describes a trading partner flow:
1. Parse the parties (Buyer, Supplier, 3PL) and documents (850, 856, etc.).
2. Produce a clear prompt for the image model to create a diagram:
   - Parties arranged horizontally.
   - Arrows with labels.
   - Clean, flat, professional style.
   - Use only company names, NO copyrighted logos.

Video generation: business explainer
------------------------------------
When the user asks to "generate a video" or "show this flow as a video":
1. Build a short (30–60 second) animated explainer concept.
2. Produce a clean, detailed prompt for the video model showing buildings, arrows, and document captions.

Advanced EDI tools
------------------
If asked for specific tasks:
1) File summary: Identify doc type, partners, dates, business summary.
2) Diff explanation: Summarize qty/price/date changes.
3) Mapping help: Explicit segment-to-target field suggestions.
4) Error doctor: Explain validation errors and how to correct them.

Content limitations
-------------------
- Stay within EDI, ERP and related business-process topics.
- Do not output general web chit-chat.
- For real company names, use plain text only.
`;

// --- Helpers ---

const getSettings = (): AppSettings => {
  const saved = localStorage.getItem('edi_settings');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) { console.error(e); }
  }
  return {
    fontSize: 'medium',
    showLineNumbers: true,
    theme: 'dark',
    aiModel: 'speed',
    aiProvider: 'gemini',
    geminiApiKey: '',
    deepSeekApiKey: ''
  };
};

const getGeminiClient = () => {
  const settings = getSettings();
  const key = settings.geminiApiKey;
  
  if (!key) {
    throw new Error("Gemini API Key is missing. Please add your key in Settings to unlock AI features.");
  }
  
  return new GoogleGenAI({ apiKey: key });
};

// Export helper for Live Agent and UI checks
export const getGeminiKey = () => {
  const settings = getSettings();
  return settings.geminiApiKey;
}

export const hasValidApiKey = (): boolean => {
  const settings = getSettings();
  if (settings.aiProvider === 'deepseek') return !!settings.deepSeekApiKey;
  return !!settings.geminiApiKey;
}

const getModelName = (settings: AppSettings) => {
  return settings.aiModel === 'power' ? GEMINI_PRO : GEMINI_FLASH;
};

// Helper to ensure AI Studio key is selected for premium models
const ensureAiStudioKey = async (): Promise<string | undefined> => {
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    const aistudio = (window as any).aistudio;
    const hasKey = await aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await aistudio.openSelectKey();
    }
    // process.env.API_KEY is injected by the AI Studio environment after selection
    return process.env.API_KEY; 
  }
  return undefined;
};

// Helper to check for permission/not-found errors in various formats
const isPermissionOrNotFoundError = (error: any): boolean => {
    if (!error) return false;
    
    // Direct status check
    if (error.status === 403 || error.status === 404) return true;
    
    // Message check
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes("403") || msg.includes("404") || msg.includes("permission") || msg.includes("not found") || msg.includes("entity was not found")) return true;
    
    // Nested error object (common in Google APIs)
    if (error.error) {
        if (error.error.code === 403 || error.error.code === 404) return true;
        if (error.error.status === "PERMISSION_DENIED" || error.error.status === "NOT_FOUND") return true;
    }
    
    return false;
};

// --- DeepSeek Implementation ---

const callDeepSeek = async (
  messages: { role: string; content: string }[], 
  settings: AppSettings
): Promise<{ text: string }> => {
  if (!settings.deepSeekApiKey) {
    throw new Error("DeepSeek API Key is missing. Please add it in Settings.");
  }

  try {
    const response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.deepSeekApiKey.trim()}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: messages,
        stream: false
      })
    });

    if (!response.ok) {
      let errorMsg = `Status ${response.status}`;
      try {
         const json = await response.json();
         if (json.error?.message) errorMsg = json.error.message;
      } catch (e) {}
      throw new Error(`DeepSeek API Error: ${errorMsg}`);
    }

    const data = await response.json();
    return { text: data.choices[0].message.content };
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error("Network connection failed. DeepSeek does not support direct browser access (CORS). Please switch to Gemini.");
    }
    throw error;
  }
};

// --- Core Generator Function (Router) ---

const generateText = async (prompt: string, systemInstruction?: string): Promise<string> => {
  const settings = getSettings();
  const provider = settings.aiProvider || 'gemini';

  const effectiveSystemInstruction = systemInstruction || SYSTEM_INSTRUCTION_EDI_EXPERT;

  try {
    // Router
    if (provider === 'deepseek') {
      const messages = [];
      if (effectiveSystemInstruction) messages.push({ role: 'system', content: effectiveSystemInstruction });
      messages.push({ role: 'user', content: prompt });
      const res = await callDeepSeek(messages, settings);
      return res.text;
    } else {
      // Default to Gemini
      const ai = getGeminiClient();
      const modelName = getModelName(settings);
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: effectiveSystemInstruction ? { systemInstruction: effectiveSystemInstruction } : undefined
      });
      return response.text || "";
    }
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    if (error.message.includes("API Key is missing")) throw error;
    if (error.message.includes("Network connection failed") || error.message.includes("CORS")) {
        throw error;
    }
    throw new Error("AI Request Failed: " + (error.message || "Unknown error"));
  }
};

// --- Image Generator (Gemini Only) ---

export const generateEdiFlowImage = async (prompt: string, imageSize: "1K" | "2K" | "4K" = "1K"): Promise<string> => {
  
  const enhancedPrompt = `
    Create a professional EDI Transaction Flow Diagram.
    Style: Minimalist, Corporate, White Background, High Definition.
    Content: ${prompt}
    
    Ensure the diagram clearly shows:
    1. Trading Partners (with generic logos if applicable)
    2. Document Types (e.g., 850 PO, 810 Invoice) on arrows
    3. Direction of flow
    4. Clean typography and high contrast.
  `;

  // Internal helper to perform generation
  const performGeneration = async (key: string, model: string): Promise<string> => {
      const ai = new GoogleGenAI({ apiKey: key });
      const config: any = {};
      
      // gemini-3-pro-image-preview supports imageSize, gemini-2.5-flash-image does not
      if (model.includes('pro')) {
          config.imageConfig = { imageSize: imageSize };
      }

      const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: enhancedPrompt }] },
        config: Object.keys(config).length > 0 ? config : undefined
      });
      
      if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                  return part.inlineData.data;
              }
          }
      }
      throw new Error("No image data returned from Gemini.");
  };

  // Initial Key Strategy
  let apiKey = await ensureAiStudioKey();
  if (!apiKey) {
      const settings = getSettings();
      apiKey = settings.geminiApiKey;
  }
  if (!apiKey) throw new Error("Gemini API Key required for image generation.");

  try {
    // Attempt High Quality Model First
    return await performGeneration(apiKey, 'gemini-3-pro-image-preview');
  } catch (error: any) {
    console.error("Image Gen Error (Pro)", error);
    
    // Handle 403 Permission Denied or 404 Model Not Found
    if (isPermissionOrNotFoundError(error)) {
        // 1. Try to prompt for key if in AI Studio
        if (typeof window !== 'undefined' && (window as any).aistudio) {
            try {
                console.log("Permission error on Image Gen. Prompting for key...");
                await (window as any).aistudio.openSelectKey();
                const newKey = process.env.API_KEY || apiKey;
                return await performGeneration(newKey, 'gemini-3-pro-image-preview');
            } catch (retryError) {
                console.warn("Retry with Pro model failed. Attempting fallback.", retryError);
            }
        }

        // 2. Fallback to Flash Image model (more widely accessible, ignores imageSize)
        console.log("Falling back to gemini-2.5-flash-image...");
        try {
            // Use the key we have (or the one from env if updated)
            const fallbackKey = process.env.API_KEY || apiKey;
            return await performGeneration(fallbackKey, 'gemini-2.5-flash-image');
        } catch (flashError: any) {
            throw new Error("Failed to generate image. Pro model access denied and Flash model failed: " + flashError.message);
        }
    }
    
    throw new Error("Failed to generate diagram: " + error.message);
  }
};

// --- Video Generator (Veo) ---

export const generateEdiFlowVideo = async (prompt: string): Promise<string> => {
  
  const performGeneration = async (key: string) => {
      const ai = new GoogleGenAI({ apiKey: key });
      const enhancedPrompt = `
        A professional animated 3D motion graphic visualization of an Electronic Data Interchange (EDI) process.
        White background, corporate style.
        
        Scene: ${prompt}
        
        Show data packets or documents moving between servers or buildings representing trading partners.
        High quality, smooth motion, 1080p.
      `;

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: enhancedPrompt,
        config: {
          numberOfVideos: 1,
          resolution: '1080p',
          aspectRatio: '16:9'
        }
      });

      // Poll for completion
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
        operation = await ai.operations.getVideosOperation({operation: operation});
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      
      if (!downloadLink) {
          throw new Error("Video generation completed but no URI returned.");
      }

      // Fetch the video bytes using the API key
      const response = await fetch(`${downloadLink}&key=${key}`);
      if (!response.ok) {
          throw new Error(`Failed to download video: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Convert to Base64
      return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64data = reader.result as string;
              const rawBase64 = base64data.split(',')[1];
              resolve(rawBase64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
      });
  };

  // Initial Key Strategy
  let apiKey = await ensureAiStudioKey();
  if (!apiKey) {
      const settings = getSettings();
      apiKey = settings.geminiApiKey;
  }
  if (!apiKey) throw new Error("Gemini API Key required for video generation.");

  try {
    return await performGeneration(apiKey);
  } catch (error: any) {
    console.error("Video Gen Error", error);
    
    // RETRY LOGIC: Handle 404 Not Found (common for Veo access) or 403
    if (isPermissionOrNotFoundError(error) && typeof window !== 'undefined' && (window as any).aistudio) {
        try {
            console.log("Permission error on Video Gen. Prompting for key...");
            await (window as any).aistudio.openSelectKey();
            // Retry with potentially new key from env
            const newKey = process.env.API_KEY || apiKey;
            return await performGeneration(newKey);
        } catch (retryError: any) {
            throw new Error("Veo model access denied. Please ensure your project has the 'Vertex AI API' enabled and you are using a key from a Paid Project.");
        }
    }

    throw new Error("Failed to generate video: " + error.message);
  }
};

// --- Exported Services ---

export const analyzeEdiContent = async (ediContent: string): Promise<EdiAnalysisResult> => {
  const prompt = `
    Analyze the following EDI content and provide a structured JSON summary.
    
    EDI Content:
    ${ediContent.substring(0, 15000)} ${ediContent.length > 15000 ? '...(truncated)' : ''}

    Return ONLY a JSON object with this structure (no markdown):
    {
      "summary": "Brief 1 sentence overview",
      "transactionType": "e.g. Purchase Order",
      "transactionSet": "e.g. 850",
      "version": "e.g. 4010",
      "standard": "X12 or EDIFACT",
      "sender": "Sender ID",
      "receiver": "Receiver ID",
      "details": "Detailed business explanation of what is happening in this file."
    }
  `;

  try {
    const text = await generateText(prompt);
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Analysis Failed", error);
    return {
      summary: "Analysis failed",
      transactionType: "Unknown",
      standard: "UNKNOWN",
      details: "Could not analyze the file. Ensure your API Key is valid in Settings."
    };
  }
};

export const validateEdiContent = async (ediContent: string): Promise<ValidationResult> => {
  const prompt = `
    Validate the following EDI content. Check for missing segments, invalid structures, or logical errors.
    
    EDI Content:
    ${ediContent.substring(0, 10000)}

    Return ONLY a JSON object with this structure (no markdown):
    {
      "isValid": boolean,
      "errors": ["list of critical errors"],
      "warnings": ["list of warnings"],
      "score": number (0-100)
    }
  `;

  try {
    const text = await generateText(prompt);
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    const msg = error.message && error.message.includes("API Key") ? "API Key Required" : "AI Validation Failed";
    return { isValid: false, errors: [msg], warnings: [], score: 0 };
  }
};

export interface ChatResponse {
    text: string;
    sources?: { uri: string; title: string }[];
}

export const sendEdiChat = async (
  history: ChatMessage[], 
  newMessage: string, 
  context: string,
  options?: { useThinking?: boolean, useSearch?: boolean }
): Promise<ChatResponse> => {
  
  const settings = getSettings();
  const provider = settings.aiProvider || 'gemini';

  const systemContext = SYSTEM_INSTRUCTION_EDI_EXPERT + `
    
    CONTEXT DATA FROM USER FILE:
    ${context.substring(0, 20000)}
  `;

  if (provider === 'deepseek') {
    const messages = [{ role: 'system', content: systemContext }];
    history.forEach(msg => {
      if (msg.image || msg.video) return;
      messages.push({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.text });
    });
    messages.push({ role: 'user', content: newMessage });
    
    try {
        const result = await callDeepSeek(messages, settings);
        return { text: result.text };
    } catch (e: any) {
        if (e.message.includes("Network connection failed")) return { text: "Error: DeepSeek does not support browser access. Please switch to Gemini in settings." };
        throw e;
    }
  } else {
    // Gemini
    try {
        const ai = getGeminiClient();
        const modelName = options?.useThinking ? GEMINI_PRO : GEMINI_FLASH;
        
        const config: any = { systemInstruction: systemContext };
        
        if (options?.useThinking) {
            config.thinkingConfig = { thinkingBudget: 1024 }; 
        }
        
        if (options?.useSearch && !options?.useThinking) {
            config.tools = [{ googleSearch: {} }];
        }

        const chat = ai.chats.create({
            model: modelName,
            config: config,
            history: history.filter(h => !h.image && !h.video).map(h => ({
              role: h.role,
              parts: [{ text: h.text }]
            }))
        });

        const result = await chat.sendMessage({ message: newMessage });
        
        // Extract Grounding (Search Sources)
        const sources = result.candidates?.[0]?.groundingMetadata?.groundingChunks
            ?.map(c => c.web ? { uri: c.web.uri, title: c.web.title || "Web Source" } : null)
            .filter(s => s) as { uri: string; title: string }[];

        return { 
            text: result.text || "No response generated.",
            sources: sources && sources.length > 0 ? sources : undefined
        };

    } catch (e: any) {
      console.error(e);
      if (e.message.includes("API Key is missing")) return { text: "Please add your Gemini API Key in Settings to chat." };
      return { text: "I encountered an error processing your request with Gemini." };
    }
  }
};

export const explainEdiDiff = async (diffContext: string): Promise<string> => {
  const prompt = `
    You are an expert EDI Analyst. Review the following differences between two EDI files (Original vs Modified).
    
    Explain the BUSINESS IMPACT of these changes.
    - Don't just say "BEG03 changed". Say "The Purchase Order Number was updated from X to Y".
    - Identify if line items were added/removed.
    - Mention date changes (Ship Date, PO Date).
    - Mention Quantity or Price changes.
    
    DIFF CONTEXT:
    ${diffContext.substring(0, 15000)}
    
    Return a concise bulleted list of the business changes.
  `;
  return await generateText(prompt);
};

export const translateEdiToHuman = async (ediContent: string): Promise<string> => {
  const prompt = `
    Transform the following raw EDI data into a professional, human-readable business document.
    
    Format: Markdown.
    Structure:
    - Header (Sender, Receiver, Date, PO Number etc)
    - Line Items (Table format with Item #, Qty, Price, Description)
    - Totals
    - Addresses (Bill To, Ship To)
    
    Make it look like a real business document (Invoice, PO, ASN, etc).
    Use bold labels and clear separation.
    
    EDI Content:
    ${ediContent.substring(0, 10000)}
  `;
  
  return await generateText(prompt);
};

export const convertEdiToFormat = async (ediContent: string, format: string): Promise<string> => {
  const prompt = `
    Convert this EDI content into ${format}.
    Return ONLY the raw ${format} content. No markdown formatting.
    
    EDI:
    ${ediContent.substring(0, 5000)}
  `;
  return await generateText(prompt);
};

export const generateSampleEdi = async (type: string): Promise<string> => {
  const prompt = `
    Generate a valid sample X12 EDI file for transaction type: ${type}.
    Use realistic data. Return ONLY the raw EDI content.
  `;
  return await generateText(prompt);
};

export const generateRelatedTransaction = async (sourceEdi: string, targetType: string): Promise<string> => {
  const prompt = `
    Based on the following source EDI file, generate a corresponding ${targetType} transaction.
    For example, if source is 850 (PO), generate 855 (Ack) or 810 (Invoice) with matching control numbers and references.
    
    Source EDI:
    ${sourceEdi.substring(0, 5000)}
    
    Return ONLY the raw EDI content for the ${targetType}.
  `;
  return await generateText(prompt);
};

export const generateXsltWithAi = async (sourceEdi: string, targetSchema: string, transactionType: string): Promise<string> => {
  const prompt = `
    You are an expert XSLT developer.
    Create an XSLT 1.0 transformation to map the provided EDI X12 XML structure to the Target ERP Schema.
    
    Transaction Type: ${transactionType}
    
    SOURCE EDI SAMPLE:
    <TS${transactionType}> ... segments like BEG, REF, N1 Loop, PO1 Loop ... </TS${transactionType}>
    
    TARGET ERP SCHEMA (XSD):
    ${targetSchema.substring(0, 3000)}
    
    The output must be a valid XSLT file. Return ONLY the XSLT code.
  `;
  
  const response = await generateText(prompt);
  return response.replace(/```xml/g, '').replace(/```xslt/g, '').replace(/```/g, '').trim();
};

export const generateStediGuideJson = async (ediContent: string): Promise<string> => {
  const prompt = `
    Convert this EDI content into a Stedi Guide JSON payload.
    The output should be a JSON object representing the transaction structure suitable for the Stedi API.
    
    EDI:
    ${ediContent.substring(0, 5000)}
    
    Return ONLY the JSON.
  `;
  return await generateText(prompt);
};
