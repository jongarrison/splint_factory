import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const OBJECT_ID_LENGTH = 4; // 4 characters = 1,048,576 combinations
const MAX_RETRIES = 10;

// Crockford Base32 alphabet (excludes I, L, O, U for readability)
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Encode a number using Crockford Base32
 * @param num - Number to encode
 * @returns Base32 string
 */
function encodeCrockford(num: number): string {
  if (num === 0) return '0';
  
  let result = '';
  let remaining = num;
  
  while (remaining > 0) {
    result = CROCKFORD_ALPHABET[remaining % 32] + result;
    remaining = Math.floor(remaining / 32);
  }
  
  return result;
}

/**
 * Generates a random 4-character Crockford Base32 ID for device identification.
 * Format: XXXX (e.g., "A3F7", "K9M2")
 * 
 * Uses random generation with collision detection and retry logic.
 * Character set: 0-9, A-Z (excluding I, L, O, U for readability)
 * 
 * @returns Promise<string> - A unique 4-character objectID
 * @throws Error if unable to generate unique ID after MAX_RETRIES attempts
 */
export async function generateObjectID(): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Generate random number in valid range for 4 Base32 characters
    // 4 chars = 32^4 = 1,048,576 combinations (0 to 1,048,575)
    // To avoid leading zeros, generate between 32768 (1000 in base32) and 1048575 (ZZZZ)
    // This ensures all IDs are exactly 4 characters without padding
    const minValue = 32768; // "1000" in base32 - ensures 4 chars minimum
    const maxValue = 1048575; // "ZZZZ" in base32 - max 4 chars
    const randomRange = maxValue - minValue + 1;
    
    // Generate random bytes and convert to number in range
    const randomBytes = crypto.randomBytes(3);
    const randomNum = randomBytes.readUIntBE(0, 3) % randomRange + minValue;
    
    // Encode to Crockford Base32 (will always be exactly 4 characters)
    const objectID = encodeCrockford(randomNum);
    
    // Verify length (should always be 4, this is a safety check)
    if (objectID.length !== OBJECT_ID_LENGTH) {
      console.warn(`Generated objectID has unexpected length: ${objectID} (length ${objectID.length})`);
      continue; // Try again
    }
    
    // Check for uniqueness
    const existing = await prisma.geometryProcessingQueue.findUnique({
      where: { objectID },
      select: { id: true }
    });
    
    if (!existing) {
      return objectID;
    }
    
    // Collision detected, log and retry
    console.warn(`ObjectID collision detected: ${objectID} (attempt ${attempt + 1}/${MAX_RETRIES})`);
  }
  
  throw new Error(`Failed to generate unique objectID after ${MAX_RETRIES} attempts`);
}

/**
 * Decodes an objectID string, handling common human errors.
 * Crockford Base32 automatically corrects: O→0, I/L→1, case-insensitive
 * 
 * @param objectID - The objectID to decode
 * @returns number - The decoded numeric value
 */
export function decodeObjectID(objectID: string): number {
  let normalized = objectID.toUpperCase();
  
  // Handle common human errors (Crockford substitutions)
  normalized = normalized.replace(/O/g, '0');
  normalized = normalized.replace(/[IL]/g, '1');
  
  let result = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const value = CROCKFORD_ALPHABET.indexOf(char);
    
    if (value === -1) {
      throw new Error(`Invalid character in objectID: ${char}`);
    }
    
    result = result * 32 + value;
  }
  
  return result;
}

/**
 * Validates if a string is a valid Crockford Base32 objectID format
 * 
 * @param objectID - The string to validate
 * @returns boolean - True if valid format
 */
export function isValidObjectID(objectID: string): boolean {
  if (!objectID || typeof objectID !== 'string') {
    return false;
  }
  
  // Must be 4+ characters (allows for future expansion to 5+ chars)
  if (objectID.length < 4) {
    return false;
  }
  
  // Must only contain valid Crockford Base32 characters (with lenient decoding support)
  const validPattern = /^[0-9A-Za-z]+$/;
  return validPattern.test(objectID);
}
