import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET is missing or too short");
  return value;
}

function shareKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", secret(), "aio", "share-link-token-v1", 32));
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

/** AES-256-GCM, output "iv.ciphertext.tag" (base64url). */
export function encryptText(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", shareKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, body, cipher.getAuthTag()].map((b) => b.toString("base64url")).join(".");
}

export function decryptText(payload: string): string | null {
  try {
    const [iv, body, tag] = payload.split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", shareKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
