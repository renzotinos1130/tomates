import { Logo } from "@/components/kit/logo";

/** Static shell shown while the workspace loads (also the prerendered HTML). */
export function BootScreen() {
  return (
    <div className="app-canvas flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="Chargement">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-pulse">
          <Logo size={44} />
        </div>
        <div className="h-1 w-24 overflow-hidden rounded-full bg-navy-900/[0.08]">
          <div className="h-full w-1/2 animate-[boot_1.1s_ease-in-out_infinite] rounded-full bg-teal-500" />
        </div>
      </div>
      <style>{`@keyframes boot{0%{transform:translateX(-110%)}100%{transform:translateX(220%)}}`}</style>
    </div>
  );
}
