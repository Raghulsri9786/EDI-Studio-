
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage, EdiAnalysisResult, ValidationResult, EdiFile, AppSettings, FixResult, TPRule, LineError } from '../types';

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

UI layout context
-----------------
The app has three main areas:
1) Editor      → text view of the EDI file (or PDF viewer)
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
- You have access to the context files provided in the chat.
- If a PDF is provided, READ IT CAREFULLY. It usually contains Trading Partner specifications or guides.
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

const SYSTEM_INSTRUCTION_FIXER = `
You are the Inline EDI Validation Engine.  
When validating an X12 file, you MUST NOT change the formatting, spacing, alignment, 
or visual structure of the original file in any way.

Your job is ONLY:
1. Identify the exact line where the error occurs.
2. Identify the exact element inside the segment that is incorrect.
3. Provide a structured error object for the frontend to render a ❌ marker.
4. Provide a fix suggestion, but NEVER modify the user's file automatically.
5. NEVER auto-format the EDI text. NEVER break lines. NEVER re-indent segments.

VERY IMPORTANT:
- The EDI editor must display the file EXACTLY as the user typed it.
- Validation must highlight errors WITHOUT altering the raw EDI text.
- Fix suggestions must be provided as separate text, not applied automatically.

For each error return:
{
  "line": <line number>,
  "segment": "<segment ID>",
  "element": "<element ID>",
  "message": "<short human-readable message>",
  "reason": "<why this violates X12 or TP rules>",
  "fix": "<corrected full segment>",
  "explanation": "<short explanation>",
  "range": { "start": <index>, "end": <index> }
}

Rules:
- Do NOT change spacing or alignment inside segments.
- Do NOT rewrap segments into multiple lines.
- Do NOT merge or split segments.
- Do NOT guess missing data.
- If the line is truncated or incomplete (e.g., 'REF*AN'), 
  report the error but do NOT try to auto-fix unless safe.

Example error output:
{
  "line": 14,
  "segment": "REF",
  "element": "02",
  "message": "Missing Reference Identification value.",
  "reason": "REF02 is required when REF01='AN'.",
  "fix": "REF*AN*XXXX~",
  "explanation": "Added placeholder value since REF02 is mandatory.",
  "range": { "start": 7, "end": 7 }
}

If the file is correct, return an empty array [].
`;

