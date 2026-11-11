/**
 * Fills a LOCAL Supabase instance with the same realistic demo data as the
 * in-browser demo mode (tasks, sub-tasks, comments, meetings, priorities).
 *
 *   npm run db:reset      # schema + the 5 demo accounts (supabase/seed.sql)
 *   npm run seed:local    # this script
 *
 * It refuses to touch anything that is not a local instance: production
 * must never contain fictitious data.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { buildDemoSnapshot } from "../src/lib/data/seed";
import type { Snapshot } from "../src/lib/types";

function loadEnvFile(path: string) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* optional */
  }
}
loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error(`Refus : ${host} n'est pas une instance locale. Les données de démonstration ne vont jamais en production.`);
  }
  if (!secret) {
    throw new Error("SUPABASE_SECRET_KEY manquant (clé « secret » affichée par `npx supabase status`).");
  }
  const sb = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const check = <T>(label: string, res: { data: T; error: { message: string } | null }): T => {
    if (res.error) throw new Error(`${label} : ${res.error.message}`);
    return res.data;
  };

  const demo = buildDemoSnapshot();

  // The demo accounts come from supabase/seed.sql (fixed ids).
  const members = check("members", await sb.from("members").select("id,email"));
  const missing = demo.members.filter((m) => !members?.some((x) => x.id === m.id));
  if (missing.length) {
    throw new Error("Comptes de démonstration absents. Lancez d'abord `npm run db:reset`.");
  }

  // Projects are created by the migration: map demo ids → real ids by slug.
  const projects = check("projects", await sb.from("projects").select("id,slug"));
  let json = JSON.stringify(demo);
  for (const p of demo.projects) {
    const real = projects?.find((x) => x.slug === p.slug);
    if (!real) throw new Error(`Projet « ${p.slug} » introuvable : la migration est-elle appliquée ?`);
    json = json.replaceAll(p.id, real.id);
  }
  const data = JSON.parse(json) as Snapshot;

  // Start clean (cascades to sub-tasks, comments, events, priorities, items).
  check("clear tasks", await sb.from("tasks").delete().not("id", "is", null));
  check("clear meetings", await sb.from("meetings").delete().not("id", "is", null));

  const insert = async (table: string, rows: object[]) => {
    for (let i = 0; i < rows.length; i += 200) {
      check(table, await sb.from(table).insert(rows.slice(i, i + 200), { defaultToNull: false }));
    }
    console.log(`  ${table.padEnd(20)} ${rows.length}`);
  };

  console.log(`Insertion des données de démonstration dans ${url}`);
  await insert("meetings", data.meetings);
  await insert("tasks", data.tasks);
  await insert("subtasks", data.subtasks);
  await insert("comments", data.comments);
  await insert("meeting_items", data.meeting_items);
  await insert("meeting_priorities", data.meeting_priorities);
  // "created" and "commented" events are written by the triggers; add the rest.
  await insert(
    "task_events",
    data.task_events
      .filter((e) => e.kind !== "created" && e.kind !== "commented")
      .map((e) => ({ ...e, id: undefined })),
  );
  console.log("Terminé. Connectez-vous avec camille@prospero.test / tomate-demo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
