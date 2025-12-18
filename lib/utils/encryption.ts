import crypto from "crypto";

/**
 * Encryption key for SSN encryption
 * In production, this should be stored in environment variables
 * and should be a 32-byte (256-bit) key for AES-256
 */
const ENCRYPTION_KEY = process.env.SSN_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Derives a 32-byte key from the encryption key string
 * If the key is already 64 hex characters (32 bytes), use it directly
 * Otherwise, hash it to get a consistent 32-byte key
 */
function getKey(): Buffer {
  let keyString: string;
  if (ENCRYPTION_KEY.length === 64 && /^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
    // Key is already 64 hex characters (32 bytes)
    keyString = ENCRYPTION_KEY;
  } else {
    // Hash the key to get a consistent 32-byte key
    keyString = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest("hex");
  }
  return Buffer.from(keyString, "hex");
}

/**
 * Encrypts a plaintext SSN
 * @param plaintext - The SSN to encrypt (9 digits)
 * @returns Encrypted SSN as a hex string (format: iv:authTag:encryptedData)
 */
export function encryptSSN(plaintext: string): string {
  if (!plaintext || typeof plaintext !== "string") {
    throw new Error("Invalid SSN: must be a non-empty string");
  }

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Return format: iv:authTag:encryptedData (all in hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an encrypted SSN
 * @param encryptedData - The encrypted SSN (format: iv:authTag:encryptedData)
 * @returns Decrypted SSN (9 digits)
 */
export function decryptSSN(encryptedData: string): string {
  if (!encryptedData || typeof encryptedData !== "string") {
    throw new Error("Invalid encrypted SSN: must be a non-empty string");
  }

  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted SSN format");
  }

  const [ivHex, authTagHex, encrypted] = parts;

  try {
    const key = getKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(`Failed to decrypt SSN: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

