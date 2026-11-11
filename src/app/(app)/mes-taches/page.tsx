import type { Metadata } from "next";
import { WhenReady } from "@/components/app/app-shell";
import { MyTasks } from "@/components/my-tasks/my-tasks";

export const metadata: Metadata = { title: "Mes tâches" };

export default function Page() {
  return (
    <WhenReady>
      <MyTasks />
    </WhenReady>
  );
}
