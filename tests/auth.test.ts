import { beforeAll, describe, expect, it } from "vitest";
import { generateTempPassword, hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSession, verifySession } from "@/lib/auth/session";
import { decryptText, encryptText, randomToken, sha256 } from "@/lib/crypto";

beforeAll(() => {
  process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-0123";
});

describe("passwords", () => {
  it("hashes with embedded parameters and verifies", async () => {
    const hash = await hashPassword("mật khẩu thử 123");
    expect(hash.startsWith("scrypt$131072$8$1$")).toBe(true);
    expect(await verifyPassword("mật khẩu thử 123", hash)).toBe(true);
    expect(await verifyPassword("mat khau thu 123", hash)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("generates readable temporary passwords", () => {
    const pw = generateTempPassword();
    expect(pw).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
    expect(pw).not.toMatch(/[01lIO]/);
  });
});

describe("sessions", () => {
  it("round-trips claims and rejects tampering", async () => {
    const token = await signSession("11111111-1111-4111-8111-111111111111", 3);
    const claims = await verifySession(token);
    expect(claims?.sub).toBe("11111111-1111-4111-8111-111111111111");
    expect(claims?.ver).toBe(3);
    const [header, body, signature] = token.split(".");
    expect(await verifySession(`${header}.${body}.${signature.slice(0, -2)}xx`)).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });
});

describe("share-link crypto", () => {
  it("encrypts tokens and detects tampering", () => {
    const token = randomToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const cipher = encryptText(token);
    expect(decryptText(cipher)).toBe(token);
    const [iv, body, tag] = cipher.split(".");
    expect(decryptText(`${iv}.${body}.${tag.slice(0, -2)}AA`)).toBeNull();
    expect(sha256(token)).toBe(sha256(token));
    expect(sha256(token)).not.toBe(sha256(`${token}x`));
  });
});
