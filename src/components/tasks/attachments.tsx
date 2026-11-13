"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileBlank,
  FileText,
  ImageIcon,
  MoreHorizontal,
  Paperclip,
  Play,
  Plus,
  RotateCw,
  Trash2,
  Video,
  Volume2,
  X,
  type IconType,
} from "@/components/kit/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ATTACHMENT_MAX_BYTES, attachmentKind, canPreview, extensionOf, formatBytes, type AttachmentKind } from "@/lib/attachments";
import { relativeTime } from "@/lib/dates";
import { downloadFromUrl } from "@/lib/download";
import { useMembersMap, useNow } from "@/lib/hooks";
import { attachFiles, cancelUpload, deleteAttachment, fileUrl, retryUpload, ui, useApp, type PendingUpload } from "@/lib/store";
import type { Task, TaskAttachment } from "@/lib/types";
import { cn, firstName } from "@/lib/utils";

/** The standalone preview page cannot hand a file to the visitor: the action is not offered there. */
const CAN_DOWNLOAD = process.env.NEXT_PUBLIC_STANDALONE !== "1";

const KIND_ICON: Record<AttachmentKind, IconType> = {
  image: ImageIcon,
  video: Video,
  audio: Volume2,
  pdf: FileText,
  text: FileText,
  file: FileBlank,
};

/** The files of one task, oldest first, and what is on its way to it. */
export function useTaskFiles(taskId: string): { files: TaskAttachment[]; uploads: PendingUpload[] } {
  const all = useApp((s) => s.attachments);
  const pending = useApp((s) => s.uploads);
  return useMemo(
    () => ({
      files: Object.values(all)
        .filter((a) => a.task_id === taskId)
        .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1)),
      uploads: Object.values(pending).filter((u) => u.task_id === taskId),
    }),
    [all, pending, taskId],
  );
}

/** A temporary address for stored bytes; null until it is known (or when the file is gone). */
function useFileUrl(path: string | null): string | null {
  const [state, setState] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    fileUrl(path).then(
      (url) => alive && setState({ path, url }),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [path]);
  return state && state.path === path ? state.url : null;
}

async function download(file: TaskAttachment) {
  try {
    downloadFromUrl(await fileUrl(file.storage_path, file.name), file.name);
  } catch (err) {
    toast.error("Téléchargement impossible", { description: err instanceof Error ? err.message : undefined });
  }
}

function confirmRemoval(file: TaskAttachment, after?: () => void) {
  ui.confirm({
    title: "Retirer ce fichier ?",
    description: `« ${file.name} » sera retiré de la tâche et supprimé pour toute l'équipe.`,
    confirmLabel: "Retirer",
    destructive: true,
    onConfirm: async () => {
      await deleteAttachment(file.id);
      after?.();
    },
  });
}

/** What stands for a file that has no picture: the glyph of its kind and, when it has one, its extension. */
function KindMark({ file, className }: { file: { mime_type: string; name: string }; className?: string }) {
  const Icon = KIND_ICON[attachmentKind(file)];
  const ext = extensionOf(file.name);
  return (
    <span className={cn("flex flex-col items-center justify-center gap-1.5 text-navy-500", className)}>
      <Icon className="size-6" strokeWidth={1.5} />
      {ext && <span className="max-w-full truncate px-2 text-[10.5px] leading-none font-semibold tracking-wide uppercase">{ext}</span>}
    </span>
  );
}

/** The picture of a file in the list: its thumbnail, itself when it is a light image, or its mark. */
function Preview({ file }: { file: TaskAttachment }) {
  const kind = attachmentKind(file);
  const path = file.thumb_path ?? (kind === "image" && canPreview(file) ? file.storage_path : null);
  const url = useFileUrl(path);
  const [broken, setBroken] = useState(false);
  if (!path || broken) return <KindMark file={file} className="size-full" />;
  return (
    <>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className="size-full object-cover" />
      )}
      {kind === "video" && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-8 items-center justify-center rounded-full bg-scrim/60 text-white">
            <Play className="size-3.5" />
          </span>
        </span>
      )}
    </>
  );
}

