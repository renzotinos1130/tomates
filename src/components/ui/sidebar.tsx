"use client";

/**
 * Sidebar: compound navigation with a collapsible rail, an active pill that
 * glides between items, fading labels and nested groups.
 *
 * Adapted from the Wensity "sidebar" primitive (21st.dev). What changed for
 * this codebase: the app's own icons (kit/icons) instead of Tabler, Radix Slot instead of Base
 * UI for `asChild`, internal links rendered with next/link, a `bare` surface
 * (the caller draws the glass), an `action` slot on sections, a tooltip on
 * each item when the rail is collapsed, and no injected stylesheet. Opening
 * under the pointer is the caller's business: it drives `collapsed`.
 *
 * Colours come from `--primitive-*` variables, with fallbacks derived from
 * the theme (`--foreground`, `--background`, `--border`, `--muted-foreground`).
 */

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "@/components/kit/icons";
import { Slot } from "radix-ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────── */

export type SidebarVariant = "default" | "collapsible" | "icon-rail" | "floating" | "resizable";

export interface SidebarProps extends Omit<React.HTMLAttributes<HTMLElement>, "onChange"> {
  variant?: SidebarVariant;
  /** Controlled collapsed state (collapsible variant). */
  collapsed?: boolean;
  /** Initial collapsed state (uncontrolled). Default false. */
  defaultCollapsed?: boolean;
  /** Called when collapsed state changes. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Width in px when expanded, or any CSS length. Default 260. */
  width?: number | string;
  /** Width in px when collapsed (icon-rail / collapsed collapsible). Default 60. */
  collapsedWidth?: number;
  /** Minimum width for resizable variant. Default 180. */
  minWidth?: number;
  /** Maximum width for resizable variant. Default 400. */
  maxWidth?: number;
  /** No background, border or shadow: the caller draws the surface (glass). */
  bare?: boolean;
  /** Accessible label for the navigation landmark. */
  "aria-label"?: string;
  children: React.ReactNode;
}

export type SidebarHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export type SidebarNavProps = React.HTMLAttributes<HTMLDivElement>;

export interface SidebarSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Section heading. Fades out when the sidebar is collapsed. */
  label?: string;
  /** A small control on the right of the heading (hidden when collapsed). */
  action?: React.ReactNode;
}

export interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon shown in both expanded and collapsed states. */
  icon?: React.ReactNode;
  /** Marks the item as the current route. */
  active?: boolean;
  /** Renders as a link when provided (next/link for paths inside the app). */
  href?: string;
  /** Opens in a new tab. */
  external?: boolean;
  /** Badge / count shown after the label. */
  badge?: React.ReactNode;
  /** Text of the tooltip shown when collapsed, when the label is not a plain string. */
  tooltip?: string;
  asChild?: boolean;
}

export interface SidebarNestedProps {
  /** Icon for the nested group trigger. */
  icon?: React.ReactNode;
  /** Label for the nested group. */
  label: string;
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state. Default false. */
  defaultOpen?: boolean;
  /** Called when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Marks the group as containing the active item. */
  active?: boolean;
  children: React.ReactNode;
}

export type SidebarFooterProps = React.HTMLAttributes<HTMLDivElement>;

export interface SidebarToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children?: React.ReactNode | ((state: { collapsed: boolean }) => React.ReactNode);
  /** Standalone: pass collapsed state when used outside a collapsible <Sidebar>. */
  collapsed?: boolean;
  /** Standalone: called when toggled. */
  onToggle?: () => void;
  /** Accessible names for the two states. */
  labels?: { collapse: string; expand: string };
}

/* ─── Motion constants ──────────────────────────────────────── */

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

/* ─── Context ───────────────────────────────────────────────── */

type SidebarContextValue = {
  variant: SidebarVariant;
  collapsed: boolean;
  toggleCollapsed: () => void;
  navId: string;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebarContext() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("Sidebar compound components must be used within <Sidebar>");
  return ctx;
}

/**
 * Reads the current sidebar state. Use this to make custom header/footer
 * content (a logo, a workspace switcher) react to the real collapsed state
 * instead of threading a manually-tracked prop through the tree.
 */
