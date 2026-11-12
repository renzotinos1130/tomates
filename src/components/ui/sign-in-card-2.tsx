"use client";

/**
 * Sign-in card, adapted from the 21st.dev component "sign-in-card-2": a sheet
 * of dark glass that tilts in 3D under the pointer, with light travelling
 * along its four edges, fields with a leading icon and a highlight that glides
 * from one to the next.
 *
 * What changed from the original: it is cut into pieces (card, field, divider,
 * alternative button) so the real sign-in logic can sit inside; the page
 * background is left to the caller; the tilt is eased by a spring, ignores
 * touch and reduced motion; the looping lights are switched off by
 * `prefers-reduced-motion`; the password toggle is a real button.
 */

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useState, type ComponentProps, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const RADIUS = "rounded-[24px]";
/** How far the card leans, in degrees, when the pointer is 300 px from its centre. */
const TILT = 10;
const TILT_SPRING = { stiffness: 170, damping: 20, mass: 0.6 };

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* -------------------------------------------------------------------------- */
/* Lights                                                                      */
/* -------------------------------------------------------------------------- */

const BEAM_TRAVEL = { duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 } as const;
const BEAM_PULSE = { duration: 1.2, repeat: Infinity, repeatType: "mirror" } as const;
const BEAM =
  "absolute from-transparent via-white to-transparent [filter:drop-shadow(0_0_3px_rgb(255_255_255/0.95))_drop-shadow(0_0_12px_rgb(255_255_255/0.75))]";

/**
 * One light per edge, each starting 0.6 s after the previous: together they
 * read as a single glint running clockwise around the card.
 */
const BEAMS = [
  { edge: "top-0 left-0 h-[3px] w-1/2 bg-gradient-to-r", axis: "x", from: "-100%", to: "200%", delay: 0 },
  { edge: "top-0 right-0 h-1/2 w-[3px] bg-gradient-to-b", axis: "y", from: "-100%", to: "200%", delay: 0.6 },
  { edge: "right-0 bottom-0 h-[3px] w-1/2 bg-gradient-to-r", axis: "x", from: "100%", to: "-200%", delay: 1.2 },
  { edge: "bottom-0 left-0 h-1/2 w-[3px] bg-gradient-to-b", axis: "y", from: "100%", to: "-200%", delay: 1.8 },
] as const;

/** A faint spark on each rounded corner (inset so it sits on the curve, not outside it). */
const GLINTS = [
  { corner: "top-[5px] left-[5px] size-[5px] bg-white/50 blur-[1px]", duration: 2, delay: 0 },
  { corner: "top-[4px] right-[4px] size-2 bg-white/70 blur-[2px]", duration: 2.4, delay: 0.5 },
  { corner: "right-[4px] bottom-[4px] size-2 bg-white/70 blur-[2px]", duration: 2.2, delay: 1 },
  { corner: "bottom-[5px] left-[5px] size-[5px] bg-white/50 blur-[1px]", duration: 2.3, delay: 1.5 },
] as const;

/**
 * The lights run on top of the glass, clipped to its rounded outline: white on
 * deep navy reads from across the room, where light slipped under a nearly
 * opaque sheet (as on the original, which is much more see-through) would not.
 */