const TILE = "relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-navy-900/[0.045]";

function FileTile({ file, onOpen }: { file: TaskAttachment; onOpen: () => void }) {
  const members = useMembersMap();
  const uploader = file.uploader_id ? members[file.uploader_id] : null;
  return (
    <li className="group min-w-0">
      <button type="button" onClick={onOpen} aria-label={`Ouvrir ${file.name}`} className={cn(TILE, "transition-shadow hover:shadow-card-hover focus-ring")}>
        <Preview file={file} />
      </button>
      <div className="mt-1.5 flex items-start gap-0.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] leading-4 font-medium text-navy-900" title={file.name}>
            {file.name}
          </p>
          <p className="truncate text-[11px] leading-4 text-navy-500">
            {formatBytes(file.size)}
            {uploader ? ` · ${firstName(uploader.full_name)}` : ""}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Actions pour ${file.name}`}
              className="-mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-navy-400 hover:bg-navy-900/[0.06] hover:text-navy-900 focus-ring data-[state=open]:bg-navy-900/[0.06]"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={onOpen}>
              <ImageIcon /> Ouvrir
            </DropdownMenuItem>
            {CAN_DOWNLOAD && (
              <DropdownMenuItem onSelect={() => void download(file)}>
                <Download /> Télécharger
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => confirmRemoval(file)}>
              <Trash2 /> Retirer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function UploadTile({ upload }: { upload: PendingUpload }) {
  const percent = upload.size > 0 ? Math.min(100, Math.round((upload.sent / upload.size) * 100)) : 0;
  const failed = !!upload.error;
  return (
    <li className="min-w-0" aria-busy={!failed}>
      <div className={cn(TILE, failed && "bg-coral-50")}>
        <KindMark file={upload} className={cn("size-full", failed ? "text-coral-700" : "opacity-60")} />
        {!failed && (
          <div
            role="progressbar"
            aria-label={`Envoi de ${upload.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="absolute inset-x-2.5 bottom-2.5 h-1 overflow-hidden rounded-full bg-navy-900/[0.12]"
          >
            <div className="h-full rounded-full bg-teal-500 transition-[width] duration-200" style={{ width: `${percent}%` }} />
          </div>
        )}
        <button
          type="button"
          onClick={() => cancelUpload(upload.id)}
          aria-label={failed ? `Retirer ${upload.name}` : `Annuler l'envoi de ${upload.name}`}
          className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-glaze/80 text-navy-700 hover:text-navy-900 focus-ring"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="mt-1.5 min-w-0">
        <p className="truncate text-[12.5px] leading-4 font-medium text-navy-900" title={upload.name}>
          {upload.name}
        </p>
        {failed ? (
          <p className="text-[11px] leading-4 text-coral-700">
            {upload.error}
            {!upload.refused && (
              <>
                {" "}
                <button type="button" onClick={() => retryUpload(upload.id)} className="inline-flex items-center gap-1 font-medium underline underline-offset-2 focus-ring">
                  <RotateCw className="size-3" /> Réessayer
                </button>
              </>
            )}
          </p>
        ) : (
          <p className="truncate text-[11px] leading-4 text-navy-500 tabular">
            {upload.sent > 0 ? `${percent} % de ${formatBytes(upload.size)}` : `En attente · ${formatBytes(upload.size)}`}
          </p>
        )}
      </div>
    </li>
  );
}

/* -------------------------------- viewer -------------------------------- */

