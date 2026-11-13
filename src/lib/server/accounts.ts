"use server";

/**
 * Accounts and passwords, on the server.
 *
 * These are the only places where the app creates an account or sets a
 * password. They run with the service key, so each one first works out who is
 * asking, from the session cookie, and what that person may do, from their row
 * in `members` — nothing the browser sends is trusted for that.
 *
 *  - createFirstAccount   only while the team has no member: the first account,
 *                         which the database makes the super administrator.
 *  - createAccount        super administrator: a member, with a temporary password.
 *  - setAccountPassword   super administrator: a new temporary password for a member.
 *  - setAccountEmail      super administrator: the address a member signs in with.
 *  - changeOwnPassword    anyone signed in: their own password (it clears the
 *                         « must change » flag, which only the server can clear).
 *                         Supabase ends every session of an account whose password
 *                         is set this way: the caller signs in again with the new one.
 *
 * « Must change » is written in the account's app metadata, in the same call as
 * the password. The database copies it to `members.must_change_password` inside
 * the Auth server's transaction (handle_user_app_metadata): the two are saved
 * together or not at all, so these functions never write that column themselves.
 *
 * Every function answers `{ ok: true, … }` or `{ ok: false, error }` with a
 * sentence for the person; details stay in the server log.
 */
import { createClient } from "@supabase/supabase-js";
import { EMAIL_PATTERN, passwordProblem } from "@/lib/passwords";
import { getSupabaseAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/types";

type Failure = { ok: false; error: string };
type Outcome<T = object> = ({ ok: true } & T) | Failure;

const fail = (error: string): Failure => ({ ok: false, error });
const NOT_CONFIGURED = "La gestion des comptes n'est pas configurée sur ce serveur (clé de service Supabase absente).";
const NOT_ALLOWED = "Seul un super administrateur peut gérer les comptes et les mots de passe.";
const UNEXPECTED = "Une erreur est survenue. Réessayez dans un instant.";

const MEMBER_COLUMNS = "id, email, full_name, color, avatar_url, role, active, must_change_password, created_at";

/** Who is asking: the signed-in user, checked with the Auth server (not read from the cookie alone). */
async function sessionUser() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** The asker's own row, read with the service key: the role comes from the database, never from the request. */
async function sessionMember(): Promise<Member | null> {
  const user = await sessionUser();
  if (!user) return null;
  const { data } = await getSupabaseAdminClient().from("members").select(MEMBER_COLUMNS).eq("id", user.id).maybeSingle();
  return (data as Member | null) ?? null;
}

async function superAdmin(): Promise<Member | null> {
  const me = await sessionMember();
  return me && me.active && !me.must_change_password && me.role === "super_admin" ? me : null;
}

const cleanEmail = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const cleanName = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");
const cleanPassword = (value: unknown) => (typeof value === "string" ? value : "");

function accountProblem(email: string, fullName: string, password: string): string | null {
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return "Ce courriel n'est pas valide.";
  if (fullName.length < 2 || fullName.length > 80) return "Indiquez le nom complet (2 à 80 caractères).";
  const problem = passwordProblem(password);
  return problem ? `Mot de passe : ${problem.charAt(0).toLowerCase()}${problem.slice(1)}` : null;
}

/* -------------------------------------------------------------------------- */

/** What the sign-in screen needs to know before anyone is signed in: is this a team with nobody in it yet? */
export async function getSetupState(): Promise<{ needsFirstAccount: boolean }> {
  if (!isSupabaseConfigured || !isAdminConfigured) return { needsFirstAccount: false };
  try {
    const { count, error } = await getSupabaseAdminClient().from("members").select("id", { count: "exact", head: true });
    return { needsFirstAccount: !error && count === 0 };
  } catch {
    return { needsFirstAccount: false };
  }
}

/**
 * The first account of a new team. Refused as soon as one member exists; the
 * database then makes that first member the super administrator.
 */
export async function createFirstAccount(input: { email: string; fullName: string; password: string }): Promise<Outcome> {
  if (!isSupabaseConfigured || !isAdminConfigured) return fail(NOT_CONFIGURED);
  const email = cleanEmail(input?.email);
  const fullName = cleanName(input?.fullName);
  const password = cleanPassword(input?.password);
  const problem = accountProblem(email, fullName, password);
  if (problem) return fail(problem);

  try {
    const admin = getSupabaseAdminClient();
    const taken = "L'espace a déjà son premier compte. Connectez-vous, ou demandez un accès au super administrateur.";
    const { count } = await admin.from("members").select("id", { count: "exact", head: true });
    if (count !== 0) return fail(taken);

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) return fail(/already|registered|exists/i.test(error?.message ?? "") ? taken : UNEXPECTED);

    // Two people at the same second: the database made only one of them the super administrator.
    const { data: row } = await admin.from("members").select("role").eq("id", data.user.id).maybeSingle();
    if (row?.role !== "super_admin") {
      await admin.auth.admin.deleteUser(data.user.id);
      return fail(taken);
    }
    return { ok: true };
  } catch (err) {
    console.error("[accounts] createFirstAccount", err instanceof Error ? err.message : err);
    return fail(UNEXPECTED);
  }
}

