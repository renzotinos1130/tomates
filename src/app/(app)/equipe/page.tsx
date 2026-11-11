import type { Metadata } from "next";
import { WhenReady } from "@/components/app/app-shell";
import { TeamPage } from "@/components/team/team-page";

export const metadata: Metadata = { title: "Équipe" };

export default function Page() {
  return (
    <WhenReady>
      <TeamPage />
    </WhenReady>
  );
}
