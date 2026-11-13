"use client";

/**
 * A tooltip with a spring: it pops above its trigger and leans with the pointer.
 *
 * Adapted from Aceternity UI's "Animated Tooltip" (21st.dev). Two differences:
 * it wraps any trigger (here, member avatars drawn from initials) instead of
 * rendering a row of photos, and Radix positions it in a portal, so a table
 * or a scrolling pane never clips it and assistive technology still gets a
 * real tooltip.
 */

import * as React from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const SPRING = { stiffness: 100, damping: 5 };

export function AnimatedTooltip({
  label,
  detail,
  children,
  className,
}: {
  /** First line, in bold: a name. */
  label: string;
  /** Second line, quieter: a role. */
  detail?: string;
  /** The trigger: a single element that accepts a ref and mouse handlers. */
  children: React.ReactElement;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useSpring(useTransform(x, [-100, 100], [-45, 45]), SPRING);
  const translateX = useSpring(useTransform(x, [-100, 100], [-50, 50]), SPRING);

  const follow = (event: React.MouseEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    // From -1 to 1 across the trigger, brought to the travel the original gets from a 56px photo.
    x.set(((event.clientX - box.left) / box.width - 0.5) * 2 * 28);
  };

  return (
    <TooltipPrimitive.Root open={open} onOpenChange={setOpen} delayDuration={60} disableHoverableContent>
      <TooltipPrimitive.Trigger asChild onMouseMove={reduced ? undefined : follow}>
        {children}
      </TooltipPrimitive.Trigger>
      <AnimatePresence>
        {open && (
          <TooltipPrimitive.Portal forceMount>
            <TooltipPrimitive.Content forceMount side="top" sideOffset={10} collisionPadding={8} asChild>
              <motion.div
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.6 }}
                animate={
                  reduced
                    ? { opacity: 1 }
                    : { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 10 } }
                }
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.6 }}
                style={reduced ? undefined : { translateX, rotate }}
                className={cn(
                  "relative z-50 flex flex-col items-center justify-center rounded-md bg-navy-900 px-3.5 py-2 whitespace-nowrap shadow-xl",
                  className,
                )}
              >
                {/* Two glints on the lower edge, in the brand's colours. */}
                <span className="absolute inset-x-8 -bottom-px z-30 h-px w-[20%] bg-gradient-to-r from-transparent via-tomato-400 to-transparent" />
                <span className="absolute -bottom-px left-8 z-30 h-px w-[40%] bg-gradient-to-r from-transparent via-teal-300 to-transparent" />
                <span className="relative z-30 text-[13px] leading-tight font-semibold text-on-ink">{label}</span>
                {detail && <span className="relative z-30 mt-0.5 text-[11px] leading-tight text-navy-300">{detail}</span>}
              </motion.div>
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        )}
      </AnimatePresence>
    </TooltipPrimitive.Root>
  );
}
