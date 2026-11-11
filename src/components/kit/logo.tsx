import { cn } from "@/lib/utils";

/**
 * Team Tomate mark — a warm-yellow tomato with a teal calyx on a deep-navy
 * tile: the three Prospero colours in one glyph.
 */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Team Tomate HQ"
    >
      <rect width="32" height="32" rx="9" fill="#0D1B33" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="white" strokeOpacity="0.08" />
      <ellipse cx="16" cy="18.4" rx="8.6" ry="7.7" fill="#F4B331" />
      <ellipse cx="12.3" cy="15.6" rx="2" ry="1.1" transform="rotate(-32 12.3 15.6)" fill="white" fillOpacity="0.38" />
      <path
        d="M16 13.1c-.5-1.5-2.2-2.5-4.3-2.4.7 1.6 2.3 2.6 4.3 2.4zm0 0c.5-1.5 2.2-2.5 4.3-2.4-.7 1.6-2.3 2.6-4.3 2.4zm0 0c-1.2-.9-1.5-2.7-.6-4.5h1.2c.9 1.8.6 3.6-.6 4.5z"
        fill="#34ADA4"
      />
      <path d="M16 9.2V6.6" stroke="#34ADA4" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
