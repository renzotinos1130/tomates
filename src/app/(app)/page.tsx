import type { Metadata } from "next";
import { WhenReady } from "@/components/app/app-shell";
import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <WhenReady>
      <Dashboard />
    </WhenReady>
  );
}
