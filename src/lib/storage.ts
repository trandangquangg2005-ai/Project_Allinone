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

function blobEnabled(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;
  if (process.env.VERCEL) return true; // OIDC auth when the store is connected
  if (process.env.NODE_ENV === "production") {
    throw new Error("Blob storage is not configured (connect a private Blob store)");
  }
  return false;
}

function localPath(pathname: string) {
  const resolved = path.resolve(LOCAL_ROOT, pathname);
  if (!resolved.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid pathname");
  return resolved;
}

export async function putPrivateFile(pathname: string, data: Buffer, contentType: string): Promise<void> {
  if (blobEnabled()) {
    // Unique pathnames: a retried upload fails loudly instead of overwriting.
    await put(pathname, data, { access: "private", contentType, addRandomSuffix: false });
    return;
  }
  const file = localPath(pathname);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
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
  const headers = {
    "Cache-Control": "private, no-cache",
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
