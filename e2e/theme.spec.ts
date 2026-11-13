import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * Le thème du soir : un attribut sur <html>, choisi dans Paramètres → Apparence. De l'encre
 * mate : la photo est rangée, plus rien n'est translucide ni flouté.
 */

const html = (page: Page) => page.locator("html");

async function openAppearance(page: Page) {
  await page.goto("/parametres?section=apparence");
  await expect(page.getByRole("heading", { name: "Apparence", level: 2 })).toBeVisible();
  await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 15000 });
}

/** Les trois thèmes sont des cartes : on clique la carte, le bouton radio est dedans. */
const themeCard = (page: Page, name: string) =>
  page.locator("label").filter({ has: page.getByRole("radio", { name: new RegExp(`^${name}`) }) });

/** Le choix d'un membre, tel que le navigateur le garde. */
const remember = (page: Page, choice: "day" | "night" | "auto") =>
  page.addInitScript((value) => {
    try {
      localStorage.setItem("tthq:theme", JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  }, choice);

test.describe("Thème du soir", () => {
  test("il se choisit dans l'apparence, range le verre et la photo, et tient au rechargement", async ({ page }) => {
    await openAppearance(page);
    await expect(html(page)).not.toHaveAttribute("data-theme", /.+/);
    await expect(page.getByRole("radio", { name: /^Clair/ })).toBeChecked();
    await expect(page.locator(".gw-scene img")).toBeVisible();

    await themeCard(page, "Soir").click();
    await expect(html(page)).toHaveAttribute("data-theme", "night");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0a1222");

    // Plus de photo, plus de flou, plus rien de translucide : la fenêtre et l'en-tête sont opaques.
    await expect(page.locator(".gw-scene img")).toBeHidden();
    const matte = await page.evaluate(() =>
      [".app-window", ".glass", ".gw-panel"].map((selector) => {
        const style = getComputedStyle(document.querySelector(selector)!);
        const alpha = Number(/rgba\(.*,\s*([\d.]+)\)/.exec(style.backgroundColor)?.[1] ?? 1);
        return { selector, alpha, blur: style.backdropFilter };
      }),
    );
    expect(matte).toEqual([
      { selector: ".app-window", alpha: 1, blur: "none" },
      { selector: ".glass", alpha: 1, blur: "none" },
      { selector: ".gw-panel", alpha: 1, blur: "none" },
    ]);

    // Le verre est celui du thème clair : ses réglages attendent, hors d'atteinte.
    await expect(page.getByRole("note")).toContainText("Le thème du soir n'a ni verre ni photo");
    await expect(page.locator("[inert]").getByRole("radio", { name: "Le yacht" })).toHaveCount(1);

    // Au rechargement, le thème est là avant l'application : le script est dans la page servie.
    const served = await (await page.request.get("/")).text();
    expect(served).toContain("tthq:theme");
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "night");
    await expect(page.getByRole("radio", { name: /^Soir/ })).toBeChecked();

    await themeCard(page, "Clair").click();
    await expect(html(page)).not.toHaveAttribute("data-theme", /.+/);
    await expect(page.locator(".gw-scene img")).toBeVisible();
    await expect(page.locator("[inert]")).toHaveCount(0);
  });

  test("automatique : clair le jour, le soir à partir de 19 h, de nouveau clair à 6 h", async ({ page }) => {
    await remember(page, "auto");
    await page.clock.install({ time: new Date("2026-11-11T18:58:00-05:00") });
    await openAppearance(page);
    await expect(page.getByRole("radio", { name: /^Automatique/ })).toBeChecked();
    await expect(html(page)).not.toHaveAttribute("data-theme", /.+/);

    // L'heure passe pendant que l'application est ouverte : elle change d'elle-même.
    await page.clock.fastForward("03:00");
    await expect(html(page)).toHaveAttribute("data-theme", "night");

    // Ouverte en pleine nuit, elle arrive dans le thème du soir ; à 6 h, dans le clair.
    await page.clock.setFixedTime(new Date("2026-11-12T05:59:00-05:00"));
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "night");
    await page.clock.setFixedTime(new Date("2026-11-12T06:00:00-05:00"));
    await page.reload();
    await expect(page.getByRole("heading", { name: "Apparence", level: 2 })).toBeVisible();
    await expect(html(page)).not.toHaveAttribute("data-theme", /.+/);
  });

  test("ce qui garde les couleurs du jour (la connexion, le meeting en direct) les retrouve toutes", async ({ page }) => {
    // Les jetons que le soir redéfinit : lus dans la feuille de style elle-même.
    const css = readFileSync("src/app/globals.css", "utf8");
    const night = /:root\[data-theme="night"\] \{([^}]+)\}/.exec(css)?.[1] ?? "";
    const names = [...night.matchAll(/(--[\w-]+):/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(60);

    const read = (selector: string) =>
      page.evaluate(
        ({ selector, names }) => {
          const style = getComputedStyle(document.querySelector(selector)!);
          return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()]));
        },
        { selector, names },
      );

    await page.goto("/login");
    await expect(page.getByRole("link", { name: "Entrer dans l'espace" })).toBeVisible();
    const day = await read("html");

    await remember(page, "night");
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "night");
    const evening = await read("html");
    const island = await read(".theme-day");

    // Le soir change bien quelque chose, et l'îlot du jour retrouve chaque valeur d'origine.
    // (Un jeton qu'aucun écran n'utilise n'est pas émis le jour : il n'y a rien à retrouver.)
    expect(evening["--color-navy-900"]).not.toBe(day["--color-navy-900"]);
    const used = names.filter((name) => day[name] !== "");
    expect(used.length).toBeGreaterThan(60);
    expect(Object.fromEntries(used.map((name) => [name, island[name]]))).toEqual(Object.fromEntries(used.map((name) => [name, day[name]])));
    // L'écran de connexion reste la scène nette, sa photo comprise.
    await expect(page.locator(".gw-scene img")).toBeVisible();
  });
});
