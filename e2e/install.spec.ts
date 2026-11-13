import { expect, test } from "@playwright/test";

/**
 * L'application s'installe (« Sur l'écran d'accueil » sur iPhone, « Ajouter au Dock » sur Mac,
 * « Installer » dans Chrome) : un manifeste, des icônes, et la page qui les annonce.
 */
test("installable : le manifeste, ses icônes et l'icône d'iPhone sont servis à qui n'est pas connecté", async ({ page, request }) => {
  await page.goto("/login");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");

  const res = await request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("manifest+json");
  const manifest = await res.json();
  // « Tomate HQ », le même nom partout où un système l'écrit : sous l'icône, dans le Dock, dans la fenêtre d'installation.
  expect(manifest).toMatchObject({ name: "Tomate HQ", short_name: "Tomate HQ", display: "standalone", start_url: "/" });
  // Deux tailles, et une icône « maskable » dont la tomate tient dans la zone sûre.
  expect(manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? ` ${i.purpose}` : ""}`)).toEqual(["192x192", "512x512", "512x512 maskable"]);
  for (const icon of manifest.icons as { src: string }[]) {
    const image = await request.get(icon.src);
    expect(image.status(), icon.src).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
  }

  // L'iPhone prend son icône ici (180 px, sans transparence : il arrondit les coins lui-même), et écrit ce nom dessous.
  const link = page.locator('link[rel="apple-touch-icon"]');
  await expect(link).toHaveAttribute("sizes", "180x180");
  const apple = await request.get((await link.getAttribute("href"))!);
  expect(apple.status()).toBe(200);
  expect(apple.headers()["content-type"]).toBe("image/png");
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "Tomate HQ");
  await expect(page.locator('meta[name="application-name"]')).toHaveAttribute("content", "Tomate HQ");
});

test("le service worker des notifications est servi à qui n'est pas connecté, jamais depuis un cache", async ({ request }) => {
  // Un navigateur le redemande de lui-même, connecté ou non : une redirection vers la connexion le casserait.
  const res = await request.get("/sw.js", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/javascript");
  expect(res.headers()["cache-control"]).toContain("no-cache");
  const source = await res.text();
  expect(source).toContain('addEventListener("push"');
  // Il ne met rien en cache et n'intercepte aucune requête : l'application vient toujours du réseau.
  expect(source).not.toContain('addEventListener("fetch"');
  // La petite marque des notifications (Android) est servie aussi.
  expect((await request.get("/icons/badge-96.png")).status()).toBe(200);
});
