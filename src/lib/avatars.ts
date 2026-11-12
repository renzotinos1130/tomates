import type { Member } from "./types";

/**
 * The team's portraits, shipped with the app (public/avatars, 256 px squares).
 * A member gets theirs by name — whatever the capitals, accents or spaces —
 * unless a picture of their own is set on their profile (`avatar_url`).
 * Nobody else is affected: without a portrait, an avatar shows initials.
 *
 * To add someone: drop `prenom-nom.webp` in public/avatars and add a line here.
 */
const TEAM_PORTRAITS: Record<string, string> = {
  "alexandre halle": "/avatars/alexandre-halle.webp",
  "dominic renzetti": "/avatars/dominic-renzetti.webp",
  "marco drouin": "/avatars/marco-drouin.webp",
  "maya martel": "/avatars/maya-martel.webp",
  "antoine favreau": "/avatars/antoine-favreau.webp",
  "jimmy perreault": "/avatars/jimmy-perreault.webp",
};

const fold = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** The picture to show for a member, or null for initials. */
export function memberPortrait(member: Pick<Member, "full_name" | "avatar_url">): string | null {
  return member.avatar_url || TEAM_PORTRAITS[fold(member.full_name)] || null;
}