export function useSidebar(): {
  variant: SidebarVariant;
  collapsed: boolean;
  toggleCollapsed: () => void;
} {
  const { variant, collapsed, toggleCollapsed } = useSidebarContext();
  return { variant, collapsed, toggleCollapsed };
}

/* ─── Resizable width hook ──────────────────────────────────── */

function useResizableWidth(initial: number, min: number, max: number) {
  const [width, setWidth] = React.useState(initial);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragState = React.useRef<{ startX: number; startWidth: number } | null>(null);

  const clamp = React.useCallback((value: number) => Math.min(max, Math.max(min, value)), [min, max]);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = { startX: e.clientX, startWidth: width };
      setIsDragging(true);
    },
    [width],
  );

  React.useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!dragState.current) return;
      const delta = e.clientX - dragState.current.startX;
      setWidth(clamp(dragState.current.startWidth + delta));
    };

    const onPointerUp = () => {
      dragState.current = null;
      setIsDragging(false);
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [isDragging, clamp]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 48 : 16;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setWidth((w) => clamp(w - step));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setWidth((w) => clamp(w + step));
      } else if (e.key === "Home") {
        e.preventDefault();
        setWidth(min);
      } else if (e.key === "End") {
        e.preventDefault();
        setWidth(max);
      }
    },
    [clamp, min, max],
  );

  const reset = React.useCallback(() => setWidth(initial), [initial]);

  return { width, isDragging, onPointerDown, onKeyDown, reset };
}

/* ─── Shared item styling ───────────────────────────────────── */

const itemBaseClasses = cn(
  "group/sidebar-item relative flex w-full items-center gap-2.5 rounded-[var(--primitive-radius-item,0.625rem)] px-3 py-[7px]",
  "text-[13.5px] font-medium leading-none outline-none select-none whitespace-nowrap",
  "transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
  "focus-visible:ring-2 focus-visible:ring-[color:var(--primitive-ring,color-mix(in_srgb,var(--foreground)_45%,transparent))]",
  "disabled:pointer-events-none disabled:opacity-40",
);

const itemInactiveClasses = cn(
  "text-[color:var(--primitive-text-secondary,color-mix(in_srgb,var(--foreground)_72%,transparent))]",
  "hover:text-[var(--foreground)]",
  "hover:bg-[color:var(--primitive-surface-hover,color-mix(in_srgb,var(--foreground)_4%,transparent))]",
);

const itemActiveClasses = "text-[var(--foreground)]";

const activePillClasses = cn(
  "pointer-events-none absolute inset-0 rounded-[var(--primitive-radius-item,0.625rem)]",
  "bg-[color:var(--primitive-surface-selected,color-mix(in_srgb,var(--foreground)_6%,transparent))]",
  "[box-shadow:var(--primitive-shadow-selected,none)]",
);

/* ─── <Sidebar> ─────────────────────────────────────────────── */

