import {
  CalendarCheck2,
  Clapperboard,
  Globe,
  Lightbulb,
  ListChecks,
  Mail,
  Megaphone,
  MessageSquare,
  Palette,
  Rocket,
  Smartphone,
  Sparkles,
  Star,
  Users,
  type IconType,
} from "@/components/kit/icons";

const ICONS: Record<string, IconType> = {
  "calendar-check": CalendarCheck2,
  clapperboard: Clapperboard,
  globe: Globe,
  lightbulb: Lightbulb,
  "list-checks": ListChecks,
  mail: Mail,
  megaphone: Megaphone,
  "message-square": MessageSquare,
  palette: Palette,
  rocket: Rocket,
  smartphone: Smartphone,
  sparkles: Sparkles,
  star: Star,
  users: Users,
};

/**
 * Resolves `lucide:<name>` logo keys to icons (anything else is treated as an image URL).
 * The prefix is the key the saved workflows carry; it names a glyph, not where its drawing comes from.
 */
export function renderWorkflowLogo(logo: string) {
  if (!logo.startsWith("lucide:")) return undefined;
  const Icon = ICONS[logo.slice("lucide:".length)];
  return Icon ? <Icon strokeWidth={1.8} aria-hidden="true" /> : undefined;
}
