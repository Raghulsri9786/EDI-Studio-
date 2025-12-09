
/**
 * Stedi API Integration Service
 * Handles outbound transaction generation via Stedi Core API.
 * Reference: https://www.stedi.com/docs/api-reference
 */

export interface StediConfig {
  apiKey: string;
  partnershipId: string;
  transactionSettingId: string;
}

export interface StediResponse {
  fileExecutionId: string;
  [key: string]: any;
}

export const sendToStedi = async (
  config: StediConfig,
  guideJson: any,
  filename?: string
): Promise<StediResponse> => {
  const { apiKey, partnershipId, transactionSettingId } = config;
  
  if (!apiKey || !partnershipId || !transactionSettingId) {
    throw new Error("Missing Stedi Configuration (API Key, Partnership ID, or Transaction Setting ID).");
  }

  // Ensure Authorization header is formatted correctly (Key <VALUE>)
  const authHeader = apiKey.trim().startsWith('Key ') ? apiKey.trim() : `Key ${apiKey.trim()}`;

  const payload = {
    filename: filename || `edi-studio-${Date.now()}.edi`,
    transaction: guideJson
  };

  try {
    const response = await fetch(
      `https://core.us.stedi.com/2023-08-01/partnerships/${partnershipId}/transactions/${transactionSettingId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      let errorBody: any = {};
      try {
        errorBody = await response.json();
      } catch {
        errorBody = { message: response.statusText };
      }

      // Consolidate various error formats Stedi might return
      const errorMessage = errorBody.message || errorBody.error || "Unknown Stedi API Error";
      let details = "";

      // Check for 'details' array (common in schema validation errors)
      if (Array.isArray(errorBody.details)) {
         details = errorBody.details.map((d: any) => 
           typeof d === 'object' ? JSON.stringify(d, null, 2) : d
         ).join('\n');
      } 
      // Check for 'issues' array (Zod style errors often used in modern APIs)
      else if (Array.isArray(errorBody.issues)) {
         details = errorBody.issues.map((i: any) => 
           i.message ? `${i.path?.join('.')} : ${i.message}` : JSON.stringify(i)
         ).join('\n');
      }

      throw new Error(details ? `${errorMessage}\n\nValidation Details:\n${details}` : errorMessage);
    }

    const data = await response.json();
    return data as StediResponse;
  } catch (error: any) {
    console.error("Stedi Send Error:", error);
    throw error;
  }
};
