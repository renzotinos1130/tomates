import type { Member, MemberRole } from "./types";

/**
 * Three roles. A partner works; an administrator also manages the access of
 * partners; the super administrator also manages the roles, the accounts and
 * their passwords. The database enforces all of it (see the migrations): these
 * helpers only decide what the interface offers.
 */
type WithRole = Pick<Member, "role"> | null | undefined;

/** Administrators of both kinds. */
export const isAdmin = (member: WithRole): boolean => member?.role === "admin" || member?.role === "super_admin";

export const isSuperAdmin = (member: WithRole): boolean => member?.role === "super_admin";

export const ROLE_LABEL: Record<MemberRole, string> = {
  super_admin: "Super administrateur",
  admin: "Administrateur",
  member: "Partenaire",
};

/** The roles someone may give when inviting or creating an account. Nobody hands out the super administrator's. */
export const grantableRoles = (by: WithRole): MemberRole[] => (isSuperAdmin(by) ? ["member", "admin"] : ["member"]);
