"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The mobile menu button: three lines that fold into a cross while the menu
 * is open. Adapted from the Origin UI menu button (21st.dev); the drawing is
 * driven by `aria-expanded`, so the state is also what assistive technology reads.
 */
export function MenuToggle({
  open,
  onToggle,
  className,
  labels = { open: "Ouvrir le menu", close: "Fermer le menu" },
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children" | "onClick"> & {
  open: boolean;
  onToggle: () => void;
  labels?: { open: string; close: string };
}) {
  return (
    <Button
      variant="outline"
      size="icon-lg"
      className={cn("group", className)}
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? labels.close : labels.open}
      {...props}
    >
      <svg
        className="pointer-events-none"
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path
          d="M4 12L20 12"
          className="origin-center -translate-y-[7px] transition-all duration-300 [transition-timing-function:cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-x-0 group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[315deg]"
        />
        <path
          d="M4 12H20"
          className="origin-center transition-all duration-300 [transition-timing-function:cubic-bezier(.5,.85,.25,1.8)] group-aria-expanded:rotate-45"
        />
        <path
          d="M4 12H20"
          className="origin-center translate-y-[7px] transition-all duration-300 [transition-timing-function:cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[135deg]"
        />
      </svg>
    </Button>
  );
}