/** A new member, active at once, with a temporary password they will have to change. */
export async function createAccount(input: {
  email: string;
  fullName: string;
  role: "member" | "admin";
  password: string;
}): Promise<Outcome<{ member: Member }>> {
  if (!isSupabaseConfigured || !isAdminConfigured) return fail(NOT_CONFIGURED);
  try {
    const me = await superAdmin();
    if (!me) return fail(NOT_ALLOWED);

    const email = cleanEmail(input?.email);
    const fullName = cleanName(input?.fullName);
    const password = cleanPassword(input?.password);
    const role = input?.role === "admin" ? "admin" : "member";
    const problem = accountProblem(email, fullName, password);
    if (problem) return fail(problem);

    const admin = getSupabaseAdminClient();
    const { data: existing } = await admin.from("members").select("id").eq("email", email).maybeSingle();
    if (existing) return fail("Un compte existe déjà pour ce courriel.");

    // The invitation is what activates the account, with its role, the moment it is created
    // (see handle_new_user): the member is never « en attente », even for a second.
    const { data: hadInvite } = await admin.from("member_invites").select("email").eq("email", email).maybeSingle();
    const invited = await admin.from("member_invites").upsert({ email, role, invited_by: me.id }, { onConflict: "email" });
    if (invited.error) return fail(UNEXPECTED);

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      // Copied by the database to the member's row: only the service key can write app metadata.
      app_metadata: { must_change_password: true },
    });
    if (error || !data.user) {
      if (!hadInvite) await admin.from("member_invites").delete().eq("email", email);
      return fail(/already|registered|exists/i.test(error?.message ?? "") ? "Un compte existe déjà pour ce courriel." : UNEXPECTED);
    }

    const { data: member } = await admin.from("members").select(MEMBER_COLUMNS).eq("id", data.user.id).maybeSingle();
    // A temporary password that nobody is asked to change must not exist: no account rather than that one.
    if (!member?.active || !member.must_change_password) {
      console.error("[accounts] createAccount: the member row did not follow the new account");
      await admin.auth.admin.deleteUser(data.user.id);
      return fail(UNEXPECTED);
    }
    return { ok: true, member: member as Member };
  } catch (err) {
    console.error("[accounts] createAccount", err instanceof Error ? err.message : err);
    return fail(UNEXPECTED);
  }
}

/** A new temporary password for someone else. They will have to change it the next time they come in. */
export async function setAccountPassword(input: { memberId: string; password: string }): Promise<Outcome> {
  if (!isSupabaseConfigured || !isAdminConfigured) return fail(NOT_CONFIGURED);
  try {
    const me = await superAdmin();
    if (!me) return fail(NOT_ALLOWED);

    const memberId = typeof input?.memberId === "string" ? input.memberId : "";
    const password = cleanPassword(input?.password);
    const problem = passwordProblem(password);
    if (problem) return fail(problem);
    if (memberId === me.id) return fail("Pour votre propre mot de passe, passez par Paramètres → Compte.");

    const admin = getSupabaseAdminClient();
    const { data: target } = await admin.from("members").select("id").eq("id", memberId).maybeSingle();
    if (!target) return fail("Ce membre n'existe plus.");

    // One call, one transaction on the Auth server: the password, and the obligation to change it.
    const { error } = await admin.auth.admin.updateUserById(memberId, {
      password,
      app_metadata: { must_change_password: true },
    });
    if (error) return fail(/weak|short|characters/i.test(error.message) ? "Ce mot de passe est trop faible." : UNEXPECTED);
    return { ok: true };
  } catch (err) {
    console.error("[accounts] setAccountPassword", err instanceof Error ? err.message : err);
    return fail(UNEXPECTED);
  }
}

