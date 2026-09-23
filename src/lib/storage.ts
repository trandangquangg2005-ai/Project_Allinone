import "server-only";
import { del, get, put } from "@vercel/blob";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Private photo storage.
 * - On Vercel (or locally with BLOB_READ_WRITE_TOKEN): a *private* Vercel Blob
 *   store; files are only reachable through our authorising route handlers.
 * - In local development without a token: files under ./.uploads.
 */

const LOCAL_ROOT = path.join(process.cwd(), ".uploads");

/** Photo storage failed for a reason the person on screen should be told. */
export class StorageError extends Error {}

const NOT_CONNECTED =
  "Chưa lưu được ảnh vì kho ảnh chưa sẵn sàng. Vào Vercel → Storage, tạo Blob store ở chế độ Private, bấm Connect vào project rồi Redeploy.";

function blobEnabled(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;
  if (process.env.VERCEL) return true; // OIDC auth when the store is connected
  if (process.env.NODE_ENV === "production") throw new StorageError(NOT_CONNECTED);
  return false;
}

/**
 * The Blob SDK's own errors ("No token found", "store not found", …) mean one
 * thing to the person holding the phone: the photo did not get saved. Say that,
 * and keep the original text in the server log for whoever fixes it.
 */
export function storageFailure(error: unknown, action: string): StorageError {
  if (error instanceof StorageError) return error;
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[storage] ${action} failed:`, detail);
  if (/token|store|unauthor|forbidden|not.*found|access/i.test(detail)) return new StorageError(NOT_CONNECTED);
  return new StorageError("Không lưu được ảnh. Hãy thử lại; nếu vẫn lỗi thì kiểm tra kho ảnh trên Vercel.");
}

function localPath(pathname: string) {
  const resolved = path.resolve(LOCAL_ROOT, pathname);
  if (!resolved.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid pathname");
  return resolved;
}

export async function putPrivateFile(pathname: string, data: Buffer, contentType: string): Promise<void> {
  try {
    if (blobEnabled()) {
      // Unique pathnames: a retried upload fails loudly instead of overwriting.
      await put(pathname, data, { access: "private", contentType, addRandomSuffix: false });
      return;
    }
    const file = localPath(pathname);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  } catch (error) {
    throw storageFailure(error, `put ${pathname}`);
  }
}

/**
 * Round-trips a tiny file so an admin can see whether photos can be stored at
 * all, without waiting for a real lesson to fail. Costs one write.
 */
export async function checkStorage(): Promise<{ ok: true; where: string } | { ok: false; error: string }> {
  const pathname = `_healthcheck/${Date.now()}.txt`;
  try {
    await putPrivateFile(pathname, Buffer.from("aio"), "text/plain");
    await deletePrivateFiles([pathname]);
    return { ok: true, where: blobEnabled() ? "Vercel Blob (private)" : "thư mục .uploads trên máy" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function deletePrivateFiles(pathnames: string[]): Promise<void> {
  if (!pathnames.length) return;
  if (blobEnabled()) {
    await del(pathnames);
    return;
  }
  await Promise.all(pathnames.map((p) => rm(localPath(p), { force: true })));
}

/**
 * Streams a stored file back as a Response, honouring If-None-Match.
 * `contentType` is the type recorded when the file was stored; the Blob store
 * reports its own, the local dev store does not.
 */
export async function privateFileResponse(
  pathname: string,
  request: Request,
  contentType = "image/jpeg",
): Promise<Response> {
  // A photo id is never reused, so the bytes behind this URL never change:
  // the browser may keep it for good. That matters on the free tiers — every
  // re-fetch would otherwise cost a Blob read, a function call and egress.
  // `private` keeps it out of shared caches; only this browser holds a copy.
  const headers = {
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };

  if (blobEnabled()) {
    const result = await get(pathname, {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
    });
    if (!result) return new Response("Not found", { status: 404 });
    if (result.statusCode === 304) {
      return new Response(null, { status: 304, headers: { ...headers, ETag: result.blob.etag } });
    }
    return new Response(result.stream, {
      headers: { ...headers, "Content-Type": result.blob.contentType, ETag: result.blob.etag },
    });
  }

  try {
    const file = localPath(pathname);
    const info = await stat(file);
    const etag = `"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ...headers, ETag: etag } });
    }
    return new Response(new Uint8Array(await readFile(file)), {
      headers: { ...headers, "Content-Type": contentType, ETag: etag },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
