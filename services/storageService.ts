
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { EdiFile } from '../types';

interface EdiStudioDB extends DBSchema {
  files: {
    key: string;
    value: EdiFile;
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'edi_studio_db';
const DB_VERSION = 1;

class StorageService {
  private dbPromise: Promise<IDBPDatabase<EdiStudioDB>>;

  constructor() {
    this.dbPromise = openDB<EdiStudioDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }

  // --- File Operations ---

  async saveFile(file: EdiFile): Promise<void> {
    const db = await this.dbPromise;
    // Ensure we don't save ephemeral UI state if we can avoid it, 
    // but saving the whole object is easiest for now.
    await db.put('files', file);
  }

  async saveAllFiles(files: EdiFile[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    await Promise.all(files.map(file => store.put(file)));
    await tx.done;
  }

  async getAllFiles(): Promise<EdiFile[]> {
    const db = await this.dbPromise;
    return await db.getAll('files');
  }

  async deleteFile(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('files', id);
  }

  async clearAllFiles(): Promise<void> {
    const db = await this.dbPromise;
    await db.clear('files');
  }

  // --- Settings Operations ---

  async saveSetting(key: string, value: any): Promise<void> {
    const db = await this.dbPromise;
    await db.put('settings', { key, value });
  }

  async getSetting(key: string): Promise<any> {
    const db = await this.dbPromise;
    const result = await db.get('settings', key);
    return result ? result.value : null;
  }
}

export const storageService = new StorageService();
