"use client";

/**
 * The bytes of the files attached to tasks, in Supabase Storage (private bucket
 * `task-files`). Uploads are resumable (the TUS protocol, in 6 MB parts): a
 * connection that drops in the middle of a 90 MB video picks up where it was
 * instead of starting again. The member's own token goes with every request, so
 * the storage server applies the same policies as for a plain upload.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";
import { SUPABASE_KEY, SUPABASE_URL } from "../supabase/config";
import type { FileUpload } from "./adapter";

export const FILES_BUCKET = "task-files";
/** Imposed by the storage server: every part but the last is exactly this size. */
const PART_BYTES = 6 * 1024 * 1024;
const SIGNED_FOR_SECONDS = 3600;

export class UploadAborted extends Error {
  constructor() {
    super("Envoi annulé.");
    this.name = "UploadAborted";
  }
}

/** The server said no, and would say no again: trying the same file once more is no use. */
export class UploadRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadRefused";
  }
}

/** A sentence for the member, from whatever the storage server or the network said. */
function uploadFailure(error: unknown): Error {
  const detailed = error as { originalResponse?: { getStatus(): number; getBody(): string } | null; message?: string };
  const status = detailed.originalResponse?.getStatus() ?? 0;
  const body = `${detailed.originalResponse?.getBody() ?? ""} ${detailed.message ?? ""}`;
  if (status === 413 || /maximum allowed size|maximum size exceeded|payload too large/i.test(body))
    return new UploadRefused("Le stockage de l'équipe a refusé ce fichier : il dépasse la taille permise par fichier.");
  if (status === 401 || status === 403 || /row-level security|not authorized|unauthorized/i.test(body))
    return new UploadRefused("Action refusée : vous n'avez pas les droits nécessaires.");
  if (status === 409 || /already exists/i.test(body)) return new UploadRefused("Ce fichier a déjà été envoyé.");
  if (status === 0) return new Error("Connexion perdue pendant l'envoi.");
  return new Error("L'envoi a échoué.");
}

export function uploadToStorage(sb: SupabaseClient, { path, file, contentType, onProgress, signal }: FileUpload): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new UploadAborted());
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      chunkSize: PART_BYTES,
      retryDelays: [0, 2000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      // Resuming is for a connection that drops, not for another visit: nothing is kept in the browser.
      storeFingerprintForResuming: false,
      removeFingerprintOnSuccess: true,
      headers: { apikey: SUPABASE_KEY, "x-upsert": "false" },
      metadata: { bucketName: FILES_BUCKET, objectName: path, contentType, cacheControl: "3600" },
      // A long upload can outlive a token: each request takes the current one.
      async onBeforeRequest(req) {
        const { data } = await sb.auth.getSession();
        if (data.session) req.setHeader("Authorization", `Bearer ${data.session.access_token}`);
      },
      onProgress: (sent, total) => onProgress?.(sent, total),
      onError: (error) => reject(signal?.aborted ? new UploadAborted() : uploadFailure(error)),
      onSuccess: () => resolve(),
    });
    signal?.addEventListener(
      "abort",
      () => {
        // `true`: the server forgets the parts already received.
        void upload.abort(true).catch(() => undefined);
        reject(new UploadAborted());
      },
      { once: true },
    );
    upload.start();
  });
}

/** Signed addresses already asked for, until shortly before they expire. */
const signed = new Map<string, { url: string; until: number }>();

export async function storageUrl(sb: SupabaseClient, path: string, download?: string): Promise<string> {
  const known = signed.get(path);
  let url = known && known.until > Date.now() ? known.url : null;
  if (!url) {
    const { data, error } = await sb.storage.from(FILES_BUCKET).createSignedUrl(path, SIGNED_FOR_SECONDS);
    if (error || !data?.signedUrl) throw new Error("Ce fichier est introuvable : il a peut-être été retiré.");
    url = data.signedUrl;
    signed.set(path, { url, until: Date.now() + (SIGNED_FOR_SECONDS - 300) * 1000 });
  }
  // The name to save the file under is added here, encoded once: asked for through the
  // client library it is encoded twice, and « Résumé.txt » comes down as « R%C3%A9sum%C3%A9.txt ».
  return download ? `${url}&download=${encodeURIComponent(download)}` : url;
}

export async function removeFromStorage(sb: SupabaseClient, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  for (const path of paths) signed.delete(path);
  const { error } = await sb.storage.from(FILES_BUCKET).remove(paths);
  if (error) throw new Error("Les fichiers n'ont pas pu être retirés du stockage.");
}
