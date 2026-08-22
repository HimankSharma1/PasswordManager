import 'react-native-get-random-values';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';
import { gcm } from '@noble/ciphers/aes';
import { randomBytes } from '@noble/hashes/utils';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import { EFF_WORDLIST } from '../utils/wordlist';

// Constants
const ITERATIONS = 25000;
const KEY_LENGTH = 32; // 256 bits

/**
 * Derives a 256-bit key from the given password and salt using PBKDF2 with SHA-256.
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const passwordBytes = new TextEncoder().encode(password);
  return await pbkdf2Async(sha256, passwordBytes, salt, { c: ITERATIONS, dkLen: KEY_LENGTH });
}

/**
 * Encrypts a string payload using AES-256-GCM.
 * Returns a base64 encoded string containing IV, Ciphertext, and Auth Tag.
 */
export function encryptData(plaintext: string, key: Uint8Array): string {
  // Generate 12-byte (96-bit) IV for GCM
  const iv = randomBytes(12);
  const dataBytes = new TextEncoder().encode(plaintext);
  
  // Encrypt with AES-GCM
  const aesGcm = gcm(key, iv);
  const encrypted = aesGcm.encrypt(dataBytes); // returns ciphertext + auth tag
  
  // Combine IV and Encrypted data
  const payload = new Uint8Array(iv.length + encrypted.length);
  payload.set(iv, 0);
  payload.set(encrypted, iv.length);
  
  // Convert to Base64
  return Buffer.from(payload).toString('base64');
}

/**
 * Decrypts a base64 encoded payload using AES-256-GCM.
 */
export function decryptData(payloadBase64: string, key: Uint8Array): string {
  const payload = new Uint8Array(Buffer.from(payloadBase64, 'base64'));
  
  // Extract IV (first 12 bytes)
  const iv = payload.slice(0, 12);
  const encrypted = payload.slice(12);
  
  const aesGcm = gcm(key, iv);
  const decryptedBytes = aesGcm.decrypt(encrypted);
  
  return new TextDecoder().decode(decryptedBytes);
}

/**
 * Generates a random 16-byte salt for key derivation.
 */
export function generateSalt(): Uint8Array {
  return randomBytes(16);
}

/**
 * Generates a random secure string using expo-crypto.
 */
export function generateRandomString(length: number, charset: string): string {
  let result = '';
  const randomValues = Crypto.getRandomBytes(length);
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  return result;
}

export interface GeneratePasswordOptions {
  length: number;
  useUppercase: boolean;
  useLowercase: boolean;
  useNumbers: boolean;
  useSymbols: boolean;
  minNumbers: number;
  minSymbols: number;
  avoidAmbiguous: boolean;
}

/**
 * Generates a password guaranteeing minimum character counts and optionally avoiding ambiguous characters.
 */
export function generateAdvancedPassword(options: GeneratePasswordOptions): string {
  const { length, useUppercase, useLowercase, useNumbers, useSymbols, minNumbers, minSymbols, avoidAmbiguous } = options;

  let upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let lowerChars = 'abcdefghijklmnopqrstuvwxyz';
  let numChars = '0123456789';
  let symChars = '!@#$%^&*()_+~|}{[]:;?><,./-=';

  if (avoidAmbiguous) {
    upperChars = upperChars.replace(/[ILO]/g, '');
    lowerChars = lowerChars.replace(/[lo]/g, '');
    numChars = numChars.replace(/[01]/g, '');
  }

  let requiredChars = '';
  
  if (useNumbers && minNumbers > 0) {
    const bytes = Crypto.getRandomBytes(minNumbers);
    for (let i = 0; i < minNumbers; i++) requiredChars += numChars[bytes[i] % numChars.length];
  }

  if (useSymbols && minSymbols > 0) {
    const bytes = Crypto.getRandomBytes(minSymbols);
    for (let i = 0; i < minSymbols; i++) requiredChars += symChars[bytes[i] % symChars.length];
  }

  // Ensure at least one character of selected types if not covered by minimums
  if (useUppercase) {
    requiredChars += upperChars[Crypto.getRandomBytes(1)[0] % upperChars.length];
  }
  if (useLowercase) {
    requiredChars += lowerChars[Crypto.getRandomBytes(1)[0] % lowerChars.length];
  }

  let fullCharset = '';
  if (useUppercase) fullCharset += upperChars;
  if (useLowercase) fullCharset += lowerChars;
  if (useNumbers) fullCharset += numChars;
  if (useSymbols) fullCharset += symChars;

  if (fullCharset === '') return '';

  let remainingLength = length - requiredChars.length;
  if (remainingLength < 0) remainingLength = 0;

  let remainingChars = '';
  if (remainingLength > 0) {
    const bytes = Crypto.getRandomBytes(remainingLength);
    for (let i = 0; i < remainingLength; i++) {
      remainingChars += fullCharset[bytes[i] % fullCharset.length];
    }
  }

  let finalArray = (requiredChars + remainingChars).split('');
  
  // Fisher-Yates Shuffle
  for (let i = finalArray.length - 1; i > 0; i--) {
    const j = Crypto.getRandomBytes(1)[0] % (i + 1);
    [finalArray[i], finalArray[j]] = [finalArray[j], finalArray[i]];
  }

  return finalArray.join('').slice(0, length);
}

