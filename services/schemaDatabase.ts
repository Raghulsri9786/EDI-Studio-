
import { ErpSchema } from '../types';
import { cloudDataService } from './cloudDataService';

/**
 * @deprecated Use cloudDataService directly.
 * This adapter is kept for backward compatibility during migration.
 */
export const schemaDatabase = {
  async listAvailableSchemas(): Promise<{id: string, name: string}[]> {
    return await cloudDataService.getAvailableSchemas();
  },

  async getSchemaByType(type: string): Promise<ErpSchema | null> {
    return await cloudDataService.fetchSchema(type);
  }
};
