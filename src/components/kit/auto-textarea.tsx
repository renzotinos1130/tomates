"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Borderless textarea that grows with its content (works in every browser). */
export function AutoTextarea({
  className,
  value,
  minRows = 1,
  ref,
  ...props
}: React.ComponentProps<"textarea"> & { minRows?: number }) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={(el) => {
        inner.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      rows={minRows}
      value={value}
      className={cn(
        "block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-navy-400",
        className,
      )}
      {...props}
    />
  );
}
