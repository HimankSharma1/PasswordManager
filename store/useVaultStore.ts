import { create } from 'zustand';
import { VaultEntry, Category, ExportPayload, VaultFolder } from '../types/vault';
import { saveVault } from '../services/storageService';
import { useAuthStore } from './useAuthStore';

interface VaultState {
  entries: VaultEntry[];
  folders: VaultFolder[];
  searchQuery: string;
  folderFilter: string | 'All';
  draftPassword: string | null;
  draftUsername: string | null;
  
  setEntries: (entries: VaultEntry[]) => void;
  setFolders: (folders: VaultFolder[]) => void;
  setSearchQuery: (query: string) => void;
  setFolderFilter: (filter: string | 'All') => void;
  setDraftPassword: (pwd: string | null) => void;
  setDraftUsername: (uname: string | null) => void;
  
  addEntry: (entry: VaultEntry) => Promise<void>;
  updateEntry: (entry: VaultEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  deleteEntries: (ids: string[]) => Promise<void>;
  moveEntries: (ids: string[], folderId: string) => Promise<void>;
  
  addFolder: (folder: VaultFolder) => Promise<void>;
  updateFolder: (folder: VaultFolder) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  
  clearVault: () => void;
}

const DEFAULT_FOLDERS: VaultFolder[] = [
  { id: 'default', name: 'Personal', color: '#3B82F6' }
];

export const useVaultStore = create<VaultState>((set, get) => ({
  entries: [],
  folders: DEFAULT_FOLDERS,
  searchQuery: '',
  folderFilter: 'All',
  draftPassword: null,
  draftUsername: null,

  setEntries: (entries: VaultEntry[]) => set({ entries }),
  setFolders: (folders: VaultFolder[]) => set({ folders: folders.length > 0 ? folders : DEFAULT_FOLDERS }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setFolderFilter: (filter: string | 'All') => set({ folderFilter: filter }),
  setDraftPassword: (pwd: string | null) => set({ draftPassword: pwd }),
  setDraftUsername: (uname: string | null) => set({ draftUsername: uname }),

  addEntry: async (entry: VaultEntry) => {
    const { entries, folders } = get();
    const newEntries = [...entries, entry];
    set({ entries: newEntries });
    
    // Persist to storage
    const mek = useAuthStore.getState().mek;
    if (mek) {
      await saveVault({ version: 1, timestamp: Date.now(), entries: newEntries, folders }, mek);
    }
  },

  updateEntry: async (updatedEntry: VaultEntry) => {
    const { entries, folders } = get();
    const newEntries = entries.map(e => (e.id === updatedEntry.id ? updatedEntry : e));
    set({ entries: newEntries });
    
    // Persist to storage
    const mek = useAuthStore.getState().mek;
    if (mek) {
      await saveVault({ version: 1, timestamp: Date.now(), entries: newEntries, folders }, mek);
    }
  },

  deleteEntry: async (id: string) => {
    const { entries, folders } = get();
    const newEntries = entries.filter(e => e.id !== id);
    set({ entries: newEntries });
    
    // Persist to storage
    const mek = useAuthStore.getState().mek;
    if (mek) {
      await saveVault({ version: 1, timestamp: Date.now(), entries: newEntries, folders }, mek);
    }
  },

  deleteEntries: async (ids: string[]) => {
    const { entries, folders } = get();
    const newEntries = entries.filter(e => !ids.includes(e.id));
    set({ entries: newEntries });
    
    const mek = useAuthStore.getState().mek;
    if (mek) {
      await saveVault({ version: 1, timestamp: Date.now(), entries: newEntries, folders }, mek);
    }
  },

  moveEntries: async (ids: string[], folderId: string) => {
    const { entries, folders } = get();
    const newEntries = entries.map(e => ids.includes(e.id) ? { ...e, folderId, updatedAt: Date.now() } : e);
    set({ entries: newEntries });
    
    const mek = useAuthStore.getState().mek;
    if (mek) {
      await saveVault({ version: 1, timestamp: Date.now(), entries: newEntries, folders }, mek);
    }
  },

  addFolder: async (folder: VaultFolder) => {
    const { folders, entries } = get();
    const newFolders = [...folders, folder];
    set({ folders: newFolders });
    
    const mek = useAuthStore.getState().mek;
    if (mek) {
      await saveVault({ version: 1, timestamp: Date.now(), entries, folders: newFolders }, mek);
    }
  },

  updateFolder: async (updatedFolder: VaultFolder) => {
    const { folders, entries } = get();
    const newFolders = folders.map(f => (f.id === updatedFolder.id ? updatedFolder : f));
    set({ folders: newFolders });
    
    const mek = useAuthStore.getState().mek;
    if (mek) {
      await saveVault({ version: 1, timestamp: Date.now(), entries, folders: newFolders }, mek);
    }
  },

  deleteFolder: async (id: string) => {
    const { folders, entries } = get();
    // Don't allow deleting the default folder
    if (id === 'default') return;
    
    const newFolders = folders.filter(f => f.id !== id);
    
    // Fallback entries to default folder
    const newEntries = entries.map(e => {
      if (e.folderId === id) {
        return { ...e, folderId: 'default' };
      }
      return e;
    });
    
    set({ folders: newFolders, entries: newEntries });
    
    const mek = useAuthStore.getState().mek;
    if (mek) {
      await saveVault({ version: 1, timestamp: Date.now(), entries: newEntries, folders: newFolders }, mek);
    }
  },

  clearVault: () => set({ entries: [], folders: DEFAULT_FOLDERS, searchQuery: '', folderFilter: 'All' }),
}));
