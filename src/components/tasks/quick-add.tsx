"use client";

import { CornerDownLeft } from "@/components/kit/icons";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AutoTextarea } from "@/components/kit/auto-textarea";
import { Kbd } from "@/components/kit/pills";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useProjects } from "@/lib/hooks";
import { createTask, ui, useApp, type QuickAddDefaults } from "@/lib/store";
import { DraftControls, type TaskDraft } from "./draft-controls";

function QuickAddForm({ defaults }: { defaults: QuickAddDefaults }) {
  const meId = useApp((s) => s.meId);
  const projects = useProjects();
  const params = useParams<{ slug?: string }>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Starts on the project being looked at, assigned to me.
  const [draft, setDraft] = useState<TaskDraft>(() => ({
    project_id: defaults.project_id ?? projects.find((p) => p.slug === params?.slug)?.id ?? projects[0]?.id ?? "",
    status: defaults.status ?? "todo",
    priority: defaults.priority ?? "normal",
    assignee_id: defaults.assignee_id === undefined ? meId : defaults.assignee_id,
    due_date: defaults.due_date ?? null,
    weekPriority: defaults.weekPriority ?? false,
  }));
  const [keepOpen, setKeepOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    if (!draft.project_id || !title.trim() || saving) return;
    setSaving(true);
    const task = await createTask({ ...draft, title, description });
    setSaving(false);
    if (!task) return;
    toast.success("Tâche créée", {
      description: task.title,
      action: { label: "Ouvrir", onClick: () => ui.openTask(task.id) },
    });
    if (keepOpen) {
      setTitle("");
      setDescription("");
      titleRef.current?.focus();
    } else {
      ui.closeQuickAdd();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="px-5 pt-5 pb-3">
        <AutoTextarea
          ref={titleRef}
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Que faut-il faire ?"
          aria-label="Titre de la tâche"
          maxLength={500}
          className="text-lg font-medium tracking-tight text-navy-900"
        />
        <AutoTextarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Ajouter une description (facultatif)"
          aria-label="Description"
          minRows={2}
          className="mt-2 text-sm text-navy-700"
        />
      </div>
      <DraftControls draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} className="px-5 pb-4" />
      <div className="flex items-center justify-between gap-3 border-t bg-paper-50 px-5 py-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
          <Switch checked={keepOpen} onCheckedChange={setKeepOpen} size="sm" />
          En créer plusieurs
        </label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => ui.closeQuickAdd()}>
            Annuler
          </Button>
          <Button type="submit" variant="tomato" disabled={!title.trim() || saving}>
            Créer la tâche
            <Kbd className="ml-0.5 border-white/20 bg-white/10 text-white">
              <CornerDownLeft className="size-3" />
            </Kbd>
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * Global "Nouvelle tâche" dialog (button, `C` shortcut, command menu).
 * Designed so that title → Enter is enough; every property is one click away.
 */
export function QuickAdd() {
  const { open, defaults } = useApp((s) => s.quickAdd);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && ui.closeQuickAdd()}>
      <DialogContent className="top-[22%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">Nouvelle tâche</DialogTitle>
        <DialogDescription className="sr-only">Créer une tâche et l&apos;assigner</DialogDescription>
        {/* Mounted only while open: every new task starts from fresh defaults. */}
        <QuickAddForm defaults={defaults} />
      </DialogContent>
    </Dialog>
  );
}
