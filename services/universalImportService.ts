import * as FileSystem from 'expo-file-system/legacy';
import Papa from 'papaparse';
import { XMLParser } from 'fast-xml-parser';
import { VaultEntry } from '../types/vault';
import * as Crypto from 'expo-crypto';

// Polyfill for uuid since we don't have uuid package yet
const generateId = () => Crypto.randomUUID();

export type ImportFormatType = 'CSV' | 'JSON' | 'XML';

export async function parseUniversalFile(fileUri: string, format: ImportFormatType, targetFolderId: string): Promise<VaultEntry[]> {
  const fileContent = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });
  const trimmed = fileContent.trim();
  
  if (format === 'JSON') {
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      throw new Error('The selected file does not appear to be a valid JSON file.');
    }
    const jsonObj = JSON.parse(trimmed);
    return processParsedJson(jsonObj, format, targetFolderId);
  }

  if (format === 'XML') {
    if (!trimmed.startsWith('<')) {
      throw new Error('The selected file does not appear to be a valid XML file.');
    }
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
    const xmlObj = parser.parse(trimmed);
    return processParsedXml(xmlObj, format, targetFolderId);
  }

  // Fallback to CSV for 'CSV' format
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const entries = processParsedCsv(results.data, format, targetFolderId);
          resolve(entries);
        } catch (error) {
          reject(error);
        }
      },
      error: (error: any) => {
        reject(new Error('Failed to parse CSV: ' + error.message));
      }
    });
  });
}

function processParsedXml(xmlObj: any, format: ImportFormatType, targetFolderId: string): VaultEntry[] {
  const entries: VaultEntry[] = [];
  
  // Flatten tree to find all objects that might be entries
  const allNodes: any[] = [];
  const traverse = (obj: any) => {
    if (typeof obj !== 'object' || obj === null) return;
    if (Array.isArray(obj)) {
      obj.forEach(traverse);
      return;
    }
    // Check if this looks like a KeePass Entry (has String array)
    if (obj.String && Array.isArray(obj.String)) {
      allNodes.push(obj);
    } else if (obj.title || obj.name || obj.username || obj.login || obj.password || obj.url) {
       allNodes.push(obj);
    }
    Object.values(obj).forEach(traverse);
  };
  traverse(xmlObj);

  for (const node of allNodes) {
     let title = '';
     let username = '';
     let password = '';
     let url = '';
     let notes = '';

     // KeePass XML format
     if (node.String && Array.isArray(node.String)) {
        for (const strNode of node.String) {
           const key = strNode.Key;
           const val = strNode.Value;
           if (typeof val !== 'string') continue;
           if (key === 'Title') title = val;
           if (key === 'UserName') username = val;
           if (key === 'Password') password = val;
           if (key === 'URL') url = val;
           if (key === 'Notes') notes = val;
        }
     } else {
        // Generic XML format
        title = String(node.title || node.name || '');
        username = String(node.username || node.login || '');
        password = String(node.password || node.pass || '');
        url = String(node.url || node.website || '');
        notes = String(node.notes || '');
     }

     if (!title && !username && !password && !url) continue;

     entries.push({
        id: generateId(),
        title: title || (url ? extractDomain(url) : 'Imported Entry'),
        username: username,
        password: password,
        url: url,
        notes: notes,
        category: 'Login',
        folderId: targetFolderId,
        favorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
  }

  return entries;
}

function processParsedJson(jsonObj: any, format: ImportFormatType, targetFolderId: string): VaultEntry[] {
  const entries: VaultEntry[] = [];

  // Bitwarden JSON Format
  if (jsonObj.items && Array.isArray(jsonObj.items)) {
    for (const item of jsonObj.items) {
      const title = item.name || '';
      const notes = item.notes || '';
      let username = '';
      let password = '';
      let url = '';

      if (item.login) {
        username = item.login.username || '';
        password = item.login.password || '';
        if (item.login.uris && item.login.uris.length > 0) {
          url = item.login.uris[0].uri || '';
        }
      }

      if (!title && !username && !password && !url) continue;

      entries.push({
        id: generateId(),
        title: title || (url ? extractDomain(url) : 'Imported Entry'),
        username: username,
        password: password,
        url: url,
        notes: notes,
        category: 'Login',
        folderId: targetFolderId,
        favorite: !!item.favorite,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  } 
  // Generic Array of Objects (Dashlane JSON, etc.)
  else if (Array.isArray(jsonObj)) {
    return processParsedCsv(jsonObj, format, targetFolderId);
  } 
  else {
    throw new Error('Unsupported JSON file structure.');
  }

  return entries;
}

function processParsedCsv(data: any[], format: ImportFormatType, targetFolderId: string): VaultEntry[] {
  const entries: VaultEntry[] = [];
  
  for (const row of data) {
    // Attempt to map fields based on common aliases
    const getField = (aliases: string[]): string => {
      for (const alias of aliases) {
        if (row[alias] !== undefined && row[alias] !== null) {
          return String(row[alias]).trim();
        }
      }
      return '';
    };

    const title = getField(['name', 'title', 'Title', 'name(title)']);
    const username = getField(['username', 'login_username', 'Username', 'login']);
    const password = getField(['password', 'login_password', 'Password', 'pass']);
    const url = getField(['url', 'login_uri', 'website', 'Website', 'uri']);
    const notes = getField(['notes', 'extra', 'note', 'Notes']);
    
    // Some services have an 'is_favorite' or 'fav' column
    const favoriteRaw = getField(['favorite', 'fav', 'is_favorite']);
    const favorite = favoriteRaw === '1' || favoriteRaw.toLowerCase() === 'true';

    // If an entry is empty or has no meaningful data, skip it
    if (!title && !username && !password && !url) {
      continue;
    }

    const entry: VaultEntry = {
      id: generateId(),
      title: title || (url ? extractDomain(url) : 'Imported Entry'),
      username: username,
      password: password,
      url: url,
      notes: notes,
      category: 'Login', // Default all CSV imports to Login, as that's 99% of them
      folderId: targetFolderId,
      favorite: favorite,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    entries.push(entry);
  }

  return entries;
}

function extractDomain(url: string): string {
  try {
    let hostname = url;
    if (!hostname.startsWith('http')) {
      hostname = 'https://' + hostname;
    }
    const parsed = new URL(hostname);
    return parsed.hostname.replace(/^www\./, '');
  } catch (e) {
    return url;
  }
}
