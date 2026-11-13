import type { Member } from "./types";

/**
 * The team's portraits, shipped with the app (public/avatars, 256 px squares).
 * A member gets theirs by name — whatever the capitals, accents or spaces, and
 * by first name when that is all the profile says — unless a picture of their
 * own is set on their profile (`avatar_url`).
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

/**
 * A first name alone is enough when it is the whole name and only one portrait
 * answers to it: an account created from an invitation is named after its
 * address (« Dominic ») until its owner writes their full name.
 */
const BY_FIRST_NAME: Record<string, string | null> = {};
for (const [name, picture] of Object.entries(TEAM_PORTRAITS)) {
  const first = name.split(" ")[0];
  BY_FIRST_NAME[first] = first in BY_FIRST_NAME ? null : picture;
}

/**
 * Whose portrait a member answers to, as its name here (« dominic renzetti »),
 * or null. For what is drawn after the portraits (the block characters of the
 * game): the name, not the address of the picture, which a build may rewrite.
 */
export function portraitName(member: Pick<Member, "full_name">): string | null {
  const name = fold(member.full_name);
  if (name in TEAM_PORTRAITS) return name;
  if (name.includes(" ") || !BY_FIRST_NAME[name]) return null;
  return Object.keys(TEAM_PORTRAITS).find((n) => n.split(" ")[0] === name) ?? null;
}

/** The picture to show for a member, or null for initials. */
export function memberPortrait(member: Pick<Member, "full_name" | "avatar_url">): string | null {
  if (member.avatar_url) return member.avatar_url;
  const name = fold(member.full_name);
  return TEAM_PORTRAITS[name] ?? (name.includes(" ") ? null : (BY_FIRST_NAME[name] ?? null));
}