export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  (
    {
      variant = "default",
      collapsed: controlledCollapsed,
      defaultCollapsed = false,
      onCollapsedChange,
      width: widthProp = 260,
      collapsedWidth = 60,
      minWidth = 180,
      maxWidth = 400,
      bare = false,
      className,
      children,
      "aria-label": ariaLabel = "Sidebar",
      style,
      ...props
    },
    ref,
  ) => {
    const reactId = React.useId();
    const prefersReducedMotion = useReducedMotion();
    const isCollapsible = variant === "collapsible";
    const isIconRail = variant === "icon-rail";
    const isResizable = variant === "resizable";

    const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed);
    const isControlled = controlledCollapsed !== undefined;
    const collapsed = isIconRail ? true : isCollapsible ? (isControlled ? controlledCollapsed : internalCollapsed) : false;

    const toggleCollapsed = React.useCallback(() => {
      if (!isCollapsible) return;
      const next = !collapsed;
      if (!isControlled) setInternalCollapsed(next);
      onCollapsedChange?.(next);
    }, [isCollapsible, collapsed, isControlled, onCollapsedChange]);

    const resize = useResizableWidth(typeof widthProp === "number" ? widthProp : 260, minWidth, maxWidth);

    const effectiveWidth = collapsed ? collapsedWidth : isResizable ? resize.width : widthProp;

    const ctx = React.useMemo<SidebarContextValue>(
      () => ({
        variant,
        collapsed,
        toggleCollapsed,
        navId: `sidebar-${reactId}`,
      }),
      [variant, collapsed, toggleCollapsed, reactId],
    );

    return (
      <SidebarContext.Provider value={ctx}>
        <nav
          ref={ref}
          aria-label={ariaLabel}
          data-slot="sidebar"
          data-variant={variant}
          data-collapsed={collapsed ? "true" : "false"}
          data-dragging={resize.isDragging ? "true" : undefined}
          style={{
            ...style,
            width: effectiveWidth,
            flexShrink: 0,
            // Width is a layout change by nature (adjacent content must
            // reflow), so it animates via an interruptible CSS transition
            // rather than per-frame JS. Disabled while dragging.
            transition:
              resize.isDragging || prefersReducedMotion ? "none" : "width 240ms cubic-bezier(0.23,1,0.32,1)",
          }}
          className={cn(
            "relative isolate flex h-full flex-col overflow-hidden text-[var(--foreground)]",
            !bare && "bg-[var(--background)]",
            !bare &&
              (variant === "floating"
                ? cn(
                    "m-3 h-[calc(100%-1.5rem)] rounded-[var(--primitive-radius-surface,1rem)]",
                    "border border-[var(--border)]",
                    "bg-[color:var(--primitive-surface-elevated,var(--card))]",
                    "[box-shadow:var(--primitive-shadow-raised,0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.12))]",
                  )
                : "border-r border-[var(--border)]"),
            resize.isDragging && "select-none",
            className,
          )}
          {...props}
        >
          {/* Each item's tooltip waits its own delay: none opens at once because another just did,
              so a sidebar that opens under the pointer never flashes the name of the item it lands on. */}
          <TooltipProvider delayDuration={350} skipDelayDuration={0}>
            {children}
          </TooltipProvider>
          {isResizable && (
            <div
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-label="Redimensionner la barre latérale"
              aria-valuemin={minWidth}
              aria-valuemax={maxWidth}
              aria-valuenow={Math.round(resize.width)}
              data-slot="sidebar-resize-handle"
              onPointerDown={resize.onPointerDown}
              onKeyDown={resize.onKeyDown}
              onDoubleClick={resize.reset}
              className={cn(
                "absolute inset-y-0 right-0 z-20 w-1.5 cursor-col-resize outline-none",
                "after:absolute after:inset-y-0 after:right-0 after:w-[2px]",
                "after:bg-transparent after:transition-colors after:duration-150",
                "hover:after:bg-[color-mix(in_srgb,var(--foreground)_18%,transparent)]",
                "focus-visible:after:bg-[color-mix(in_srgb,var(--foreground)_25%,transparent)]",
                resize.isDragging && "after:bg-[color-mix(in_srgb,var(--foreground)_30%,transparent)]",
              )}
            />
          )}
        </nav>
      </SidebarContext.Provider>
    );
  },
);
Sidebar.displayName = "Sidebar";

/* ─── Fading label (shared by item / nested / section) ──────── */

function FadingLabel({ show, className, children }: { show: boolean; className?: string; children: React.ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.12,
            ease: EASE_OUT,
          }}
          className={className}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/* ─── <SidebarHeader> ───────────────────────────────────────── */

