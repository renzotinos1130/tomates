"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/kit/empty-state";
import { Lock } from "@/components/kit/icons";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { AppearanceSection } from "./appearance-section";
import { MembersSection } from "./members-section";

/** The sections of the settings, in the order of their tabs. */
export const SETTINGS_SECTIONS = [
  { key: "apparence", label: "Apparence", adminOnly: false },
  { key: "membres", label: "Membres", adminOnly: true },
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["key"];

export const settingsHref = (section: SettingsSection) => `/parametres?section=${section}`;

/** The section an address asks for: administrators land on the members, everyone else on the look of the app. */
export function settingsSection(param: string | null, admin: boolean): SettingsSection {
  const asked = SETTINGS_SECTIONS.find((s) => s.key === param);
  return asked ? asked.key : admin ? "membres" : "apparence";
}

/** What a partner sees in a section kept for administrators: the reason, and nothing about the accounts. */
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
 * Settings. « Apparence » is everyone's (how the app looks, for me); « Membres »
 * is the administrators'. The data rules do not rely on this screen: the
 * database refuses role and access changes from anyone who is not an
 * administrator, and only shows invitations to administrators.
 */
export function SettingsPage() {
  const me = useMe();
  const admin = me?.role === "admin";
  const section = settingsSection(useSearchParams().get("section"), admin);
  const tabs = SETTINGS_SECTIONS.filter((s) => admin || !s.adminOnly);
  const current = SETTINGS_SECTIONS.find((s) => s.key === section)!;

  return (
    <>
      <PageHeader title="Paramètres" subtitle={current.label}>
        {tabs.length > 1 && (
          <nav aria-label="Sections des paramètres" className="-mb-px flex gap-1">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={settingsHref(t.key)}
                aria-current={section === t.key ? "page" : undefined}
                className={cn(
                  "relative flex h-9 items-center rounded-t-lg px-3 text-[13px] font-medium transition-colors focus-ring",
                  section === t.key ? "text-navy-900" : "text-navy-500 hover:text-navy-800",
                )}
              >
                {t.label}
                {section === t.key && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-navy-900" />}
              </Link>
            ))}
          </nav>
        )}
      </PageHeader>
      <main className="w-full max-w-[1040px] px-4 pt-5 pb-24 sm:px-6 lg:px-8">
        {section === "apparence" ? <AppearanceSection /> : admin ? <MembersSection /> : <Restricted />}
      </main>
    </>
  );
}
