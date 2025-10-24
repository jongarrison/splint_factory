import base32 from 'base32-crockford';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const OBJECT_ID_LENGTH = 4; // 4 characters = 1,048,576 combinations
const MAX_RETRIES = 10;

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
    // Generate random bytes and convert to number
    const randomBytes = crypto.randomBytes(3); // 3 bytes = 24 bits (more than enough for 20-bit 4-char ID)
    const randomNum = randomBytes.readUIntBE(0, 3);
    
    // Encode to Crockford Base32 and pad to 4 characters
    let objectID = base32.encode(randomNum);
    
    // Pad with leading zeros if needed (rare, but possible for small random numbers)
    objectID = objectID.padStart(OBJECT_ID_LENGTH, '0');
    
    // Trim to exactly 4 characters (in case encoding produces more)
    objectID = objectID.substring(0, OBJECT_ID_LENGTH);
    
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
  return base32.decode(objectID);
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
