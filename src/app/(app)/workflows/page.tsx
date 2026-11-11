import type { Metadata } from "next";
import { WhenReady } from "@/components/app/app-shell";
import { WorkflowsPage } from "@/components/workflows/workflows-page";

export const metadata: Metadata = { title: "Workflows" };

export default function Page() {
  return (
    <WhenReady>
      <WorkflowsPage />
    </WhenReady>
  );
}
