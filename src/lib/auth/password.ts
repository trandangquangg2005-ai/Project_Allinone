import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt N=2^17, r=8, p=1 (OWASP minimum). Needs ~128 MiB, above Node's
// default 32 MiB maxmem, hence the explicit limit.
const PARAMS = { N: 2 ** 17, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
const MAX_MEM = 256 * 1024 * 1024;

export { PASSWORD_MIN_LENGTH } from "./password-rules";

function derive(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, { ...options, maxmem: MAX_MEM }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** "scrypt$N$r$p$salt$hash" so parameters can be raised later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | undefined;

/** Spend the same time as a real check when the username does not exist. */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("aio-timing-equaliser");
  await verifyPassword(password, await dummyHash);
}

// No 0/O, 1/l/I: temp passwords are often read aloud or retyped.
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** e.g. "Kx7m-Pq2r-Tn9w" (~70 bits). */
export function generateTempPassword(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}