export const SidebarHeader = React.forwardRef<HTMLDivElement, SidebarHeaderProps & { expandLabel?: string }>(
  ({ className, children, onClick, expandLabel = "Déplier la barre latérale", ...props }, ref) => {
    const { collapsed, variant, toggleCollapsed } = useSidebarContext();
    const isCollapsible = variant === "collapsible";

    // Collapsed: drop the separate toggle control (it has no room to render
    // cleanly at rail width) and let the logo itself expand the sidebar.
    const visibleChildren = collapsed
      ? React.Children.toArray(children).filter((child) => !(React.isValidElement(child) && child.type === SidebarToggle))
      : children;

    return (
      <div
        ref={ref}
        data-slot="sidebar-header"
        data-collapsed={collapsed ? "true" : "false"}
        role={collapsed && isCollapsible ? "button" : undefined}
        tabIndex={collapsed && isCollapsible ? 0 : undefined}
        aria-label={collapsed && isCollapsible ? expandLabel : undefined}
        title={collapsed && isCollapsible ? expandLabel : undefined}
        onClick={(e) => {
          onClick?.(e);
          if (collapsed && isCollapsible) toggleCollapsed();
        }}
        onKeyDown={(e) => {
          if (collapsed && isCollapsible && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            toggleCollapsed();
          }
        }}
        className={cn(
          "flex shrink-0 items-center",
          collapsed
            ? cn(
                "mx-2 mt-2 flex-col justify-center gap-2 px-0 py-2",
                isCollapsible &&
                  cn(
                    "cursor-pointer select-none outline-none rounded-[var(--primitive-radius-item,0.625rem)]",
                    "[transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1),transform_120ms_cubic-bezier(0.23,1,0.32,1)]",
                    "hover:bg-[color:var(--primitive-surface-hover,color-mix(in_srgb,var(--foreground)_5%,transparent))]",
                    "focus-visible:ring-2 focus-visible:ring-[color:var(--primitive-ring,color-mix(in_srgb,var(--foreground)_45%,transparent))]",
                    "active:[transform:scale(0.97)]",
                    "motion-reduce:active:[transform:none]",
                  ),
              )
            : "h-[52px] gap-2.5 px-[18px]",
          className,
        )}
        {...props}
      >
        {visibleChildren}
      </div>
    );
  },
);
SidebarHeader.displayName = "SidebarHeader";

/* ─── <SidebarNav> ──────────────────────────────────────────── */

export const SidebarNav = React.forwardRef<HTMLDivElement, SidebarNavProps>(({ className, children, ...props }, ref) => {
  const { navId } = useSidebarContext();
  return (
    <div
      ref={ref}
      id={navId}
      data-slot="sidebar-nav"
      className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain py-2", className)}
      {...props}
    >
      {children}
    </div>
  );
});
SidebarNav.displayName = "SidebarNav";

/* ─── <SidebarSection> ──────────────────────────────────────── */

export const SidebarSection = React.forwardRef<HTMLDivElement, SidebarSectionProps>(
  ({ className, label, action, children, ...props }, ref) => {
    const { collapsed } = useSidebarContext();
    return (
      <div
        ref={ref}
        data-slot="sidebar-section"
        role="group"
        aria-label={label}
        className={cn("py-1", className)}
        {...props}
      >
        {label && (
          <div className="flex h-[26px] items-end justify-between px-[18px] pb-1.5">
            <FadingLabel
              show={!collapsed}
              className={cn(
                "text-[10.5px] font-medium uppercase leading-none tracking-[0.08em]",
                "text-[var(--muted-foreground)] whitespace-nowrap",
              )}
            >
              {label}
            </FadingLabel>
            {action && (
              <FadingLabel show={!collapsed} className="-mb-1 flex items-center">
                {action}
              </FadingLabel>
            )}
          </div>
        )}
        <div className="flex flex-col gap-px px-2">{children}</div>
      </div>
    );
  },
);
SidebarSection.displayName = "SidebarSection";

/* ─── Active pill (glides between items) ────────────────────── */

function ActivePill({ navId }: { navId: string }) {
  const prefersReducedMotion = useReducedMotion();
  if (prefersReducedMotion) {
    return <span aria-hidden="true" className={activePillClasses} />;
  }
  return (
    <motion.span
      aria-hidden="true"
      layoutId={`${navId}-active-pill`}
      transition={{ type: "spring", stiffness: 520, damping: 42 }}
      className={activePillClasses}
    />
  );
}

/* ─── <SidebarItem> ─────────────────────────────────────────── */

