"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ui, useApp } from "@/lib/store";

/** Single confirmation dialog, driven by `ui.confirm({...})`. */
export function ConfirmDialog() {
  const request = useApp((s) => s.confirm);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && ui.closeConfirm()}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          {request?.description && <DialogDescription>{request.description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => ui.closeConfirm()}>
            Annuler
          </Button>
          <Button
            autoFocus
            variant={request?.destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={async () => {
              if (!request) return;
              setBusy(true);
              try {
                await request.onConfirm();
              } finally {
                setBusy(false);
                ui.closeConfirm();
              }
            }}
          >
            {request?.confirmLabel ?? "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
