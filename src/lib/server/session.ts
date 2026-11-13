import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Who is asking, for the Server Functions that write with the service key: the
 * signed-in user, checked with the Auth server (not read from the cookie alone),
 * and only if they are an active member who has chosen their own password.
 */
export async function activeMemberId(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: member } = await getSupabaseAdminClient()
    .from("members")
    .select("id, active, must_change_password")
    .eq("id", data.user.id)
    .maybeSingle();
  return member && member.active && !member.must_change_password ? (member.id as string) : null;
}
