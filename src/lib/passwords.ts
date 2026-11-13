/** The shortest password the app accepts, for a temporary one as for the member's own. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

/** What is wrong with a password, in words, or null when it will do. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Au moins ${PASSWORD_MIN} caractères.`;
  if (password.length > PASSWORD_MAX) return `Au plus ${PASSWORD_MAX} caractères.`;
  if (password.trim() !== password) return "Pas d'espace au début ni à la fin.";
  return null;
}

/** Letters and digits that cannot be mistaken for one another when read aloud or copied by hand. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * A temporary password to hand to someone: four groups of four, easy to read
 * and to dictate (« k7mq-x4tb-9hwn-p3sd »), about 79 bits of chance.
 */
export function generatePassword(): string {
  const picks = new Uint32Array(16);
  crypto.getRandomValues(picks);
  const chars = Array.from(picks, (n) => ALPHABET[n % ALPHABET.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
