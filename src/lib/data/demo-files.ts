/**
 * The bytes of attached files in demo mode: kept in the browser (IndexedDB, so a
 * 60 MB video does not have to fit in localStorage, and every tab sees it), or
 * in memory for this visit when the browser offers no database.
 */
import { SEED_FILES } from "./seed-files";

const DB_NAME = "tthq-demo-files";
const STORE = "files";

const memory = new Map<string, Blob>();
const urls = new Map<string, string>();
let opening: Promise<IDBDatabase | null> | null = null;

function database(): Promise<IDBDatabase | null> {
  opening ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return database().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const request = work(db.transaction(STORE, mode).objectStore(STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export async function putDemoFile(path: string, file: Blob): Promise<void> {
  memory.set(path, file);
  await run("readwrite", (store) => store.put(file, path));
}

async function readDemoFile(path: string): Promise<Blob | null> {
  const here = memory.get(path);
  if (here) return here;
  const stored = await run<Blob>("readonly", (store) => store.get(path) as IDBRequest<Blob>);
  if (stored) return stored;
  // The files of the sample data are drawn on demand: they were never uploaded.
  const seeded = SEED_FILES[path.split("/")[1] ?? ""];
  return seeded ? new Blob([seeded.body], { type: seeded.type }) : null;
}

export async function demoFileUrl(path: string): Promise<string> {
  const known = urls.get(path);
  if (known) return known;
  const blob = await readDemoFile(path);
  if (!blob) throw new Error("Ce fichier est introuvable : il a peut-être été retiré.");
  const url = URL.createObjectURL(blob);
  urls.set(path, url);
  return url;
}

export async function removeDemoFiles(paths: string[]): Promise<void> {
  for (const path of paths) {
    memory.delete(path);
    const url = urls.get(path);
    if (url) URL.revokeObjectURL(url);
    urls.delete(path);
    await run("readwrite", (store) => store.delete(path));
  }
}

/** « Réinitialiser la démo » : every uploaded file goes. */
export async function clearDemoFiles(): Promise<void> {
  memory.clear();
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
  await run("readwrite", (store) => store.clear());
}
