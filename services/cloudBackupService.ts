import { ExportPayload } from '../types/vault';
import { encryptData } from './cryptoService';

/**
 * Uploads an encrypted backup to a given S3 pre-signed URL.
 */
export async function uploadToCloud(presignedUrl: string, payload: ExportPayload, mek: Uint8Array): Promise<void> {
  const jsonPayload = JSON.stringify(payload);
  const encryptedPayload = encryptData(jsonPayload, mek);
  
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: encryptedPayload,
  });
  
  if (!response.ok) {
    throw new Error(`Cloud backup failed: ${response.statusText}`);
  }
}