/** A text file, read to be shown. Short files only: a log of 40 MB is for downloading. */
function TextPreview({ url }: { url: string }) {
  const [state, setState] = useState<{ url: string; text: string } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((r) => r.text())
      .then(
        (text) => alive && setState({ url, text: text.slice(0, 20000) }),
        () => alive && setState({ url, text: "" }),
      );
    return () => {
      alive = false;
    };
  }, [url]);
  if (!state || state.url !== url) return <div className="h-40 animate-pulse rounded-lg bg-navy-900/[0.05]" />;
  return (
    <pre className="max-h-[62vh] overflow-auto rounded-lg bg-navy-900/[0.04] p-4 text-left font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-navy-800">
      {state.text || "Ce fichier est vide."}
    </pre>
  );
}

function ViewerBody({ file }: { file: TaskAttachment }) {
  const kind = attachmentKind(file);
  const showable = canPreview(file) || (kind === "text" && file.size <= 200 * 1024);
  const url = useFileUrl(showable ? file.storage_path : null);
  const [failed, setFailed] = useState(false);

  if (!showable || failed) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
        <KindMark file={file} />
        <p className="max-w-xs text-[13px] leading-relaxed text-navy-600">
          {failed ? "Ce fichier ne peut pas être affiché ici." : "Pas d'aperçu pour ce type de fichier."}
          {CAN_DOWNLOAD && " Téléchargez-le pour l'ouvrir."}
        </p>
      </div>
    );
  }
  if (!url) return <div className="h-56 animate-pulse rounded-lg bg-navy-900/[0.05]" />;
  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={file.name} onError={() => setFailed(true)} className="mx-auto max-h-[68vh] max-w-full rounded-lg object-contain" />;
  }
  if (kind === "video") {
    return <video src={url} controls playsInline preload="metadata" onError={() => setFailed(true)} className="mx-auto max-h-[68vh] w-full rounded-lg bg-black" />;
  }
  if (kind === "audio") {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-5">
        <KindMark file={file} />
        <audio src={url} controls preload="metadata" onError={() => setFailed(true)} className="w-full max-w-md" />
      </div>
    );
  }
  if (kind === "pdf") return <iframe src={url} title={file.name} className="h-[68vh] w-full rounded-lg bg-white" />;
  return <TextPreview url={url} />;
}

