"use client";

import { ArrowDownUp, Check, Columns3, Eye, ListFilter, Rows3, Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { PriorityIcon } from "@/components/kit/priority-icon";
import { StatusIcon } from "@/components/kit/status-icon";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from "@/lib/constants";
import { useMembers } from "@/lib/hooks";
import type { SortKey } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { activeFilterCount, EMPTY_FILTERS, type BoardFilters } from "./use-board";

export type BoardView = "table" | "kanban";

const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: "manual", label: "Ordre manuel", hint: "Glisser-déposer pour réorganiser" },
  { key: "due", label: "Échéance", hint: "Les plus proches d'abord" },
  { key: "priority", label: "Priorité", hint: "Les plus hautes d'abord" },
];

const toolButton =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-navy-600 transition-colors hover:bg-navy-900/[0.05] hover:text-navy-900 focus-ring data-[state=open]:bg-navy-900/[0.05]";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function ViewSwitch({ view, onChange }: { view: BoardView; onChange: (v: BoardView) => void }) {
  const options: { key: BoardView; label: string; icon: React.ReactNode }[] = [
    { key: "table", label: "Tableau", icon: <Rows3 className="size-3.5" /> },
    { key: "kanban", label: "Kanban", icon: <Columns3 className="size-3.5" /> },
  ];
  return (
    <div role="tablist" aria-label="Mode d'affichage" className="inline-flex shrink-0 rounded-lg bg-navy-900/[0.05] p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          type="button"
          aria-selected={view === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-all duration-200 focus-ring",
            view === o.key ? "bg-card text-navy-900 shadow-card" : "text-navy-500 hover:text-navy-800",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** View switch · who · filters · search · sort — one compact row. */
export function BoardToolbar({
  view,
  onViewChange,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
}: {
  view: BoardView;
  onViewChange: (v: BoardView) => void;
  filters: BoardFilters;
  onFiltersChange: (f: BoardFilters) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
}) {
  const members = useMembers();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<BoardFilters>) => onFiltersChange({ ...filters, ...patch });
  const count = activeFilterCount(filters);
  const filterCount = filters.statuses.length + filters.priorities.length;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ViewSwitch view={view} onChange={onViewChange} />

      <span className="mx-1 h-5 w-px shrink-0 bg-navy-900/10" />

      {/* Who — one click per person */}
      <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Filtrer par responsable">
        {members.map((m) => {
          const on = filters.assignees.includes(m.id);
          const dim = filters.assignees.length > 0 && !on;
          return (
            <Tooltip key={m.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`Filtrer : ${m.full_name}`}
                  onClick={() => set({ assignees: toggle(filters.assignees, m.id) })}
                  className={cn(
                    "rounded-full transition-all duration-200 focus-ring",
                    on && "ring-2 ring-teal-500 ring-offset-2 ring-offset-paper-50",
                    dim && "opacity-40 hover:opacity-80",
                  )}
                >
                  <MemberAvatar member={m} size="md" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{m.full_name}</TooltipContent>
            </Tooltip>
          );
        })}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-pressed={filters.assignees.includes("none")}
              aria-label="Filtrer : non assignées"
              onClick={() => set({ assignees: toggle(filters.assignees, "none") })}
              className={cn(
                "rounded-full transition-all duration-200 focus-ring",
                filters.assignees.includes("none") && "ring-2 ring-teal-500 ring-offset-2 ring-offset-paper-50",
                filters.assignees.length > 0 && !filters.assignees.includes("none") && "opacity-40 hover:opacity-80",
              )}
            >
              <MemberAvatar member={null} size="md" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Non assignées</TooltipContent>
        </Tooltip>
      </div>

      <span className="mx-1 h-5 w-px shrink-0 bg-navy-900/10" />

      {/* Status & priority */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn(toolButton, filterCount > 0 && "bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-800")}>
            <ListFilter className="size-3.5" />
            Filtrer
            {filterCount > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-teal-600 text-[11px] font-semibold text-white">
                {filterCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Statut</DropdownMenuLabel>
          {STATUSES.map((s) => (
            <DropdownMenuCheckboxItem
              key={s}
              checked={filters.statuses.includes(s)}
              onCheckedChange={() => set({ statuses: toggle(filters.statuses, s) })}
              onSelect={(e) => e.preventDefault()}
              className="gap-2"
            >
              <StatusIcon status={s} /> {STATUS_META[s].label}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Priorité</DropdownMenuLabel>
          {PRIORITIES.map((p) => (
            <DropdownMenuCheckboxItem
              key={p}
              checked={filters.priorities.includes(p)}
              onCheckedChange={() => set({ priorities: toggle(filters.priorities, p) })}
              onSelect={(e) => e.preventDefault()}
              className="gap-2"
            >
              <PriorityIcon priority={p} /> {PRIORITY_META[p].label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search */}
      {searchOpen || filters.query ? (
        <div className="flex h-8 w-44 shrink-0 items-center gap-1.5 rounded-lg border border-navy-900/10 bg-card px-2 focus-within:border-teal-500/60 focus-within:ring-3 focus-within:ring-teal-500/15">
          <Search className="size-3.5 text-navy-400" />
          <input
            ref={searchRef}
            autoFocus
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            onBlur={() => !filters.query && setSearchOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                set({ query: "" });
                setSearchOpen(false);
              }
            }}
            placeholder="Rechercher…"
            aria-label="Rechercher dans le projet"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-navy-400"
          />
          {filters.query && (
            <button type="button" aria-label="Effacer" onClick={() => set({ query: "" })} className="text-navy-300 hover:text-navy-600">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      ) : (
        <button type="button" aria-label="Rechercher" onClick={() => setSearchOpen(true)} className={cn(toolButton, "px-2")}>
          <Search className="size-3.5" />
        </button>
      )}

      {count > 0 && (
        <button
          type="button"
          onClick={() => onFiltersChange({ ...EMPTY_FILTERS, showArchived: filters.showArchived })}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] text-muted-foreground transition-colors hover:text-navy-900 focus-ring"
        >
          <X className="size-3.5" /> Réinitialiser
        </button>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={toolButton}>
              <ArrowDownUp className="size-3.5" />
              <span className="hidden sm:inline">{SORTS.find((s) => s.key === sort)?.label}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Trier par</DropdownMenuLabel>
            {SORTS.map((s) => (
              <DropdownMenuItem key={s.key} onSelect={() => onSortChange(s.key)} className="items-start gap-2">
                <span className="flex-1">
                  <span className="block">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">{s.hint}</span>
                </span>
                <Check className={cn("mt-0.5 size-3.5 text-teal-600", sort === s.key ? "opacity-100" : "opacity-0")} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-pressed={filters.showArchived}
              onClick={() => set({ showArchived: !filters.showArchived })}
              className={cn(toolButton, filters.showArchived && "bg-navy-900/[0.06] text-navy-900")}
            >
              <Eye className="size-3.5" />
              <span className="hidden md:inline">Archivées</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{filters.showArchived ? "Masquer les tâches archivées" : "Afficher les tâches archivées"}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
