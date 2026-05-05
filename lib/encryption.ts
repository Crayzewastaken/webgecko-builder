import crypto from "crypto";

const algorithm = "aes-256-gcm";

// Derive a 256-bit key from an arbitrary-length secret via SHA-256.
function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

// Primary key from env -- required in production.
function getPrimaryKey(): Buffer {
  const secret = process.env.PAYLOAD_ENCRYPTION_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PAYLOAD_ENCRYPTION_KEY env var is required in production");
    }
    // Dev/test only -- never used for real data.
    console.warn("[encryption] PAYLOAD_ENCRYPTION_KEY not set -- using dev fallback key");
    return deriveKey("webgecko-dev-only-fallback-key");
  }
  if (Buffer.byteLength(secret, "utf8") < 16) {
    throw new Error("PAYLOAD_ENCRYPTION_KEY must be at least 16 characters");
  }
  return deriveKey(secret);
}

// Legacy key -- only for decrypting old records encrypted with the hardcoded secret.
// Never used to encrypt new records.
const LEGACY_KEY = deriveKey("webgecko-super-secret-key");

export function encryptPayload(data: unknown) {
  const key = getPrimaryKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    // v:2 = encrypted with PAYLOAD_ENCRYPTION_KEY.
    // Missing / v:1 = legacy hardcoded key -- decryptPayload handles both.
    v: 2,
  };
}

export function decryptPayload(
  encrypted: string,
  iv: string,
  tag: string,
  v?: number,
) {
  // v >= 2 uses primary env key; anything older uses legacy key (read-only compat).
  const key = (!v || v < 2) ? LEGACY_KEY : getPrimaryKey();

  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(tag, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
}
