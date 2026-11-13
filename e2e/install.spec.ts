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
  expect(manifest).toMatchObject({ name: "Team Tomate HQ", short_name: "Tomate HQ", display: "standalone", start_url: "/" });
  // Deux tailles, et une icône « maskable » dont la tomate tient dans la zone sûre.
  expect(manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? ` ${i.purpose}` : ""}`)).toEqual(["192x192", "512x512", "512x512 maskable"]);
  for (const icon of manifest.icons as { src: string }[]) {
    const image = await request.get(icon.src);
    expect(image.status(), icon.src).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
  }

  // L'iPhone prend son icône ici, et ouvre l'app en plein écran sous son nom court.
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect((await request.get(apple!)).status()).toBe(200);
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "Tomate HQ");
});
