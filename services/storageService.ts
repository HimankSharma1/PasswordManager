import * as FileSystem from 'expo-file-system/legacy';
import { ExportPayload } from '../types/vault';
import { encryptData, decryptData } from './cryptoService';

const VAULT_FILE_URI = FileSystem.documentDirectory + 'vault.enc';

/**
 * Loads and decrypts the vault from the local file system.
 * If no vault exists, returns an empty initial payload.
 */
export async function loadVault(key: Uint8Array): Promise<ExportPayload> {
  const fileInfo = await FileSystem.getInfoAsync(VAULT_FILE_URI);
  if (!fileInfo.exists) {
    return { version: 1, timestamp: Date.now(), entries: [], folders: [] };
  }
  
  const encryptedPayload = await FileSystem.readAsStringAsync(VAULT_FILE_URI, { encoding: FileSystem.EncodingType.UTF8 });
  const decryptedJson = decryptData(encryptedPayload, key);
  
  return JSON.parse(decryptedJson) as ExportPayload;
}

/**
 * Encrypts and saves the vault payload to the local file system.
 */
export async function saveVault(payload: ExportPayload, key: Uint8Array): Promise<void> {
  const jsonPayload = JSON.stringify(payload);
  const encryptedPayload = encryptData(jsonPayload, key);
  
  await FileSystem.writeAsStringAsync(VAULT_FILE_URI, encryptedPayload, { encoding: FileSystem.EncodingType.UTF8 });
}

/**
 * Checks if a vault file currently exists on disk.
 */
export async function vaultExists(): Promise<boolean> {
  const fileInfo = await FileSystem.getInfoAsync(VAULT_FILE_URI);
  return fileInfo.exists;
}

/**
 * Completely purges the vault file from disk.
 */
export async function destroyVault(): Promise<void> {
  const fileInfo = await FileSystem.getInfoAsync(VAULT_FILE_URI);
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(VAULT_FILE_URI);
  }
}
