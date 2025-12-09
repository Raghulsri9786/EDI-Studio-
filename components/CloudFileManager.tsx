
import React, { useEffect, useState } from 'react';
import { Cloud, Save, Download, Clock, Trash2, Check, Loader2, FileText, AlertTriangle, Settings } from 'lucide-react';
import { EdiFile } from '../types';
import { cloudService } from '../services/cloudService';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';

interface CloudFileManagerProps {
  currentFile: EdiFile | undefined;
  onLoadFile: (file: EdiFile) => void;
  onFileSaved: (localId: string, cloudId: string) => void;
}

const CloudFileManager: React.FC<CloudFileManagerProps> = ({ currentFile, onLoadFile, onFileSaved }) => {
  const { user } = useAuth();
  const [cloudFiles, setCloudFiles] = useState<EdiFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchFiles = async () => {
    if (!user || !isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      const files = await cloudService.listFiles();
      setCloudFiles(files);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchFiles();
  }, [user]);

  const handleSave = async () => {
    if (!currentFile || !user) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const cloudId = await cloudService.saveFile(currentFile);
      // Create a version snapshot on manual save
      await cloudService.createVersion(cloudId, currentFile.content, `Manual Save ${new Date().toLocaleTimeString()}`);
      
      onFileSaved(currentFile.id, cloudId);
      setMessage({ type: 'success', text: 'Saved to cloud successfully!' });
      fetchFiles();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Save failed' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this file from the cloud?')) return;
    try {
      await cloudService.deleteFile(id);
      setCloudFiles(prev => prev.filter(f => f.id !== id));
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  if (!isSupabaseConfigured) return (
    <div className="flex flex-col items-center justify-center p-8 text-slate-400 h-full text-center">
      <AlertTriangle size={48} className="mb-4 text-amber-500 opacity-50" />
      <h3 className="text-lg font-bold text-slate-300 mb-2">Cloud Not Configured</h3>
      <p className="text-sm max-w-xs mb-4 opacity-70">
        Connect Supabase to enable cloud save, sync, and version history.
      </p>
      <div className="text-xs bg-slate-800 p-3 rounded border border-white/5 text-slate-400 font-mono">
        Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.
      </div>
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center p-8 text-slate-400 h-full">
      <Cloud size={48} className="mb-4 opacity-20" />
      <p>Log in to access Cloud Files</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2">
          <Cloud size={18} className="text-blue-400" /> Cloud Storage
        </h3>
        {currentFile && (
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Current
          </button>
        )}
      </div>

      {message && (
        <div className={`px-4 py-2 text-xs font-bold text-center ${message.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {isLoading ? (
          <div className="flex justify-center p-4"><Loader2 className="animate-spin text-slate-500" /></div>
        ) : cloudFiles.length === 0 ? (
          <div className="text-center text-slate-500 p-4 text-sm">No files in cloud</div>
        ) : (
          <div className="space-y-2">
            {cloudFiles.map(file => (
              <div key={file.id} className="group p-3 rounded-xl bg-slate-800 border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-slate-700 rounded-lg">
                      <FileText size={16} className="text-blue-400" />
                    </div>
                    <div>
                      <div className="font-medium text-sm truncate max-w-[150px]">{file.name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(file.lastModified).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => onLoadFile(file)}
                      className="p-1.5 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 rounded-lg transition-colors"
                      title="Load File"
                    >
                      <Download size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(file.id)}
                      className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CloudFileManager;
