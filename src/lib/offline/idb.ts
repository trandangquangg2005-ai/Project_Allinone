"use client";

/**
 * A very small IndexedDB wrapper. No dependency, no schema migrations beyond
 * bumping VERSION: the database only holds work that has not reached the
 * server yet, plus a little bookkeeping.
 */

const DB_NAME = "aio-offline";
const VERSION = 1;

export const QUEUE = "queue";
export const META = "meta";

let opening: Promise<IDBDatabase> | null = null;

export function idbSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

function open(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(QUEUE)) {
          db.createObjectStore(QUEUE, { keyPath: "id" }).createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      };
      request.onsuccess = () => {
        // A newer tab upgraded the schema: drop this handle and reopen later.
        request.result.onversionchange = () => {
          request.result.close();
          opening = null;
        };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    }).catch((error: unknown) => {
      opening = null;
      throw error;
    });
  }
  return opening;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const idb = {
  get: <T>(store: string, key: IDBValidKey) => run<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>),
  getAll: <T>(store: string) => run<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>),
  put: (store: string, value: unknown, key?: IDBValidKey) => run(store, "readwrite", (s) => s.put(value, key)),
  delete: (store: string, key: IDBValidKey) => run(store, "readwrite", (s) => s.delete(key)),
  clear: (store: string) => run(store, "readwrite", (s) => s.clear()),
};
