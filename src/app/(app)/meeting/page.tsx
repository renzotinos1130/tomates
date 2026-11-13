import type { Metadata } from "next";
import { WhenReady } from "@/components/app/app-shell";
import { MeetingPage } from "@/components/meeting/meeting-page";

export const metadata: Metadata = { title: "Meeting hebdomadaire" };

export default function Page() {
  return (
    <WhenReady>
      <MeetingPage />
    </WhenReady>
  );
}
