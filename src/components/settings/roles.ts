import { Handshake, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Member, MemberRole } from "@/lib/types";

/** How each role is named and drawn, wherever members are administered. */
export const ROLE_META: Record<MemberRole, { label: string; icon: LucideIcon; hint: string }> = {
  member: {
    label: "Partenaire",
    icon: Handshake,
    hint: "Voit et modifie les projets, les tâches et les meetings.",
  },
  admin: {
    label: "Administrateur",
    icon: ShieldCheck,
    hint: "Gère aussi les membres et les accès.",
  },
};

/** The team must always keep one active administrator (the database enforces it too). */
export function isLastActiveAdmin(member: Member, all: Member[]): boolean {
  return (
    member.role === "admin" &&
    member.active &&
    !all.some((other) => other.id !== member.id && other.role === "admin" && other.active)
  );
}

export const LAST_ADMIN_MESSAGE = "Impossible de retirer le dernier administrateur actif.";
