
import { ErpSchema } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Cloud Data Service
 * 
 * Fetches large static assets (Schemas, Guidelines) from Supabase.
 * This keeps the local application bundle small by offloading data to the cloud.
 */

export const cloudDataService = {
  
  /**
   * Connects to the external Schema Database.
   */
  async connect(): Promise<boolean> {
    return isSupabaseConfigured;
  },

  /**
   * Fetches the list of available schemas from the cloud database.
   */
  async getAvailableSchemas(): Promise<{id: string, name: string}[]> {
    if (!isSupabaseConfigured) return [];

    const { data, error } = await supabase
      .from('edi_schemas')
      .select('id, name');

    if (error) {
      console.error("Failed to list schemas:", error);
      return [];
    }

    return data.map((item: any) => ({
      id: item.id,
      name: item.name
    }));
  },

  /**
   * Downloads a specific schema definition from the cloud database.
   */
  async fetchSchema(transactionType: string): Promise<ErpSchema | null> {
    console.log(`Fetching schema for ${transactionType} from Supabase...`);
    
    if (!isSupabaseConfigured) {
        // Fallback for demo/offline mode if DB not connected
        return {
            transactionType,
            name: `Generic ${transactionType} (Offline)`,
            root: { id: 'root', name: 'Envelope', type: 'object', children: [] },
            rawContent: `<!-- Schema for ${transactionType}. Connect Supabase to fetch real XSD. -->`
        };
    }

    const { data, error } = await supabase
      .from('edi_schemas')
      .select('*')
      .eq('transaction_type', transactionType)
      .single();

    if (error || !data) {
        console.warn(`Schema ${transactionType} not found in DB.`);
        return null;
    }
    
    // Return the database content
    return {
        transactionType: data.transaction_type,
        name: data.name,
        root: { id: 'root', name: 'Envelope', type: 'object', children: [] }, // Root is inferred from content usually
        rawContent: data.content // This is the large XSD/JSON string
    };
  }
};