export const SidebarItem = React.forwardRef<HTMLButtonElement, SidebarItemProps>(
  (
    { className, icon, active = false, href, external = false, badge, tooltip, asChild = false, children, disabled, ...props },
    ref,
  ) => {
    const { collapsed, navId } = useSidebarContext();
    const [hintOpen, setHintOpen] = React.useState(false);
    // A tooltip belongs to one stay of the pointer on one state of the sidebar: when the sidebar
    // opens or folds, whatever was asked before is forgotten (it would pop up later, pointer gone).
    const [hintFor, setHintFor] = React.useState(collapsed);
    if (hintFor !== collapsed) {
      setHintFor(collapsed);
      setHintOpen(false);
    }
    const composedClassName = cn(itemBaseClasses, active ? itemActiveClasses : itemInactiveClasses, className);
    const hint = tooltip ?? (typeof children === "string" ? children : undefined);

    if (asChild && React.isValidElement(children)) {
      return (
        <Slot.Root
          ref={ref as React.Ref<HTMLElement>}
          data-slot="sidebar-item"
          data-active={active ? "true" : undefined}
          aria-current={active ? "page" : undefined}
          className={composedClassName}
          {...(props as React.HTMLAttributes<HTMLElement>)}
        >
          {children}
        </Slot.Root>
      );
    }

    const content = (
      <>
        {active ? <ActivePill navId={navId} /> : null}
        {icon ? (
          <span
            data-slot="sidebar-item-icon"
            className={cn(
              "relative z-10 flex size-5 shrink-0 items-center justify-center",
              active
                ? "text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] transition-colors duration-150 group-hover/sidebar-item:text-[var(--foreground)]",
            )}
          >
            {icon}
          </span>
        ) : null}
        <FadingLabel show={!collapsed} className="relative z-10 min-w-0 flex-1 truncate py-px text-left">
          {children}
        </FadingLabel>
        {badge ? (
          <FadingLabel show={!collapsed} className="relative z-10 flex shrink-0 items-center">
            {badge}
          </FadingLabel>
        ) : null}
      </>
    );

    const shared = {
      "data-slot": "sidebar-item",
      "data-active": active ? "true" : undefined,
      "aria-current": active ? ("page" as const) : undefined,
      // The label is hidden on the rail: keep the name for assistive technology.
      "aria-label": collapsed ? hint : undefined,
      className: composedClassName,
    };

    let element: React.ReactElement;
    if (href && !external && href.startsWith("/")) {
      element = (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          {...shared}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {content}
        </Link>
      );
    } else if (href) {
      element = (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          {...shared}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {content}
        </a>
      );
    } else {
      element = (
        <button ref={ref} type="button" disabled={disabled} {...shared} {...props}>
          {content}
        </button>
      );
    }

    if (!hint) return element;
    // Always wrapped, only ever open on the rail: the item keeps the same
    // element when the sidebar opens or folds (under a pointer, mid-click).
    // A hover that started on the open sidebar asks for nothing once it folds.
    return (
      <Tooltip open={collapsed && hintOpen} onOpenChange={(next) => setHintOpen(next && collapsed)}>
        <TooltipTrigger asChild>{element}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {hint}
        </TooltipContent>
      </Tooltip>
    );
  },
);
SidebarItem.displayName = "SidebarItem";

/* ─── <SidebarNested> ───────────────────────────────────────── */

