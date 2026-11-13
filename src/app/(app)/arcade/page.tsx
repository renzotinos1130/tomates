import type { Metadata } from "next";
import { WhenReady } from "@/components/app/app-shell";
import { ArcadePage } from "@/components/arcade/arcade-page";

export const metadata: Metadata = { title: "Tomato Tower" };

export default function Page() {
  return (
    <WhenReady>
      <ArcadePage />
    </WhenReady>
  );
}