/**
 * The address a member signs in with (the super administrator's own included).
 * Nothing is sent to either address and the password does not change: from the
 * next sign-in, the new address is the one that opens the account. The member's
 * row follows the account inside the Auth server's transaction
 * (handle_user_email_change): the two are changed together or not at all.
 */
export async function setAccountEmail(input: { memberId: string; email: string }): Promise<Outcome<{ member: Member }>> {
  if (!isSupabaseConfigured || !isAdminConfigured) return fail(NOT_CONFIGURED);
  try {
    const me = await superAdmin();
    if (!me) return fail(NOT_ALLOWED);

    const memberId = typeof input?.memberId === "string" ? input.memberId : "";
    const email = cleanEmail(input?.email);
    if (!EMAIL_PATTERN.test(email) || email.length > 254) return fail("Ce courriel n'est pas valide.");

    const admin = getSupabaseAdminClient();
    const { data: target } = await admin.from("members").select("id, email").eq("id", memberId).maybeSingle();
    if (!target) return fail("Ce membre n'existe plus.");
    if (target.email === email) return fail("C'est déjà le courriel de ce compte.");
    const taken = "Un autre compte utilise déjà ce courriel.";
    const { data: other } = await admin.from("members").select("id").eq("email", email).neq("id", memberId).maybeSingle();
    if (other) return fail(taken);

    // Confirmed at once: no message goes out, and the old address stops opening the account.
    const { error } = await admin.auth.admin.updateUserById(memberId, { email, email_confirm: true });
    if (error) return fail(/already|registered|exists|duplicate|unique/i.test(error.message) ? taken : UNEXPECTED);

    const { data: member } = await admin.from("members").select(MEMBER_COLUMNS).eq("id", memberId).maybeSingle();
    if (!member || member.email !== email) {
      console.error("[accounts] setAccountEmail: the member row did not follow the account");
      return fail(UNEXPECTED);
    }
    // An invitation left for the new address has nothing more to do.
    await admin.from("member_invites").delete().eq("email", email);
    return { ok: true, member: member as Member };
  } catch (err) {
    console.error("[accounts] setAccountEmail", err instanceof Error ? err.message : err);
    return fail(UNEXPECTED);
  }
}

/**
 * My own password. Used by the screen that greets a member whose password was
 * set for them, and by Paramètres → Compte. The session says who I am.
 *
 *  - asked to change it (temporary password): I have just come in with it, so
 *    only the new one is needed, and it must be another one;
 *  - of my own accord: the current password too, so that a session left open on
 *    a desk is not enough to take the account.
 */
export async function changeOwnPassword(input: { password: string; current?: string }): Promise<Outcome> {
  if (!isSupabaseConfigured || !isAdminConfigured) return fail(NOT_CONFIGURED);
  try {
    const user = await sessionUser();
    const email = user?.email;
    if (!user || !email) return fail("Votre session a expiré. Reconnectez-vous.");

    const password = cleanPassword(input?.password);
    const problem = passwordProblem(password);
    if (problem) return fail(problem);

    /** Does this password open my account right now? The session the check opens is closed at once, and only that one. */
    const opens = async (candidate: string) => {
      const probe = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await probe.auth.signInWithPassword({ email, password: candidate });
      if (data.session) {
        await probe.auth.signOut({ scope: "local" });
        return true;
      }
      // 400 is « wrong password »; anything else (rate limit, outage) is not an answer.
      if (error && error.status !== 400) throw error;
      return false;
    };

    const admin = getSupabaseAdminClient();
    const { data: me } = await admin.from("members").select("must_change_password").eq("id", user.id).maybeSingle();
    if (me?.must_change_password) {
      if (await opens(password)) return fail("Choisissez un mot de passe différent du mot de passe temporaire.");
    } else {
      const current = cleanPassword(input?.current);
      if (!current) return fail("Indiquez votre mot de passe actuel.");
      if (!(await opens(current))) return fail("Le mot de passe actuel n'est pas le bon.");
      if (current === password) return fail("Choisissez un mot de passe différent de l'actuel.");
    }

    // One call, one transaction on the Auth server: the password, and the end of the obligation to change it.
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      app_metadata: { must_change_password: false },
    });
    if (error) return fail(/weak|short|characters/i.test(error.message) ? "Ce mot de passe est trop faible." : UNEXPECTED);
    return { ok: true };
  } catch (err) {
    console.error("[accounts] changeOwnPassword", err instanceof Error ? err.message : err);
    return fail(UNEXPECTED);
  }
}