export interface GeneratePassphraseOptions {
  wordsCount: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
  wordLength?: number;
}

export function generatePassphrase(options: GeneratePassphraseOptions): string {
  const { wordsCount, separator, capitalize, includeNumber, wordLength } = options;
  let phraseWords: string[] = [];
  
  if (wordsCount <= 0) return '';

  let dictionary = EFF_WORDLIST;
  if (wordLength && wordLength > 0) {
    const filtered = EFF_WORDLIST.filter(w => w.length === wordLength);
    if (filtered.length > 0) {
      dictionary = filtered;
    }
  }

  const randomBytes = Crypto.getRandomBytes(wordsCount * 2); // 2 bytes per word (up to 65535, enough for 1296 list)

  for (let i = 0; i < wordsCount; i++) {
    // Combine 2 bytes to get a 16-bit number
    const randNum = (randomBytes[i * 2] << 8) | randomBytes[i * 2 + 1];
    let word = dictionary[randNum % dictionary.length];
    
    if (capitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }
    phraseWords.push(word);
  }

  if (includeNumber) {
    const randomIdx = Crypto.getRandomBytes(1)[0] % phraseWords.length;
    const randomNum = Crypto.getRandomBytes(1)[0] % 10;
    phraseWords[randomIdx] += randomNum.toString();
  }

  return phraseWords.join(separator);
}

export interface GenerateUsernameOptions {
  type: 'word' | 'string' | 'catchall' | 'plus';
  length?: number;
  wordLength?: number;
  capitalize?: boolean;
  includeNumber?: boolean;
  domainName?: string;
  emailAddress?: string;
  useUppercase?: boolean;
  useLowercase?: boolean;
  useNumbers?: boolean;
  useSymbols?: boolean;
  minNumbers?: number;
  minSymbols?: number;
  avoidAmbiguous?: boolean;
}

export function generateUsername(options: GenerateUsernameOptions): string {
  if (options.type === 'word') {
    return generatePassphrase({
      wordsCount: 1,
      separator: '',
      capitalize: !!options.capitalize,
      includeNumber: !!options.includeNumber,
      wordLength: options.wordLength
    });
  } else if (options.type === 'string') {
    const len = options.length && options.length > 0 ? options.length : 8;
    return generateAdvancedPassword({
      length: len,
      useUppercase: options.useUppercase ?? true,
      useLowercase: options.useLowercase ?? true,
      useNumbers: options.useNumbers ?? true,
      useSymbols: options.useSymbols ?? false,
      minNumbers: options.minNumbers ?? 1,
      minSymbols: options.minSymbols ?? 0,
      avoidAmbiguous: options.avoidAmbiguous ?? true
    });
  } else if (options.type === 'catchall') {
    const randomStr = generateAdvancedPassword({
      length: 8,
      useUppercase: false,
      useLowercase: true,
      useNumbers: true,
      useSymbols: false,
      minNumbers: 2,
      minSymbols: 0,
      avoidAmbiguous: true
    });
    const domain = options.domainName || 'example.com';
    return `${randomStr}@${domain}`;
  } else if (options.type === 'plus') {
    const randomStr = generateAdvancedPassword({
      length: 8,
      useUppercase: false,
      useLowercase: true,
      useNumbers: true,
      useSymbols: false,
      minNumbers: 2,
      minSymbols: 0,
      avoidAmbiguous: true
    });
    
    const email = options.emailAddress || 'user@example.com';
    const atIndex = email.lastIndexOf('@');
    if (atIndex !== -1) {
      const local = email.slice(0, atIndex);
      const domain = email.slice(atIndex);
      return `${local}+${randomStr}${domain}`;
    } else {
      return `${email}+${randomStr}@example.com`;
    }
  }
  return '';
}
