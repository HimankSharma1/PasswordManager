const { pbkdf2Async } = require('@noble/hashes/pbkdf2');
const { sha256 } = require('@noble/hashes/sha2');
const { gcm } = require('@noble/ciphers/aes');
const { randomBytes } = require('@noble/hashes/utils');

async function deriveKey(password, salt) {
  const passwordBytes = new TextEncoder().encode(password);
  return await pbkdf2Async(sha256, passwordBytes, salt, { c: 25000, dkLen: 32 });
}

function encryptData(plaintext, key) {
  const iv = randomBytes(12);
  const dataBytes = new TextEncoder().encode(plaintext);
  const aesGcm = gcm(key, iv);
  const encrypted = aesGcm.encrypt(dataBytes);
  const payload = new Uint8Array(iv.length + encrypted.length);
  payload.set(iv, 0);
  payload.set(encrypted, iv.length);
  return Buffer.from(payload).toString('base64');
}

function decryptData(payloadBase64, key) {
  const payload = new Uint8Array(Buffer.from(payloadBase64, 'base64'));
  const iv = payload.slice(0, 12);
  const encrypted = payload.slice(12);
  const aesGcm = gcm(key, iv);
  const decryptedBytes = aesGcm.decrypt(encrypted);
  return new TextDecoder().decode(decryptedBytes);
}

async function test() {
  const payload = JSON.stringify({ version: 1, entries: [] });
  const exportPassword = "mysecretpassword123";
  
  // Export
  const salt = randomBytes(16);
  const exportKey = await deriveKey(exportPassword, salt);
  const ciphertext = encryptData(payload, exportKey);
  const saltBase64 = Buffer.from(salt).toString('base64');
  
  const encryptedPayload = JSON.stringify({ salt: saltBase64, payload: ciphertext });
  
  // Import
  const parsedContent = JSON.parse(encryptedPayload);
  const importSalt = new Uint8Array(Buffer.from(parsedContent.salt, 'base64'));
  const importKey = await deriveKey(exportPassword, importSalt);
  
  try {
    const decryptedJson = decryptData(parsedContent.payload, importKey);
    console.log("Success! Decrypted:", decryptedJson);
  } catch (err) {
    console.error("Failed to decrypt:", err.message);
  }
}

test();
