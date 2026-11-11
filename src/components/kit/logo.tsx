import { PixelTomato } from "./pixel-tomato";

/** Team Tomate HQ mark (pixel-art tomato). Sizes that are multiples of 16 stay crisp. */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return <PixelTomato size={size} className={className} />;
}
