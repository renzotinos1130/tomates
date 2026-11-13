import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/proxy-session";

/**
 * Next.js 16 proxy (formerly middleware). Keeps the Supabase session fresh
 * and redirects signed-out visitors to /login. In demo mode (no Supabase
 * configured) every request simply passes through.
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  // The manifest is fetched without the session's cookies: it must be served to anyone, like the icons.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)"],
};