function EdgeLights() {
  return (
    // Decorative and looping: gone for anyone who asked for less motion.
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden", RADIUS)}>
      {BEAMS.map((beam) => (
        <motion.div
          key={beam.edge}
          className={cn(BEAM, beam.edge)}
          initial={{ [beam.axis]: beam.from, opacity: 0.5 }}
          animate={{ [beam.axis]: [beam.from, beam.to], opacity: [0.5, 1, 0.5] }}
          transition={{
            [beam.axis]: { ...BEAM_TRAVEL, delay: beam.delay },
            opacity: { ...BEAM_PULSE, delay: beam.delay },
          }}
        />
      ))}
      {GLINTS.map((glint) => (
        <motion.div
          key={glint.corner}
          className={cn("absolute rounded-full", glint.corner)}
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: glint.duration, repeat: Infinity, repeatType: "mirror", delay: glint.delay }}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The tilting sheet of glass. Lay it over any scene; everything inside is set
 * in white on deep navy.
 */
export function SignInCard({ children, className }: { children: ReactNode; className?: string }) {
  // Pointer offset from the centre of the card, in px.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const easedX = useSpring(pointerX, TILT_SPRING);
  const easedY = useSpring(pointerY, TILT_SPRING);
  const rotateX = useTransform(easedY, [-300, 300], [TILT, -TILT]);
  const rotateY = useTransform(easedX, [-300, 300], [-TILT, TILT]);

  const lean = (event: PointerEvent<HTMLDivElement>) => {
    // A finger has no hover: a tap must not leave the card askew.
    if (event.pointerType !== "mouse" || prefersReducedMotion()) return;
    const box = event.currentTarget.getBoundingClientRect();
    pointerX.set(event.clientX - box.left - box.width / 2);
    pointerY.set(event.clientY - box.top - box.height / 2);
  };
  const settle = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    // The pointer is read on this frame, which never moves. Read on the card itself, a corner that
    // leans away slips from under the pointer, the card springs back, and the two chase each other.
    <div
      className={cn(
        "group/card relative z-10 w-full max-w-[400px] duration-700 ease-out animate-in fade-in-0 slide-in-from-bottom-5",
        className,
      )}
      style={{ perspective: 1500 }}
      onPointerMove={lean}
      onPointerLeave={settle}
    >
      <motion.div data-slot="sign-in-card" className="relative" style={{ rotateX, rotateY }}>
        {/* A soft halo that comes up with the pointer. */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -inset-px opacity-0 shadow-[0_0_22px_4px_rgb(255_255_255/0.07)] transition-opacity duration-700 group-hover/card:opacity-100",
            RADIUS,
          )}
        />
        <div
          className={cn(
            "relative overflow-hidden border border-white/[0.09] bg-[rgb(7_18_38/0.74)] px-6 pt-8 pb-6 text-white shadow-[0_34px_80px_-34px_rgb(7_18_38/0.9)] backdrop-blur-xl backdrop-saturate-150 sm:px-8",
            RADIUS,
          )}
        >
          {/* A faint weave, as on the original. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                "linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)",
              backgroundSize: "30px 30px",
            }}
          />
          <div className="relative">{children}</div>
        </div>
        <EdgeLights />
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Field                                                                       */
/* -------------------------------------------------------------------------- */

type SignInFieldProps = Omit<ComponentProps<"input">, "className" | "aria-label"> & {
  /** Accessible name of the field (the placeholder is only a hint). */
  label: string;
  icon: LucideIcon;
  /** A control at the right end of the field, e.g. show or hide the password. */
  trailing?: ReactNode;
  className?: string;
};

/** An input with a leading icon. The highlight behind it glides to whichever field has the focus. */
export function SignInField({ label, icon: Icon, trailing, className, onFocus, onBlur, ...props }: SignInFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <motion.div
      className={cn("relative", focused && "z-10", className)}
      animate={{ scale: focused ? 1.015 : 1 }}
      whileHover={{ scale: focused ? 1.015 : 1.008 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div className="relative flex items-center overflow-hidden rounded-lg">
        {focused && (
          <motion.div
            layoutId="sign-in-field-highlight"
            aria-hidden="true"
            className="absolute inset-0 rounded-lg bg-white/[0.07]"
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          />
        )}
        <Icon
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-3 size-4 transition-colors duration-300",
            focused ? "text-white" : "text-white/45",
          )}
        />
        <input
          aria-label={label}
          data-slot="input"
          className={cn(
            "relative h-10 w-full min-w-0 rounded-lg border border-white/[0.09] bg-white/[0.06] pl-10 text-base text-white outline-none transition-colors duration-300 md:text-sm",
            "placeholder:text-white/35 focus-visible:border-white/30 disabled:cursor-not-allowed disabled:opacity-50",
            // The browser's autofill paints its own background: keep the glass.
            "[&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[transition:background-color_9999s_ease-out]",
            trailing ? "pr-10" : "pr-3",
          )}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...props}
        />
        {trailing && <div className="absolute right-1.5 flex items-center">{trailing}</div>}
      </div>
    </motion.div>
  );
}

/** A small icon button for the right end of a field. */
export function SignInFieldAction({ className, type = "button", ...props }: ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-white/50 outline-none transition-colors duration-300 hover:text-white focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/40 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Divider, alternative action, small parts                                    */
/* -------------------------------------------------------------------------- */

export function SignInDivider({ children = "ou", className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center", className)}>
      <div className="grow border-t border-white/10" />
      <span className="mx-3 text-xs text-white/50">{children}</span>
      <div className="grow border-t border-white/10" />
    </div>
  );
}

/** The other way in: quieter than the primary button, same height. */
export function SignInAltButton({ className, children, type = "button", ...props }: ComponentProps<typeof motion.button>) {
  return (
    <motion.button
      type={type}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group/alt relative flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-lg border border-white/[0.12] bg-white/[0.05] text-[13px] font-medium text-white/85 outline-none transition-colors duration-300",
        "hover:border-white/25 hover:text-white focus-visible:border-white/40 focus-visible:ring-2 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {/* A sheen crosses the button on hover. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/[0.09] to-white/0 transition-transform duration-700 ease-in-out group-hover/alt:translate-x-full motion-reduce:hidden"
      />
      <span className="relative flex items-center gap-2">{children as ReactNode}</span>
    </motion.button>
  );
}

/** Title and one line of explanation, centred as on the original. */
export function SignInHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="text-center">
      <h1 className="text-xl font-semibold tracking-tight text-white">{title}</h1>
      {children && <p className="mx-auto mt-1.5 max-w-[19rem] text-[13px] leading-relaxed text-balance text-white/65">{children}</p>}
    </div>
  );
}

/** A plain text link set in the card's quiet white. */
export function SignInTextButton({ className, type = "button", ...props }: ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={cn(
        "rounded-sm text-xs text-white/60 underline-offset-2 outline-none transition-colors duration-200 hover:text-white focus-visible:text-white focus-visible:underline",
        className,
      )}
      {...props}
    />
  );
}

export function SignInError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-coral-400/45 bg-coral-500/[0.24] px-3 py-2 text-[13px] leading-snug text-coral-50">
      {children}
    </p>
  );
}
