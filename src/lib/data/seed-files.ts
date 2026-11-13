/**
 * The two files of the sample data, drawn here instead of being shipped: a
 * mock-up (an SVG) and meeting notes (plain text).
 */
import type { TaskAttachment } from "../types";

const MOCKUP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" font-family="system-ui, sans-serif">
<rect width="640" height="480" fill="#f2f0eb"/>
<rect x="220" y="28" width="200" height="424" rx="26" fill="#ffffff" stroke="#0d1b33" stroke-width="3"/>
<rect x="292" y="40" width="56" height="8" rx="4" fill="#0d1b33"/>
<circle cx="320" cy="124" r="38" fill="#ffe1db" stroke="#cc3320" stroke-width="3"/>
<path d="M298 136 q22 20 44 0" fill="none" stroke="#cc3320" stroke-width="3" stroke-linecap="round"/>
<rect x="262" y="182" width="116" height="12" rx="6" fill="#0d1b33"/>
<rect x="278" y="204" width="84" height="8" rx="4" fill="#abb0ba"/>
<rect x="244" y="240" width="152" height="34" rx="9" fill="#f4f5f7" stroke="#d5d9e0"/>
<rect x="244" y="284" width="152" height="34" rx="9" fill="#f4f5f7" stroke="#d5d9e0"/>
<rect x="244" y="328" width="152" height="34" rx="9" fill="#f4f5f7" stroke="#d5d9e0"/>
<rect x="244" y="388" width="152" height="38" rx="19" fill="#cc3320"/>
<text x="320" y="412" text-anchor="middle" font-size="13" font-weight="600" fill="#ffffff">Créer mon profil</text>
<text x="40" y="60" font-size="15" font-weight="600" fill="#0d1b33">Écran profil</text>
<text x="40" y="82" font-size="12" fill="#5c6373">Maquette v2</text>
</svg>`;

const NOTES = `Parcours d'inscription — notes du 9 novembre

1. Courriel, puis code à 6 chiffres : le code expire après 10 minutes.
2. Profil : le nom est obligatoire, la photo ne l'est pas.
3. Objectif : moins de 60 secondes pour créer un compte.

À trancher au meeting : connexion avec Apple dès la première version ?
`;

const bytes = (text: string) => new TextEncoder().encode(text).length;

const MOCKUP_ID = "d0000000-0000-4000-8000-0000000000f1";
const NOTES_ID = "d0000000-0000-4000-8000-0000000000f2";

/** The rows of the two sample files, on the task they belong to. */
export function seedAttachments(
  taskId: string,
  who: { mockup: string; notes: string },
  daysAgo: (days: number, hour?: number) => string,
): TaskAttachment[] {
  return [
    {
      id: MOCKUP_ID,
      task_id: taskId,
      uploader_id: who.mockup,
      name: "Maquette écran profil.svg",
      mime_type: "image/svg+xml",
      size: bytes(MOCKUP),
      storage_path: `${taskId}/${MOCKUP_ID}/maquette-ecran-profil.svg`,
      thumb_path: null,
      created_at: daysAgo(1, 16),
    },
    {
      id: NOTES_ID,
      task_id: taskId,
      uploader_id: who.notes,
      name: "Notes parcours d'inscription.txt",
      mime_type: "text/plain",
      size: bytes(NOTES),
      storage_path: `${taskId}/${NOTES_ID}/notes-parcours-d-inscription.txt`,
      thumb_path: null,
      created_at: daysAgo(2, 11),
    },
  ];
}

/** Their bytes, by attachment id (the second part of a stored path). */
export const SEED_FILES: Record<string, { type: string; body: string }> = {
  [MOCKUP_ID]: { type: "image/svg+xml", body: MOCKUP },
  [NOTES_ID]: { type: "text/plain;charset=utf-8", body: NOTES },
};
