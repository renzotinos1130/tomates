"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { ArrowRight } from "@/components/kit/icons"
import { Slot } from "radix-ui"

/**
 * One button for the whole app.
 *
 * The primary button is an "arrow fill" pill, adapted from Hyperiux Vault's
 * ArrowFillButton (https://vault.hyperiux.com): a tomato pill with a white
 * disc on the right; on hover the disc floods the whole button, the colours
 * flip and the icon is swapped by a fresh one sliding in. The geometry lives
 * in globals.css (`.af-*`), sized in px for an app rather than in vw.
 *
 * - The disc holds an arrow by default. An icon passed as `icon`, or written
 *   first or last in the children (`<Plus /> Nouvelle tâche`), takes its place.
 * - Quiet variants (outline, secondary, ghost…) are plain pills.
 */
const quiet = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-[13px] font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // The two primary names share the arrow-fill look (see FILL below).
        default: "",
        tomato: "",
        outline:
          "border-navy-900/[0.13] bg-white/50 text-navy-900 hover:bg-white/80 aria-expanded:bg-white/80",
        secondary: "bg-navy-900/[0.06] text-navy-900 hover:bg-navy-900/[0.1] aria-expanded:bg-navy-900/[0.1]",
        ghost: "text-navy-800 hover:bg-navy-900/[0.06] hover:text-navy-900 aria-expanded:bg-navy-900/[0.06]",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "rounded-md text-navy-900 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-3.5",
        xs: "h-6 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-3 text-[12.5px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-4",
        xl: "h-10 gap-2 px-5 text-sm",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

type Variant = NonNullable<VariantProps<typeof quiet>["variant"]>
type Size = NonNullable<VariantProps<typeof quiet>["size"]>

const FILL: ReadonlySet<Variant> = new Set(["default", "tomato"])
/** Sizes too small, or icon-only: a plain tomato pill or disc, no flooding disc. */
const FLAT: ReadonlySet<Size> = new Set(["xs", "icon", "icon-xs", "icon-sm", "icon-lg"])

const fillBase =
  "group/button af-btn outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50"

/** Class names for an element that should look like a button (links, calendar days…). */
function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: { variant?: Variant | null; size?: Size | null; className?: string } = {}) {
  const v = variant ?? "default"
  const s = size ?? "default"
  if (FILL.has(v)) return cn(fillBase, `af-${s}`, FLAT.has(s) && "af-flat", className)
  return cn(quiet({ variant: v, size: s }), className)
}

/** An icon written among the children: a component element with no children of its own. */
function isIcon(node: React.ReactNode): node is React.ReactElement {
  return (
    React.isValidElement(node) &&
    typeof node.type !== "string" &&
    (node.props as { children?: React.ReactNode }).children === undefined
  )
}

/** Lifts a leading or trailing icon out of the label: it goes into the disc. */
function splitIcon(children: React.ReactNode): { icon: React.ReactNode; label: React.ReactNode } {
  const list = React.Children.toArray(children)
  if (list.length < 2) return { icon: null, label: children }
  if (isIcon(list[0])) return { icon: list[0], label: list.slice(1) }
  if (isIcon(list[list.length - 1])) return { icon: list[list.length - 1], label: list.slice(0, -1) }
  return { icon: null, label: children }
}

/** How long the flood stays on after a finger lifts: there is no hover on a touch screen. */
const PRESS_MS = 450

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  icon,
  children,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof quiet> & {
    asChild?: boolean
    /** Primary buttons only: what the disc shows instead of the arrow. `null` keeps the arrow. */
    icon?: React.ReactNode
  }) {
  const v = variant ?? "default"
  const s = size ?? "default"
  const fill = FILL.has(v)
  const flat = FLAT.has(s)
  const [pressed, setPressed] = React.useState(false)
  const release = React.useRef<number | null>(null)
  React.useEffect(
    () => () => {
      if (release.current) window.clearTimeout(release.current)
    },
    []
  )

  // With asChild the element comes from the caller (a link): the label is its content.
  const child = asChild && React.isValidElement(children) ? (children as React.ReactElement<{ children?: React.ReactNode }>) : null
  const inner = child ? child.props.children : children

  let content = inner
  if (fill && !flat) {
    const split = icon != null ? { icon, label: inner } : splitIcon(inner)
    const mark = split.icon ?? <ArrowRight />
    content = (
      <>
        <span className="af-label">{split.label}</span>
        <span className="af-fill" aria-hidden="true" />
        <span className="af-label af-over" aria-hidden="true">
          {split.label}
        </span>
        <span className="af-disc" aria-hidden="true">
          <span className="af-glyph af-glyph-in">{mark}</span>
          <span className="af-glyph af-glyph-out">{mark}</span>
        </span>
      </>
    )
  }

  const touch = (e: React.PointerEvent) => fill && e.pointerType !== "mouse"
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={v}
      data-size={s}
      data-pressed={pressed ? "true" : undefined}
      className={buttonVariants({ variant: v, size: s, className })}
      onPointerDown={(e: React.PointerEvent<HTMLButtonElement>) => {
        onPointerDown?.(e)
        if (!touch(e)) return
        if (release.current) window.clearTimeout(release.current)
        setPressed(true)
      }}
      onPointerUp={(e: React.PointerEvent<HTMLButtonElement>) => {
        onPointerUp?.(e)
        if (touch(e)) release.current = window.setTimeout(() => setPressed(false), PRESS_MS)
      }}
      onPointerCancel={(e: React.PointerEvent<HTMLButtonElement>) => {
        onPointerCancel?.(e)
        if (touch(e)) release.current = window.setTimeout(() => setPressed(false), PRESS_MS)
      }}
      {...props}
    >
      {child ? React.cloneElement(child, undefined, content) : content}
    </Comp>
  )
}

export { Button, buttonVariants }
