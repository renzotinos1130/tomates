import type { WorkflowDoc } from "@/lib/types";

const W = 196;
const H = 120;

/** Tiny static drawing of a workflow, for list cards: its shape, in one tone. */
export function WorkflowPreview({ doc, className }: { doc: WorkflowDoc; className?: string }) {
  if (doc.nodes.length === 0) {
    return <div className={className} aria-hidden="true" />;
  }
  const xs = doc.nodes.map((n) => n.position.x);
  const ys = doc.nodes.map((n) => n.position.y);
  const pad = 40;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const width = Math.max(...xs) + W + pad - minX;
  const height = Math.max(...ys) + H + pad - minY;
  const at = new Map(doc.nodes.map((n) => [n.id, n]));
  return (
    <svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
    >
      {doc.edges.map((e) => {
        const a = at.get(e.source);
        const b = at.get(e.target);
        if (!a || !b) return null;
        const x1 = a.position.x + W;
        const y1 = a.position.y + H / 2;
        const x2 = b.position.x;
        const y2 = b.position.y + H / 2;
        const mid = (x1 + x2) / 2;
        return (
          <path
            key={e.id}
            d={`M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`}
            fill="none"
            stroke="var(--color-navy-300)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        );
      })}
      {doc.nodes.map((n) => (
        <g key={n.id}>
          <rect x={n.position.x} y={n.position.y} width={W} height={H} rx="22" fill="var(--card)" stroke="var(--color-navy-300)" strokeWidth="4" />
          <rect x={n.position.x + 26} y={n.position.y + 34} width="110" height="12" rx="6" fill="var(--color-navy-300)" />
          <rect x={n.position.x + 26} y={n.position.y + 60} width="70" height="10" rx="5" fill="var(--color-navy-200)" />
        </g>
      ))}
    </svg>
  );
}
