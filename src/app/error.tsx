"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Logo } from "@/components/kit/logo";
import { Button } from "@/components/ui/button";

/** Last-resort screen if a page crashes: never leave the team on a blank page. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="app-canvas flex min-h-dvh items-center justify-center p-6">
      <div className="card-surface w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 flex justify-center">
          <Logo size={48} />
        </div>
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-coral-50 text-coral-600">
          <TriangleAlert className="size-5" />
        </div>
        <h1 className="text-lg font-semibold text-navy-900">Quelque chose s&apos;est mal passé</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Vos données sont en sécurité. Rechargez la page pour reprendre là où vous en étiez.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={reset}>
            Réessayer
          </Button>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw /> Recharger
          </Button>
        </div>
      </div>
    </div>
  );
}
