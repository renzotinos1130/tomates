#!/usr/bin/env node
/**
 * Runs before `next build` on Vercel (see vercel.json).
 *
 * On a PRODUCTION build that knows the production database — the Supabase
 * integration gives the Vercel project POSTGRES_URL_NON_POOLING — the files of
 * supabase/migrations the database has not seen yet are applied with the
 * Supabase CLI, in order, and recorded in supabase_migrations.schema_migrations:
 * exactly what `supabase db push` does from a laptop.
 *
 * A migration that fails makes the build fail. The deployment in place stays
 * in place, and code that needs a new table never goes out without it.
 *
 * Everywhere else (preview deployments, a local build, the demo) this does
 * nothing. The seed (supabase/seed.sql, demo accounts) is never applied here.
 */
import { spawnSync } from "node:child_process";

const url = process.env.POSTGRES_URL_NON_POOLING;
if (process.env.VERCEL_ENV !== "production" || !url) {
  console.log("[migrations] pas un déploiement de production relié à une base : rien à appliquer.");
  process.exit(0);
}

// Only what a connection needs: the integration's URL may carry parameters of its own,
// which Postgres would refuse as settings it does not know.
const target = new URL(url);
const sslmode = target.searchParams.get("sslmode") ?? "require";
target.search = `?sslmode=${sslmode}`;

console.log(`[migrations] base de production : ${target.hostname}:${target.port || 5432}`);
// The CLI is a devDependency: no download here. Its output names the files it applies,
// never the password.
const push = spawnSync("npx", ["--no-install", "supabase", "db", "push", `--remote=${target.toString()}`, "--yes", "--skip-vault"], {
  stdio: "inherit",
});
if (push.error) console.error(`[migrations] la CLI Supabase n'a pas pu démarrer : ${push.error.message}`);
if (push.status !== 0) {
  console.error("[migrations] échec : le déploiement est arrêté, la version en place reste en ligne.");
  process.exit(push.status ?? 1);
}
console.log("[migrations] la base est à jour.");
