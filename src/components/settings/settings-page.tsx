"use client";

import { Lock } from "@/components/kit/icons";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/kit/empty-state";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/hooks";
import { MembersSection } from "./members-section";

/** What a partner sees: the reason, and nothing about the accounts. */
function Restricted() {
  return (
    <div className="gw-panel gw-reveal mx-auto mt-4 max-w-md">
      <EmptyState
        icon={<Lock />}
        title="Réservé aux administrateurs"
        hint="Les membres et les accès de l'espace sont gérés par les administrateurs de l'équipe."
        action={
          <Button asChild variant="outline">
            <Link href="/equipe">Voir l&apos;équipe</Link>
          </Button>
        }
      />
    </div>
  );
}

/**
 * Workspace settings, for administrators. One section for now: the members.
 * The data rules do not rely on this screen: the database refuses role and
 * access changes from anyone who is not an administrator, and only shows
 * invitations to administrators.
 */
export function SettingsPage() {
  const me = useMe();
  const admin = me?.role === "admin";
  return (
    <>
      <PageHeader title="Paramètres" subtitle={admin ? "Membres et accès" : undefined} />
      <main className="w-full max-w-[1040px] px-4 pt-5 pb-24 sm:px-6 lg:px-8">
        {admin ? <MembersSection /> : <Restricted />}
      </main>
    </>
  );
}
