/**
 * Files attached to tasks: the rules that do not depend on where the bytes are
 * stored. The same limit is written on the bucket and on the row (see the
 * migration `task_attachments`): this one lets the app say no before uploading.
 */
import type { TaskAttachment } from "./types";
import { uid } from "./utils";

/** 100 MB a file. */
export const ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024;
/** How many files a single drop or selection may bring. More is almost always a mistake. */
export const ATTACHMENT_MAX_AT_ONCE = 20;
/** An image this light is shown as it is: no thumbnail is made for it. */
const THUMB_NOT_NEEDED_BELOW = 300 * 1024;
const THUMB_EDGE = 480;

export type AttachmentKind = "image" | "video" | "audio" | "pdf" | "text" | "file";

const EXTENSION_KIND: Record<string, AttachmentKind> = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", avif: "image", svg: "image", heic: "image", heif: "image", bmp: "image",
  mp4: "video", mov: "video", webm: "video", m4v: "video", avi: "video", mkv: "video",
  mp3: "audio", wav: "audio", m4a: "audio", ogg: "audio", aac: "audio", flac: "audio",
  pdf: "pdf",
  txt: "text", md: "text", csv: "text", json: "text", log: "text",
};

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : "";
}

/** What a file is, for the way it is shown. The type the browser gave wins; the extension settles the rest. */
export function attachmentKind(file: { mime_type: string; name: string }): AttachmentKind {
  const mime = file.mime_type.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("text/")) return "text";
  return EXTENSION_KIND[extensionOf(file.name)] ?? "file";
}

/** What the browser itself can show in a page: the rest is downloaded. */
export function canPreview(file: { mime_type: string; name: string }): boolean {
  const kind = attachmentKind(file);
  if (kind === "image") return !["heic", "heif"].includes(extensionOf(file.name));
  if (kind === "video") return ["mp4", "webm", "mov", "m4v", ""].includes(extensionOf(file.name));
  return kind === "audio" || kind === "pdf";
}

/** « 482 Ko », « 12,4 Mo ». */
export function formatBytes(bytes: number): string {
  const comma = (n: number) => n.toLocaleString("fr-CA", { maximumFractionDigits: 1 });
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${comma(Math.round((bytes / (1024 * 1024)) * 10) / 10)} Mo`;
  return `${comma(Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10)} Go`;
}

/** Why this file cannot be attached, in words; null when it can. */
export function attachmentProblem(file: { name: string; size: number }): string | null {
  if (file.size > ATTACHMENT_MAX_BYTES) return `Ce fichier pèse ${formatBytes(file.size)} : la limite est de ${formatBytes(ATTACHMENT_MAX_BYTES)}.`;
  if (!file.name.trim()) return "Ce fichier n'a pas de nom.";
  return null;
}

/**
 * The name of the stored object. The storage server only takes plain ASCII
 * names, so « Maquette d'accueil (v2).PNG » is stored as
 * `maquette-d-accueil-v2.png`; the member's own name is kept on the row and
 * given back when the file is downloaded.
 */
export function plainFileName(name: string): string {
  const ext = extensionOf(name).replace(/[^a-z0-9]/g, "").slice(0, 10);
  const stem = (ext ? name.slice(0, name.lastIndexOf(".")) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${stem || "fichier"}${ext ? `.${ext}` : ""}`;
}

/** The row of a file about to be uploaded: its id decides where the bytes go. */
export function newAttachment(taskId: string, file: { name: string; type: string; size: number }, uploaderId: string | null, now: string): TaskAttachment {
  const id = uid();
  const name = file.name.trim().slice(0, 255);
  return {
    id,
    task_id: taskId,
    uploader_id: uploaderId,
    name,
    mime_type: (file.type || "application/octet-stream").slice(0, 255),
    size: file.size,
    storage_path: `${taskId}/${id}/${plainFileName(name)}`,
    thumb_path: null,
    created_at: now,
  };
}

export const thumbPathOf = (attachment: TaskAttachment) => `${attachment.task_id}/${attachment.id}/apercu.jpg`;

/** Every stored object of these rows: what to remove from the store of files when they go. */
export function storedPaths(attachments: TaskAttachment[]): string[] {
  return attachments.flatMap((a) => (a.thumb_path ? [a.storage_path, a.thumb_path] : [a.storage_path]));
}

/* ------------------------------ thumbnails ------------------------------ */

function drawToJpeg(source: CanvasImageSource, width: number, height: number): Promise<Blob | null> {
  const scale = Math.min(1, THUMB_EDGE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  // A transparent picture gets a paper background: JPEG has no transparency.
  ctx.fillStyle = "#f6f5f1";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.82));
}

async function imageThumbnail(file: Blob): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    return await drawToJpeg(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/** One frame of the video, a little after its start (the very first one is often black). */
function videoThumbnail(file: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    // A format the browser cannot read never answers: the tile shows a glyph instead.
    const timer = window.setTimeout(() => finish(null), 6000);
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onerror = () => finish(null);
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
    };
    video.onseeked = () => {
      if (!video.videoWidth) return finish(null);
      drawToJpeg(video, video.videoWidth, video.videoHeight).then(finish, () => finish(null));
    };
    video.src = url;
  });
}

/**
 * A small picture of a photo or a video, made in the browser before the upload:
 * a list of files then costs a few kilobytes each, not the files themselves.
 * Null when there is nothing to show, or when the browser cannot read the file.
 */
export async function makeThumbnail(file: Blob & { name?: string }): Promise<Blob | null> {
  const kind = attachmentKind({ mime_type: file.type, name: file.name ?? "" });
  try {
    if (kind === "image") return file.size < THUMB_NOT_NEEDED_BELOW ? null : await imageThumbnail(file);
    if (kind === "video") return await videoThumbnail(file);
  } catch {
    /* unreadable here (HEIC outside Safari, a damaged file…): no thumbnail */
  }
  return null;
}
