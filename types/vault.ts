export type Category = 'Login' | 'Card' | 'Secure Note';

export interface VaultFolder {
  id: string;
  name: string;
  color: string;
}

export interface VaultEntry {
  id: string;
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  category: Category;
  folderId: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ExportPayload {
  version: number;
  timestamp: number;
  folders: VaultFolder[];
  entries: VaultEntry[];
}
