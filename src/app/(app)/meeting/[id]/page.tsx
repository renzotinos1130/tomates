import type { Metadata } from "next";
import { WhenReady } from "@/components/app/app-shell";
import { PastMeeting } from "@/components/meeting/past-meeting";

export const metadata: Metadata = { title: "Récapitulatif du meeting" };

export default function Page() {
  return (
    <WhenReady>
      <PastMeeting />
    </WhenReady>
  );
}
