import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * The service key: it bypasses Row Level Security and can create accounts and
 * set passwords. It exists on the server only (the Supabase integration gives
 * it to the Vercel project; locally it is in .env.local) and never reaches a
 * browser: this module cannot be imported from client code.
 */
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Without the key the app still works; accounts are then managed from the Supabase dashboard. */
export const isAdminConfigured = Boolean(SUPABASE_URL && SERVICE_KEY);

let client: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (!isAdminConfigured) throw new Error("La clé de service Supabase n'est pas configurée sur le serveur.");
  if (!client) client = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
