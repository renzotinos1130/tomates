"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import WorkflowBlueprint, { type WorkflowGraph } from "@/components/ui/interactive-workflow-blueprint";
import { updateWorkflow, useApp } from "@/lib/store";
import type { Workflow, WorkflowDoc } from "@/lib/types";
import { firstName } from "@/lib/utils";
import { AGENT_TEMPLATE, WORKFLOW_APPS } from "@/lib/workflow-apps";
import { renderWorkflowLogo } from "./workflow-icons";

/** Canvas colours: navy ink, tomato lines, teal agents, warm-yellow reviews. */
const THEME = {
  "--color-background": "rgb(255 255 255 / 0.55)",
  "--color-foreground": "var(--color-navy-900)",
  "--color-card": "#ffffff",
  "--color-muted-foreground": "#5d6b87",
  "--color-border": "rgb(13 27 51 / 0.13)",
  "--color-primary": "var(--color-tomato-600)",
  "--color-primary-foreground": "#ffffff",
  "--color-chart-2": "var(--color-teal-500)",
  "--color-chart-3": "var(--color-sun-500)",
} as CSSProperties;

const SAVE_DELAY_MS = 500;
const OWN_WRITES_KEPT = 12;

/**
 * One fixed shape and key order for a document, so two copies of the same
 * drawing always serialise to the same string (Postgres reorders JSON keys).
 */
function canonicalDoc(doc: WorkflowDoc): WorkflowDoc {
  return {
    nodes: doc.nodes.map(({ id, position, data }) => ({
      id,
      position: { x: Math.round(position.x), y: Math.round(position.y) },
      data: {
        label: data.label,
        detail: data.detail,
        kind: data.kind,
        ...(data.tool ? { tool: data.tool } : {}),
        ...(data.logo ? { logo: data.logo } : {}),
      },
    })),
    edges: doc.edges.map(({ id, source, target }) => ({ id, source, target })),
  };
}

const serialize = (doc: WorkflowDoc) => JSON.stringify(canonicalDoc(doc));

/** Keeps only what is worth saving (no selection, no measurements). */
const toDoc = (graph: WorkflowGraph): WorkflowDoc =>
  canonicalDoc({
    nodes: graph.nodes.map(({ id, position, data }) => ({ id, position, data })),
    edges: graph.edges.map(({ id, source, target }) => ({ id, source, target })),
  });

const toGraph = (doc: WorkflowDoc): WorkflowGraph => ({
  nodes: doc.nodes.map((n) => ({ ...n, type: "blueprint" as const })),
  edges: doc.edges.map((e) => ({ ...e, type: "blueprint" })),
});

/**
 * The blueprint editor bound to a saved workflow. Every edit is saved a moment
 * later. When a teammate saves the same canvas, their version is loaded (last
 * write wins); the echo of our own saves — even an older one arriving late —
 * never replaces what is on screen.
 */
export function WorkflowCanvas({ workflow }: { workflow: Workflow }) {
  const workflowId = workflow.id;
  // The document the canvas was last (re)opened with.
  const [opened, setOpened] = useState(() => ({ key: 0, doc: workflow.graph }));
  const [saving, setSaving] = useState(false);
  const local = useRef<string | null>(null); // what the canvas shows, serialised
  const own = useRef<string[]>([]); // recent documents this tab produced or accepted
  const timer = useRef<number | null>(null);
  const queued = useRef<WorkflowDoc | null>(null); // edit waiting for its delayed save

  const remember = useCallback((json: string) => {
    own.current = [...own.current.filter((j) => j !== json), json].slice(-OWN_WRITES_KEPT);
  }, []);

  const flush = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const doc = queued.current;
    queued.current = null;
    if (doc) void updateWorkflow(workflowId, { graph: doc }).finally(() => setSaving(false));
  }, [workflowId]);

  // Watch the stored row: load a teammate's version, ignore our own echoes.
  useEffect(() => {
    const initial = useApp.getState().workflows[workflowId];
    if (initial && local.current === null) {
      local.current = serialize(initial.graph);
      remember(local.current);
    }
    return useApp.subscribe((state, previous) => {
      const next = state.workflows[workflowId];
      if (!next || next === previous.workflows[workflowId]) return;
      const json = serialize(next.graph);
      if (json === local.current || own.current.includes(json)) return;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
      queued.current = null;
      local.current = json;
      remember(json);
      setSaving(false);
      setOpened((o) => ({ key: o.key + 1, doc: next.graph }));
      const editor = next.updated_by && next.updated_by !== state.meId ? state.members[next.updated_by] : undefined;
      toast.info(editor ? `Mis à jour par ${firstName(editor.full_name)}` : "Workflow mis à jour");
    });
  }, [workflowId, remember]);

  // Leaving the page (or the tab) never loses the last edit.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  const onChange = useCallback(
    (graph: WorkflowGraph) => {
      const doc = toDoc(graph);
      const json = JSON.stringify(doc);
      if (json === local.current) return; // selection or measurement only
      local.current = json;
      remember(json);
      queued.current = doc;
      setSaving(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush, remember],
  );

  return (
    <WorkflowBlueprint
      key={opened.key}
      title={workflow.name}
      initialGraph={toGraph(opened.doc)}
      apps={WORKFLOW_APPS}
      agentTemplate={AGENT_TEMPLATE}
      renderLogo={renderWorkflowLogo}
      onChange={onChange}
      statusNote={saving ? "Enregistrement…" : "Enregistré automatiquement"}
      showTitle={false}
      style={THEME}
    />
  );
}
