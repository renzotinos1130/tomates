import { AppShell } from "@/components/app/app-shell";

/**
 * Authenticated area. The workspace is client-rendered from the store
 * (realtime data): the server only sends the static chrome + skeletons, and
 * every page fills in as soon as the data is loaded.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
