"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { frCA } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from "@/lib/constants";
import { dueShortcuts, parseDateOnly, toDateOnly } from "@/lib/dates";
import { useMe, useMembers, useNow, useProjects } from "@/lib/hooks";
import type { DateOnly, ID, TaskPriority, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "./member-avatar";
import { PriorityIcon } from "./priority-icon";
import { ProjectIcon } from "./project-icon";
import { StatusIcon } from "./status-icon";

/** Clicks inside a portalled menu still bubble through React: keep rows from opening. */
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function ItemCheck({ show }: { show: boolean }) {
  return <Check className={cn("ml-auto size-3.5 text-teal-600", show ? "opacity-100" : "opacity-0")} />;
}

interface PickerProps<T> {
  value: T;
  onChange: (value: T) => void;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function StatusPicker({ value, onChange, children, align = "start", ...rest }: PickerProps<TaskStatus>) {
  return (
    <DropdownMenu {...rest}>
      <DropdownMenuTrigger asChild onClick={stop}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48" onClick={stop}>
        <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Statut</DropdownMenuLabel>
        {STATUSES.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => onChange(s)} className="gap-2">
            <StatusIcon status={s} />
            {STATUS_META[s].label}
            <ItemCheck show={s === value} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PriorityPicker({ value, onChange, children, align = "start", ...rest }: PickerProps<TaskPriority>) {
  return (
    <DropdownMenu {...rest}>
      <DropdownMenuTrigger asChild onClick={stop}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-44" onClick={stop}>
        <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Priorité</DropdownMenuLabel>
        {PRIORITIES.map((p) => (
          <DropdownMenuItem key={p} onSelect={() => onChange(p)} className="gap-2">
            <PriorityIcon priority={p} />
            {PRIORITY_META[p].label}
            <ItemCheck show={p === value} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AssigneePicker({ value, onChange, children, align = "start", ...rest }: PickerProps<ID | null>) {
  const members = useMembers();
  const me = useMe();
  // Me first: the most common choice when you take a task.
  const ordered = me ? [me, ...members.filter((m) => m.id !== me.id)] : members;
  return (
    <DropdownMenu {...rest}>
      <DropdownMenuTrigger asChild onClick={stop}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56" onClick={stop}>
        <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Responsable</DropdownMenuLabel>
        {ordered.map((m) => (
          <DropdownMenuItem key={m.id} onSelect={() => onChange(m.id)} className="gap-2">
            <MemberAvatar member={m} size="xs" />
            <span className="truncate">{m.full_name}</span>
            {m.id === me?.id && <span className="text-xs text-muted-foreground">moi</span>}
            <ItemCheck show={m.id === value} />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onChange(null)} className="gap-2">
          <MemberAvatar member={null} size="xs" />
          Non assignée
          <ItemCheck show={value === null} />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProjectPicker({ value, onChange, children, align = "start", ...rest }: PickerProps<ID>) {
  const projects = useProjects();
  return (
    <DropdownMenu {...rest}>
      <DropdownMenuTrigger asChild onClick={stop}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-52" onClick={stop}>
        <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Projet</DropdownMenuLabel>
        {projects.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => onChange(p.id)} className="gap-2">
            <ProjectIcon project={p} size="xs" />
            <span className="truncate">{p.name}</span>
            <ItemCheck show={p.id === value} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DuePicker({ value, onChange, children, align = "start", open, onOpenChange }: PickerProps<DateOnly | null>) {
  const now = useNow();
  const [inner, setInner] = useState(false);
  const isOpen = open ?? inner;
  const setOpen = (o: boolean) => {
    setInner(o);
    onOpenChange?.(o);
  };
  const pick = (d: DateOnly | null) => {
    onChange(d);
    setOpen(false);
  };
  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={stop}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto gap-0 p-0"
        onClick={stop}
        // A menu that just closed restores focus to its trigger a moment later:
        // that must not dismiss a picker opened right after it.
        onFocusOutside={(e) => e.preventDefault()}
      >
        <div className="flex flex-col sm:flex-row">
          <div className="flex min-w-44 flex-col gap-0.5 border-b p-1.5 sm:border-r sm:border-b-0">
            <span className="px-2 pt-1 pb-1 text-[11px] font-medium text-muted-foreground">Échéance</span>
            {dueShortcuts(now).map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => pick(s.date)}
                className={cn(
                  "flex items-center justify-between gap-4 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  value === s.date && "bg-accent font-medium",
                )}
              >
                {s.label}
                <span className="text-xs text-muted-foreground">{s.hint}</span>
              </button>
            ))}
            {value && (
              <button
                type="button"
                onClick={() => pick(null)}
                className="mt-auto flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" />
                Retirer l&apos;échéance
              </button>
            )}
          </div>
          <Calendar
            mode="single"
            locale={frCA}
            selected={value ? parseDateOnly(value) : undefined}
            defaultMonth={value ? parseDateOnly(value) : now}
            onSelect={(d) => d && pick(toDateOnly(d))}
            className="bg-transparent"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
