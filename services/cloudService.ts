
import { supabase } from '../lib/supabase';
import { EdiFile, AppSettings, CloudFileVersion } from '../types';

export const cloudService = {
  
  async saveFile(file: EdiFile): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const payload = {
      user_id: user.id,
      name: file.name,
      content: file.content,
      last_modified: new Date().toISOString()
    };

    if (file.cloudId) {
      // Update existing
      const { error } = await supabase
        .from('edi_files')
        .update(payload)
        .eq('id', file.cloudId);
      
      if (error) throw error;
      return file.cloudId;
    } else {
      // Create new
      const { data, error } = await supabase
        .from('edi_files')
        .insert(payload)
        .select()
        .single();
      
      if (error) throw error;
      return data.id;
    }
  },

  async createVersion(cloudId: string, content: string, versionName: string = 'Manual Save') {
    const { error } = await supabase
      .from('edi_file_versions')
      .insert({
        file_id: cloudId,
        content: content,
        version_name: versionName
      });
    
    if (error) throw error;
  },

  async getVersions(cloudId: string): Promise<CloudFileVersion[]> {
    const { data, error } = await supabase
      .from('edi_file_versions')
      .select('*')
      .eq('file_id', cloudId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as CloudFileVersion[];
  },

  async listFiles(): Promise<EdiFile[]> {
    const { data, error } = await supabase
      .from('edi_files')
      .select('*')
      .eq('is_active', true)
      .order('last_modified', { ascending: false });

    if (error) throw error;

    return data.map((f: any) => ({
      id: f.id, // Use cloud ID as local ID for cloud-sourced files
      cloudId: f.id,
      name: f.name,
      content: f.content,
      lastModified: new Date(f.last_modified),
      isSynced: true
    }));
  },

  async deleteFile(cloudId: string): Promise<void> {
    const { error } = await supabase
      .from('edi_files')
      .update({ is_active: false }) // Soft delete
      .eq('id', cloudId);
    
    if (error) throw error;
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Sanitize: Ensure settings are clean before saving to cloud
    const safeSettings = { ...settings };

    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, settings: safeSettings });
    
    if (error) console.error("Failed to sync settings", error);
  },

  async getSettings(): Promise<Partial<AppSettings> | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .single();

    if (error || !data) return null;
    return data.settings as AppSettings;
  }
};