function Viewer({ files, openId, onOpenChange }: { files: TaskAttachment[]; openId: string | null; onOpenChange: (id: string | null) => void }) {
  const now = useNow();
  const members = useMembersMap();
  const index = files.findIndex((f) => f.id === openId);
  const file = index >= 0 ? files[index] : null;
  const step = (by: number) => files.length > 1 && onOpenChange(files[(index + by + files.length) % files.length].id);
  const uploader = file?.uploader_id ? members[file.uploader_id] : null;

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onOpenChange(null)}>
      <DialogContent
        className="gap-0 p-0 sm:max-w-[min(960px,calc(100%-2rem))]"
        onKeyDown={(e) => {
          // The arrows belong to a video's own controls when it has the focus.
          if ((e.target as HTMLElement).closest("video, audio, input, textarea")) return;
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
      >
        {file && (
          <>
            <div className="flex items-start gap-3 border-b px-5 py-3.5 pr-12">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-[15px] leading-6 font-semibold text-navy-900">{file.name}</DialogTitle>
                <DialogDescription className="truncate text-xs text-navy-600">
                  {formatBytes(file.size)}
                  {uploader ? ` · ajouté par ${uploader.full_name}` : ""} · {relativeTime(file.created_at, now)}
                  {files.length > 1 ? ` · ${index + 1} sur ${files.length}` : ""}
                </DialogDescription>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {files.length > 1 && (
                  <span className="mr-1 flex items-center">
                    <Button variant="ghost" size="icon-sm" aria-label="Fichier précédent" onClick={() => step(-1)} className="text-navy-600">
                      <ChevronLeft />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Fichier suivant" onClick={() => step(1)} className="text-navy-600">
                      <ChevronRight />
                    </Button>
                  </span>
                )}
                {CAN_DOWNLOAD && (
                  <Button variant="outline" size="sm" onClick={() => void download(file)} aria-label={`Télécharger ${file.name}`}>
                    <Download /> <span className="max-sm:hidden">Télécharger</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Retirer ${file.name}`}
                  className="text-navy-500 hover:text-coral-600"
                  // The next file takes its place; the last one closes the viewer.
                  onClick={() => confirmRemoval(file, () => onOpenChange(files.length > 1 ? files[(index + 1) % files.length].id : null))}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            <div className="px-5 py-5">
              <ViewerBody key={file.id} file={file} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- section -------------------------------- */

/**
 * The files of a task: photos and videos as pictures, the rest by its kind.
 * « Ajouter » opens the file picker; files can also be dropped anywhere on the
 * task panel, or pasted into it (see `useFileIntake`).
 */
export function Attachments({ task }: { task: Task }) {
  const { files, uploads } = useTaskFiles(task.id);
  const input = useRef<HTMLInputElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const count = files.length;

  return (
    <section aria-label="Fichiers">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-navy-400">
          <Paperclip className="size-4" />
        </span>
        <h3 className="text-[13px] font-semibold text-navy-900">Fichiers</h3>
        {count > 0 && <span className="text-xs text-muted-foreground tabular">{count}</span>}
        {(count > 0 || uploads.length > 0) && (
          <Button variant="ghost" size="sm" onClick={() => input.current?.click()} className="-mr-2 ml-auto text-navy-600">
            <Plus /> Ajouter
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        multiple
        aria-label="Joindre des fichiers"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          attachFiles(task.id, [...(e.target.files ?? [])]);
          // The same file can be chosen again right after (a retry, another task).
          e.target.value = "";
        }}
      />

      {count === 0 && uploads.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-navy-900/[0.16] px-3.5 py-3 text-left transition-colors hover:border-navy-900/30 hover:bg-navy-900/[0.025] focus-ring"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy-900/[0.05] text-navy-500">
            <Plus className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-navy-800">Joindre des fichiers</span>
            <span className="block text-xs text-navy-500">
              Photos, vidéos, documents : glissez-les ici ou choisissez-les. {formatBytes(ATTACHMENT_MAX_BYTES)} au plus par fichier.
            </span>
          </span>
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-3.5 min-[420px]:grid-cols-3">
          {files.map((f) => (
            <FileTile key={f.id} file={f} onOpen={() => setOpenId(f.id)} />
          ))}
          {uploads.map((u) => (
            <UploadTile key={u.id} upload={u} />
          ))}
        </ul>
      )}

      <Viewer files={files} openId={openId} onOpenChange={setOpenId} />
    </section>
  );
}

/**
 * Files dropped on the task panel, or pasted into it, are attached to the task.
 * Returns what the panel needs: handlers for its root, and whether a file is
 * being dragged over it (to say « déposez ici »).
 */
export function useFileIntake(taskId: string) {
  const [over, setOver] = useState(false);
  // dragenter / dragleave fire for every child crossed: count them to know when the pointer has really left.
  const depth = useRef(0);
  const carriesFiles = (e: React.DragEvent) => [...e.dataTransfer.types].includes("Files");

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    depth.current += 1;
    setOver(true);
  }, []);
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!carriesFiles(e)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      attachFiles(taskId, [...e.dataTransfer.files]);
    },
    [taskId],
  );
  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      // A screenshot or a copied file. Text pasted into a field is left to the field.
      const files = [...e.clipboardData.files];
      if (files.length === 0) return;
      e.preventDefault();
      attachFiles(taskId, files);
    },
    [taskId],
  );
  return { over, handlers: { onDragEnter, onDragOver, onDragLeave, onDrop, onPaste } };
}

/** What covers the task panel while files are held over it. */
export function DropVeil() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-teal-500 bg-popover/90">
      <p className="flex items-center gap-2 text-sm font-medium text-navy-900">
        <Paperclip className="size-4 text-teal-600" /> Déposez pour joindre à la tâche
      </p>
    </div>
  );
}
