import Link from "next/link";
import { Logo } from "@/components/kit/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="app-canvas flex min-h-dvh items-center justify-center p-6">
      <div className="card-surface w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 flex justify-center">
          <Logo size={48} />
        </div>
        <p className="text-xs font-medium text-navy-500">Erreur 404</p>
        <h1 className="mt-1 text-lg font-semibold text-navy-900">Cette page n&apos;existe pas</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Le lien est peut-être incomplet, ou la page a été déplacée.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/">Retour au dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