const SYSTEM_INSTRUCTION_VALIDATOR = `
You are the Full X12 Validation + Auto-Fix Engine for EDI Insight.

Your job is to validate EVERY segment and EVERY element in the X12 file.  
You must detect ALL violations of:
• X12 standard rules  
• Minimum/maximum length  
• Datatype (AN, ID, N0, R, DT, TM)  
• Required element rules  
• Required segment rules  
• Segment sequence  
• Loop structure  
• Code set restrictions  
• Conditional rules (“If X present, Y required”)  

You must ALWAYS return a complete list of errors for the entire file.

### Output Format (required for every error):
{
  "line": <line number>,
  "segment": "<segment ID>",
  "element": "<element ID or null>",
  "message": "<short error explanation>",
  "reason": "<short explanation why this breaks X12 rule>",
  "fix": "<corrected version of full segment or null>",
  "explanation": "<explain the fix in 1 short sentence>",
  "range": { "start": <index>, "end": <index> }
}

### Auto-Fix Rules:
- ALWAYS attempt a fix if the rule violation can be corrected safely.
- Fix MUST be returned instantly, not delayed.
- Only change the invalid element; do NOT alter valid elements.
- Fix must use the same delimiter style.
- If value exceeds max length, trim it safely.
- If missing but required, insert placeholder: "XXXX".
- If an invalid code appears, choose the closest valid value.
- If fix is unsafe, return:
     "fix": null
     "explanation": "Manual correction required."

### Coverage Requirements:
- You must validate EVERY FIELD, not only a few fields.
- ALL elements in ALL segments must be validated.
- GS02, GS04, ISA06, ISA08, BEG03, DTM02, N101, N104, PO1, SAC… EVERYTHING.
- Never skip any element.

### Line Mapping:
- You must always calculate the correct line number.
- Never skip blank lines.
- Never reformat the file.
- Do NOT modify original text—only return error objects.

### When No Errors:
Return an empty list: []
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

/**
 * Retry utility to handle 429 (Quota Exceeded) and 503 (Server Overload) errors.
 * Implements exponential backoff.
 */
const retryWithBackoff = async <T>(
  operation: () => Promise<T>, 
  retries: number = 3, 
  initialDelay: number = 2000
): Promise<T> => {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      
      // Determine if we should retry
      let shouldRetry = false;
      
      if (error?.status === 429 || error?.code === 429) shouldRetry = true;
      if (error?.status === 503 || error?.code === 503) shouldRetry = true;
      
      const msg = error?.message || JSON.stringify(error);
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) shouldRetry = true;
      if (msg.includes('503') || msg.includes('Overloaded')) shouldRetry = true;

      if (!shouldRetry || attempt > retries) {
        throw error;
      }

      // Exponential backoff
      const backoffTime = initialDelay * Math.pow(2, attempt - 1);
      console.warn(`[Gemini] Rate limit/Error hit. Retrying in ${backoffTime}ms (Attempt ${attempt}/${retries})...`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }
  }
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
      
      const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: effectiveSystemInstruction ? { systemInstruction: effectiveSystemInstruction } : undefined
      }));
      return response.text || "";
    }
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    if (error.message.includes("API Key is missing")) throw error;
    if (error.message.includes("Network connection failed") || error.message.includes("CORS")) {
        throw error;
    }
    // Extract cleaner error if possible
    let msg = error.message;
    if (msg.includes('429')) msg = "Quota limit reached. Please try again in a few moments.";
    throw new Error("AI Request Failed: " + (msg || "Unknown error"));
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

      const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: enhancedPrompt }] },
        config: Object.keys(config).length > 0 ? config : undefined
      }));
      
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
    if (!isPermissionOrNotFoundError(error)) {
        console.error("Image Gen Error (Pro)", error);
    } else {
        console.warn("Pro model access denied (403/404). Attempting fallback.");
    }
    
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
                console.warn("Retry with Pro model failed or key selection dismissed. Attempting fallback.", retryError);
            }
        }

        // 2. Fallback to Flash Image model (more widely accessible, ignores imageSize)
        console.log("Falling back to gemini-2.5-flash-image...");
        try {
            // Use the key we have (or the one from env if updated)
            const fallbackKey = process.env.API_KEY || apiKey;
            return await performGeneration(fallbackKey, 'gemini-2.5-flash-image');
        } catch (flashError: any) {
            console.error("Flash fallback failed", flashError);
            throw new Error("Failed to generate image with both Pro and Flash models. Please check your API key permissions.");
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

      let operation: any = await retryWithBackoff(() => ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: enhancedPrompt,
        config: {
          numberOfVideos: 1,
          resolution: '1080p',
          aspectRatio: '16:9'
        }
      }));

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
    if (!isPermissionOrNotFoundError(error)) {
        console.error("Video Gen Error", error);
    }
    
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

export const validateEdiContent = async (ediContent: string): Promise<LineError[]> => {
  const prompt = `
    Validate the following EDI content using strict X12 rules.
    
    EDI Content:
    ${ediContent.substring(0, 15000)}

    Return ONLY a JSON array of errors matching the specified Output Format.
    Do not wrap in markdown blocks.
  `;

  try {
    const text = await generateText(prompt, SYSTEM_INSTRUCTION_VALIDATOR);
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);
    
    if (Array.isArray(result)) {
        return result.map((err: any) => ({
            line: err.line,
            code: 'AI_VAL',
            message: err.message,
            severity: 'ERROR',
            tokenIndex: -1, // AI doesn't map exact token index usually
            fix: err.fix,
            explanation: err.explanation,
            reason: err.reason,
            range: err.range
        }));
    }
    return [];
  } catch (error: any) {
    console.error("AI Validation Failed", error);
    return [];
  }
};

export const extractValidationRules = async (specInput: string | { mimeType: string, data: string }): Promise<TPRule[]> => {
  
  const instruction = `
    You are an EDI Specification Analyzer.
    Extract validation rules from the attached Trading Partner Specification (PDF/Text/Image).
    The specification describes an X12 or EDIFACT transaction (like 850, 810, 856).
    
    Output a JSON array of rules strictly adhering to this format. 
    
    Severity Guidelines:
    - Mark as "ERROR" if the rule states "Must", "Mandatory", "Required", or "Shall".
    - Mark as "WARNING" if the rule states "Should", "Recommended", or "If Available".

    Supported Rule Types:
    - REQUIRED_SEGMENT: A specific segment is marked as Mandatory (M) or Required.
    - PROHIBITED_SEGMENT: A segment is marked as Not Used or Prohibited.
    - MAX_LENGTH: An element (e.g. BEG03) has a max length constraint.
    - ALLOWED_CODES: An element is restricted to a specific code list.
    - CONDITIONAL_EXISTS: A rule saying "If X exists, Y must exist".
    
    Output JSON Format:
    [
      {
        "id": "rule_1",
        "type": "REQUIRED_SEGMENT",
        "targetSegment": "REF",
        "message": "REF segment is mandatory for this partner",
        "severity": "ERROR"
      },
      {
        "id": "rule_2",
        "type": "ALLOWED_CODES",
        "targetSegment": "BEG",
        "targetElement": 2,
        "params": { "codes": ["00", "01"] },
        "message": "BEG02 must be 00 or 01",
        "severity": "ERROR"
      }
    ]
    
    Return ONLY JSON. No markdown.
  `;

  try {
    const settings = getSettings();
    const ai = getGeminiClient();
    const modelName = getModelName(settings); // Use the user's selected model (Flash/Pro)

    let response;
    
    // Check if input is a file object (binary/base64)
    if (typeof specInput === 'object' && specInput.data) {
        response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [
                    { inlineData: { mimeType: specInput.mimeType, data: specInput.data } },
                    { text: instruction }
                ]
            }
        }));
    } else {
        // Text input
        response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [
                    { text: `SPECIFICATION TEXT:\n${(specInput as string).substring(0, 30000)}\n\n${instruction}` }
                ]
            }
        }));
    }

    const text = response.text || "[]";
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Rule Extraction Failed", error);
    return [];
  }
};

export const generateEdiFix = async (
  segment: string, 
  errorMessage: string, 
  fullContext: string
): Promise<FixResult | null> => {
  const prompt = `
    Analyze this specific validation error and provide a fix.
    
    Error Message: "${errorMessage}"
    
    Broken Segment:
    ${segment}
    
    Context (Surrounding lines):
    ${fullContext.substring(0, 2000)}...
    
    Return the response as a single JSON object matching the Output Example in the system instruction.
  `;

  try {
    const text = await generateText(prompt, SYSTEM_INSTRUCTION_FIXER);
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let result;
    try {
        result = JSON.parse(cleanJson);
        // Handle if model returns a list (as per system instruction) or single object
        if (Array.isArray(result)) result = result[0];
    } catch(e) {
        console.warn("Failed to parse JSON fix", text);
        return null;
    }
    
    if (result && result.fix) {
      return {
        segment: result.fix,
        explanation: result.explanation
      };
    }
    
    return null;
  } catch (error) {
    console.error("Fix Generation Failed", error);
    return null;
  }
};

export interface ChatResponse {
    text: string;
    sources?: { uri: string; title: string }[];
}

export const sendEdiChat = async (
  history: ChatMessage[], 
  newMessage: string, 
  contextFiles: EdiFile[],
  options?: { useThinking?: boolean, useSearch?: boolean }
): Promise<ChatResponse> => {
  
  const settings = getSettings();
  const provider = settings.aiProvider || 'gemini';

  const systemContext = SYSTEM_INSTRUCTION_EDI_EXPERT;

  if (provider === 'deepseek') {
    const messages = [{ role: 'system', content: systemContext + `\n\nCONTEXT FILES:\n${contextFiles.map(f => f.content).join('\n')}` }];
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
        
        // IMPORTANT: For faster response on reading docs/PDFs, default to gemini-2.5-flash unless Thinking is requested
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

        // Build Multimodal Message Parts
        const messageParts: any[] = [];
        
        if (contextFiles && contextFiles.length > 0) {
            messageParts.push({ text: "Here is the context from the user's workspace (Files/PDFs):" });
            
            for (const file of contextFiles) {
                if (file.mimeType && file.mimeType !== 'text/plain') {
                    // Binary Content (PDF, Image)
                    messageParts.push({ 
                        inlineData: { 
                            mimeType: file.mimeType, 
                            data: file.content // Assuming base64 content in EdiFile.content
                        } 
                    });
                    messageParts.push({ text: `\n(Above is content of ${file.name})\n` });
                } else {
                    // Text Content
                    messageParts.push({ text: `\n=== FILE: ${file.name} ===\n${file.content}\n` });
                }
            }
        }

        messageParts.push({ text: newMessage });

        const result = await retryWithBackoff<GenerateContentResponse>(() => chat.sendMessage({ message: messageParts }));
        
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
