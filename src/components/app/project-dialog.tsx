"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PROJECT_ICON_MAP } from "@/components/kit/project-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COLOR_META, MEMBER_COLORS, PROJECT_ICONS } from "@/lib/constants";
import { createProject, updateProject } from "@/lib/store";
import type { MemberColor, Project, ProjectIcon } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ColorSwatches({ value, onChange }: { value: MemberColor; onChange: (c: MemberColor) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MEMBER_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={COLOR_META[c].label}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          className={cn(
            "size-6 rounded-full transition-transform duration-150 hover:scale-110 focus-ring",
            COLOR_META[c].solid,
            value === c && "ring-2 ring-navy-900 ring-offset-2 ring-offset-card",
          )}
        />
      ))}
    </div>
  );
}

function ProjectForm({ project, onDone }: { project?: Project; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [color, setColor] = useState<MemberColor>(project?.color ?? "sky");
  const [icon, setIcon] = useState<ProjectIcon>(project?.icon ?? "rocket");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    if (project) {
      await updateProject(project.id, { name: name.trim(), description: description.trim(), color, icon });
      onDone();
    } else {
      const created = await createProject({ name, description, color, icon });
      if (created) {
        onDone();
        router.push(`/projets/${created.slug}`);
      }
    }
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{project ? "Modifier le projet" : "Nouveau projet"}</DialogTitle>
        <DialogDescription>
          {project
            ? "Le nom, l'icône et la couleur apparaissent partout dans l'application."
            : "Un espace avec son propre tableau de tâches, regroupé dans la vue d'ensemble."}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="project-name">Nom</Label>
        <Input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex. Infolettre"
          autoFocus
          maxLength={60}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="project-desc">Description</Label>
        <Textarea
          id="project-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="À quoi sert ce projet ?"
          rows={2}
          maxLength={240}
        />
      </div>
      <div className="grid gap-2">
        <Label>Icône</Label>
        <div className="flex flex-wrap gap-1.5">
          {PROJECT_ICONS.map((key) => {
            const Icon = PROJECT_ICON_MAP[key];
            return (
              <button
                key={key}
                type="button"
                aria-label={`Icône ${key}`}
                aria-pressed={icon === key}
                onClick={() => setIcon(key)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg ring-1 ring-inset transition-colors focus-ring",
                  icon === key ? COLOR_META[color].tile : "text-navy-400 ring-transparent hover:bg-accent",
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Couleur</Label>
        <ColorSwatches value={color} onChange={setColor} />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={!name.trim() || saving}>
          {project ? "Enregistrer" : "Créer le projet"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Create a project, or edit one when `project` is provided. */
export function ProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open: the form always starts from the saved values. */}
        <ProjectForm project={project} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
