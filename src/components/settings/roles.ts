import { Handshake, Shield, ShieldCheck, type IconType } from "@/components/kit/icons";
import { ROLE_LABEL } from "@/lib/roles";
import type { MemberRole } from "@/lib/types";

/** How each role is named and drawn, wherever members are administered. */
export const ROLE_META: Record<MemberRole, { label: string; icon: IconType; hint: string }> = {
  member: {
    label: ROLE_LABEL.member,
    icon: Handshake,
    hint: "Voit et modifie les projets, les tâches et les meetings.",
  },
  admin: {
    label: ROLE_LABEL.admin,
    icon: Shield,
    hint: "Gère aussi les invitations et l'accès des partenaires.",
  },
  super_admin: {
    label: ROLE_LABEL.super_admin,
    icon: ShieldCheck,
    hint: "Gère aussi les rôles, les comptes et leurs mots de passe.",
  },
};
