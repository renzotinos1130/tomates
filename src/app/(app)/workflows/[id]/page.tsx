import type { Metadata } from "next";
import { WhenReady } from "@/components/app/app-shell";
import { WorkflowEditorPage } from "@/components/workflows/workflow-editor-page";

export const metadata: Metadata = { title: "Workflow" };

export default function Page() {
  return (
    <WhenReady>
      <WorkflowEditorPage />
    </WhenReady>
  );
}
