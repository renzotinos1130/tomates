import { createElement, forwardRef, type ForwardRefExoticComponent, type RefAttributes, type SVGProps } from "react";

/** What an icon is drawn with: elements of the 24 px grid, attributes in React's spelling. */
export type IconNode = [tag: "path" | "circle" | "rect", attrs: Record<string, string>][];

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  /** Width and height, in px (24 by default). A `size-*` class does the same. */
  size?: number | string;
  /** Stroke width on the 24 px grid (2 by default: the way the set is drawn). */
  strokeWidth?: number | string;
}

/** An icon of the app: an SVG that takes the colour of the text around it. */
export type Icon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

/**
 * Makes an icon component from its drawing. `transform` turns or mirrors the
 * whole drawing (a chevron pointing down is the chevron pointing right, turned).
 *
 * An icon says nothing by itself: it is hidden from screen readers unless it
 * is given a name (`aria-label`, `aria-labelledby`) or a role.
 */
export function icon(name: string, node: IconNode, transform?: string): Icon {
  const Component = forwardRef<SVGSVGElement, IconProps>(function Icon(
    { size = 24, strokeWidth = 2, className, children, ...props },
    ref,
  ) {
    const drawing = node.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }));
    const named = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined || props.role !== undefined;
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={named ? undefined : true}
        {...props}
        className={className ? `icon ${className}` : "icon"}
      >
        {transform ? <g transform={transform}>{drawing}</g> : drawing}
        {children}
      </svg>
    );
  });
  Component.displayName = name;
  return Component;
}
