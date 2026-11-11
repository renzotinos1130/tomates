import type { Metadata } from "next";
import { WhenReady } from "@/components/app/app-shell";
import { ProjectPage } from "@/components/board/project-page";

export const metadata: Metadata = { title: "Projet" };

export default function Page() {
  return (
    <WhenReady>
      <ProjectPage />
    </WhenReady>
  );
}
