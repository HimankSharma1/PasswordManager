import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { ExportPayload } from '../types/vault';
import { encryptData, decryptData, deriveKey, generateSalt } from './cryptoService';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';

export async function exportVaultFile(payload: ExportPayload, exportPassword?: string, mek?: Uint8Array, useMasterPassword?: boolean): Promise<void> {
  const jsonPayload = JSON.stringify(payload);
  let encryptedPayload: string;
  
  if (useMasterPassword && mek) {
    const saltBase64 = await SecureStore.getItemAsync('vault_salt');
    if (!saltBase64) throw new Error('Missing vault salt. Cannot export with master password.');
    const ciphertext = encryptData(jsonPayload, mek);
    encryptedPayload = JSON.stringify({ salt: saltBase64, payload: ciphertext });
  } else if (exportPassword) {
    // Deriving a one-off key for export
    const salt = generateSalt();
    const exportKey = await deriveKey(exportPassword, salt);
    const ciphertext = encryptData(jsonPayload, exportKey);
    // Prepend the salt to the payload for decryption later
    const saltBase64 = Buffer.from(salt).toString('base64');
    encryptedPayload = JSON.stringify({ salt: saltBase64, payload: ciphertext });
  } else if (mek) {
    // Encrypting with the existing Master Encryption Key (Legacy / non-portable)
    encryptedPayload = encryptData(jsonPayload, mek);
  } else {
    throw new Error('Must provide either an export password or the active MEK.');
  }

  const exportUri = FileSystem.cacheDirectory + 'backup.vault';
  await FileSystem.writeAsStringAsync(exportUri, encryptedPayload, { encoding: FileSystem.EncodingType.UTF8 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(exportUri, { mimeType: 'application/octet-stream', dialogTitle: 'Export Password Vault' });
  }
}

export async function pickVaultFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  
  return result.assets[0].uri;
}

export async function processVaultFile(fileUri: string, importPassword?: string, mek?: Uint8Array): Promise<ExportPayload | null> {
  const fileContent = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });
  
  let decryptedJson: string;
  if (importPassword) {
    try {
      const parsedContent = JSON.parse(fileContent.trim());
      if (!parsedContent.salt || !parsedContent.payload) {
        throw new Error('This file was not exported with a password (it lacks a salt).');
      }
      const salt = new Uint8Array(Buffer.from(parsedContent.salt, 'base64'));
      const importKey = await deriveKey(importPassword, salt);
      decryptedJson = decryptData(parsedContent.payload, importKey);
    } catch (error: any) {
      throw new Error('Invalid vault file or wrong password: ' + (error.message || String(error)));
    }
  } else if (mek) {
    try {
      decryptedJson = decryptData(fileContent, mek);
    } catch (error: any) {
      throw new Error('Decryption failed: ' + (error.message || String(error)));
    }
  } else {
    throw new Error('Must provide either an import password or the active MEK.');
  }

  return JSON.parse(decryptedJson) as ExportPayload;
}
