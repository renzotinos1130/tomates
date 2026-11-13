"use client";

import { Check } from "@/components/kit/icons";
import { cn } from "@/lib/utils";

/** Round checkbox used to complete a task in one click. */
export function TaskCheck({
  done,
  onToggle,
  size = "md",
  className,
}: {
  done: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? "Rouvrir la tâche" : "Marquer comme terminée"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "group/check flex shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-200 focus-ring",
        size === "md" ? "size-[18px]" : "size-4",
        done
          ? "animate-pop border-leaf-500 bg-leaf-500 text-white"
          : "border-navy-300 bg-card text-transparent hover:border-leaf-500 hover:bg-leaf-50 hover:text-leaf-500",
        className,
      )}
    >
      <Check className={size === "md" ? "size-3" : "size-2.5"} strokeWidth={3} />
    </button>
  );
}