export const SidebarNested = React.forwardRef<HTMLDivElement, SidebarNestedProps>(
  ({ icon, label, open: controlledOpen, defaultOpen = false, onOpenChange, active = false, children }, ref) => {
    const { collapsed } = useSidebarContext();
    const prefersReducedMotion = useReducedMotion();
    const reactId = React.useId();

    const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;

    const toggle = React.useCallback(() => {
      const next = !open;
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    }, [open, isControlled, onOpenChange]);

    const contentId = `sidebar-nested-content-${reactId}`;

    return (
      <div ref={ref} data-slot="sidebar-nested" className="flex flex-col">
        <button
          type="button"
          data-slot="sidebar-nested-trigger"
          data-open={open ? "true" : "false"}
          data-active={active ? "true" : undefined}
          aria-expanded={open}
          aria-controls={contentId}
          onClick={toggle}
          title={collapsed ? label : undefined}
          className={cn(itemBaseClasses, active && collapsed ? itemActiveClasses : itemInactiveClasses)}
        >
          {active && collapsed && <span aria-hidden="true" className={activePillClasses} />}
          {icon && (
            <span
              data-slot="sidebar-nested-icon"
              className={cn(
                "relative z-10 flex size-5 shrink-0 items-center justify-center",
                "text-[var(--muted-foreground)] group-hover/sidebar-item:text-[var(--foreground)] transition-colors duration-150",
              )}
            >
              {icon}
            </span>
          )}
          <FadingLabel show={!collapsed} className="relative z-10 min-w-0 flex-1 truncate text-left">
            {label}
          </FadingLabel>
          <FadingLabel show={!collapsed} className="relative z-10 flex shrink-0 items-center">
            <motion.span
              aria-hidden="true"
              animate={{ rotate: open ? 90 : 0 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.2,
                ease: EASE_OUT,
              }}
              className="flex items-center justify-center text-[var(--muted-foreground)]"
            >
              <ChevronRight className="size-3.5" strokeWidth={2} />
            </motion.span>
          </FadingLabel>
        </button>
        <AnimatePresence initial={false}>
          {open && !collapsed && (
            <motion.div
              id={contentId}
              data-slot="sidebar-nested-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: {
                  duration: prefersReducedMotion ? 0 : 0.24,
                  ease: EASE_OUT,
                },
                opacity: {
                  duration: prefersReducedMotion ? 0 : 0.16,
                  ease: EASE_OUT,
                },
              }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  "relative ml-[21px] flex flex-col gap-px py-0.5 pl-2.5",
                  "before:absolute before:inset-y-1 before:left-0 before:w-px",
                  "before:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]",
                )}
              >
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
SidebarNested.displayName = "SidebarNested";

/* ─── <SidebarFooter> ───────────────────────────────────────── */

export const SidebarFooter = React.forwardRef<HTMLDivElement, SidebarFooterProps>(
  ({ className, children, ...props }, ref) => {
    const { collapsed } = useSidebarContext();
    return (
      <div
        ref={ref}
        data-slot="sidebar-footer"
        data-collapsed={collapsed ? "true" : "false"}
        className={cn(
          "flex shrink-0 items-center py-3",
          "border-t border-[var(--primitive-border,var(--border))]",
          collapsed ? "justify-center px-0" : "gap-2.5 px-[18px]",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
SidebarFooter.displayName = "SidebarFooter";

/* ─── <SidebarToggle> ───────────────────────────────────────── */

export const SidebarToggle = React.forwardRef<HTMLButtonElement, SidebarToggleProps>(
  (
    {
      className,
      children,
      collapsed: collapsedProp,
      onToggle,
      labels = { collapse: "Replier la barre latérale", expand: "Déplier la barre latérale" },
      ...props
    },
    ref,
  ) => {
    const ctx = React.useContext(SidebarContext);
    const usesContext = ctx?.variant === "collapsible";

    const collapsed = usesContext ? ctx!.collapsed : collapsedProp;
    const toggle = usesContext ? ctx!.toggleCollapsed : onToggle;

    if (collapsed === undefined || !toggle) return null;

    return (
      <button
        ref={ref}
        type="button"
        data-slot="sidebar-toggle"
        data-collapsed={collapsed ? "true" : "false"}
        onClick={toggle}
        aria-label={collapsed ? labels.expand : labels.collapse}
        title={collapsed ? labels.expand : labels.collapse}
        aria-expanded={!collapsed}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-[var(--primitive-radius-control-sm,0.625rem)] outline-none",
          "text-[var(--muted-foreground)]",
          "hover:bg-[color:var(--primitive-surface-hover,color-mix(in_srgb,var(--foreground)_6%,transparent))] hover:text-[var(--foreground)]",
          "focus-visible:ring-2 focus-visible:ring-[color:var(--primitive-ring,color-mix(in_srgb,var(--foreground)_45%,transparent))]",
          "[transition:transform_120ms_cubic-bezier(0.23,1,0.32,1),color_150ms_ease,background-color_150ms_ease]",
          "active:[transform:scale(0.96)]",
          "motion-reduce:active:[transform:none]",
          className,
        )}
        {...props}
      >
        {typeof children === "function"
          ? children({ collapsed })
          : (children ??
            (collapsed ? (
              <PanelLeftOpen className="size-[17px]" strokeWidth={1.75} />
            ) : (
              <PanelLeftClose className="size-[17px]" strokeWidth={1.75} />
            )))}
      </button>
    );
  },
);
SidebarToggle.displayName = "SidebarToggle";
