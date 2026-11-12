import type { Metadata } from "next";
import { WhenReady } from "@/components/app/app-shell";
import { SettingsPage } from "@/components/settings/settings-page";

export const metadata: Metadata = { title: "Paramètres" };

export default function Page() {
  return (
    <WhenReady>
      <SettingsPage />
    </WhenReady>
  );
}
