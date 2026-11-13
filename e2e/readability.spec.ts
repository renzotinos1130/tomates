import { expect, test, type Page } from "@playwright/test";

/**
 * Lisibilité sur le verre. Le verre est clair et la photo, derrière, change d'un écran à
 * l'autre : on ne peut pas déduire le contraste des couleurs du thème. Chaque morceau de texte
 * visible est donc comparé aux pixels réellement derrière lui, pris sur une capture où le texte
 * est rendu transparent. Seuil : 4,5:1 (3:1 pour les grands titres), sur les deux scènes, puis
 * dans le thème du soir, où la même mesure vaut pour l'encre mate.
 */

interface TextRun {
  text: string;
  color: string;
  size: number;
  weight: number;
  /** Opacité cumulée des ancêtres : elle estompe le texte aussi. */
  fade: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Weak {
  text: string;
  ratio: number;
  color: string;
  size: number;
}

/** Tout le texte visible sous `scope`, avec sa couleur et la place qu'il occupe à l'écran. */
function textRuns(page: Page, scope: string): Promise<TextRun[]> {
  return page.evaluate((selector) => {
    const out: TextRun[] = [];
    for (const root of document.querySelectorAll(selector)) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
        const el = node.parentElement;
        if (!text || !el) continue;
        // Ni ce qui est hors du parcours, ni un contrôle inactif (exempté par WCAG).
        if (el.closest('[inert], [aria-hidden="true"], .sr-only, svg, [disabled], [aria-disabled="true"]')) continue;
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") continue;

        let fade = 1;
        let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
        for (let a: Element | null = el; a && a !== document.documentElement; a = a.parentElement) {
          const s = getComputedStyle(a);
          fade *= Number(s.opacity);
          // Ce que les ancêtres laissent voir : points de suspension, zones défilantes, listes coupées.
          if (s.overflowX !== "visible" || s.overflowY !== "visible") {
            const b = a.getBoundingClientRect();
            clip = {
              left: Math.max(clip.left, b.left),
              top: Math.max(clip.top, b.top),
              right: Math.min(clip.right, b.right),
              bottom: Math.min(clip.bottom, b.bottom),
            };
          }
        }
        if (fade === 0) continue;

        const range = document.createRange();
        range.selectNodeContents(node);
        for (const raw of range.getClientRects()) {
          const left = Math.max(raw.left, clip.left);
          const top = Math.max(raw.top, clip.top);
          const w = Math.min(raw.right, clip.right) - left;
          const h = Math.min(raw.bottom, clip.bottom) - top;
          if (w < 3 || h < 3) continue;
          // Réellement au-dessus à cet endroit : un lien étiré, transparent, ne cache rien.
          let onTop = false;
          for (const hit of document.elementsFromPoint(left + w / 2, top + h / 2)) {
            if (hit === el || el.contains(hit) || hit.contains(el)) {
              onTop = true;
              break;
            }
            const hs = getComputedStyle(hit);
            const clear =
              (hs.backgroundColor === "rgba(0, 0, 0, 0)" || hs.backgroundColor === "transparent") &&
              hs.backgroundImage === "none" &&
              !/^(img|canvas|video)$/i.test(hit.tagName) &&
              !hit.closest("svg");
            if (!clear) break;
          }
          if (!onTop) continue;
          out.push({
            text: text.slice(0, 40),
            color: style.color,
            size: parseFloat(style.fontSize),
            weight: Number(style.fontWeight) || 400,
            fade,
            x: left,
            y: top,
            w,
            h,
          });
        }
      }
    }
    return out;
  }, scope);
}

/**
 * Les morceaux de texte sous le seuil, et le nombre de morceaux mesurés. Pour chacun, le rapport
 * retenu est celui du 5e centile de ses pixels : le pire endroit du mot, pas sa moyenne.
 */
async function weakText(page: Page, scope = "#app-scroll, .nav-glass"): Promise<{ measured: number; weak: Weak[] }> {
  const runs = await textRuns(page, scope);
  const hide = await page.addStyleTag({
    content:
      // The text goes, and what is drawn with it (a strike-through line is ink, not background).
      "*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-decoration-color: transparent !important; text-shadow: none !important; transition: none !important; }",
  });
  await page.waitForTimeout(150);
  const png = (await page.screenshot()).toString("base64");
  await hide.evaluate((el) => (el as Element).remove());

  return page.evaluate(
    async ({ png, runs }) => {
      const picture = new Image();
      picture.src = `data:image/png;base64,${png}`;
      await picture.decode();
      const canvas = document.createElement("canvas");
      canvas.width = picture.naturalWidth;
      canvas.height = picture.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(picture, 0, 0);
      const scale = picture.naturalWidth / innerWidth;

      // Le navigateur lit lui-même la couleur, quelle que soit sa syntaxe.
      const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
      const rgba = (color: string) => {
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = color;
        probe.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
        return { r, g, b, a: a / 255 };
      };
      const linear = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
      const luminance = (r: number, g: number, b: number) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

      const weak: Weak[] = [];
      let measured = 0;
      for (const run of runs) {
        const x = Math.max(0, Math.round(run.x * scale));
        const y = Math.max(0, Math.round(run.y * scale));
        const w = Math.min(canvas.width - x, Math.round(run.w * scale));
        const h = Math.min(canvas.height - y, Math.round(run.h * scale));
        if (w < 2 || h < 2) continue;
        const ink = rgba(run.color);
        const alpha = ink.a * run.fade;
        const data = ctx.getImageData(x, y, w, h).data;
        const stride = Math.max(1, Math.floor((w * h) / 500));
        const ratios: number[] = [];
        for (let p = 0; p < w * h; p += stride) {
          const [r, g, b] = [data[p * 4], data[p * 4 + 1], data[p * 4 + 2]];
          const back = luminance(r, g, b);
          const front = luminance(ink.r * alpha + r * (1 - alpha), ink.g * alpha + g * (1 - alpha), ink.b * alpha + b * (1 - alpha));
          ratios.push((Math.max(back, front) + 0.05) / (Math.min(back, front) + 0.05));
        }
        ratios.sort((a, b) => a - b);
        const ratio = ratios[Math.floor(ratios.length * 0.05)];
        measured += 1;
        const large = run.size >= 24 || (run.size >= 18.66 && run.weight >= 700);
        if (ratio < (large ? 3 : 4.5)) weak.push({ text: run.text, ratio: Math.round(ratio * 100) / 100, color: run.color, size: run.size });
      }
      return { measured, weak };
    },
    { png, runs },
  );
}

interface Screen {
  name: string;
  path: string;
  heading: string | RegExp;
  atLeast: number;
}

const SCREENS: Screen[] = [
  // Le bento posé sur l'image, puis trois écrans sur leur feuille.
  { name: "le dashboard", path: "/", heading: /Dominic/, atLeast: 60 },
  { name: "un projet", path: "/projets/site-web", heading: "Site Web", atLeast: 40 },
  { name: "les messages", path: "/messages", heading: "Messages", atLeast: 30 },
  { name: "l'équipe", path: "/equipe", heading: "Équipe", atLeast: 50 },
  { name: "les paramètres", path: "/parametres?section=apparence", heading: "Paramètres", atLeast: 20 },
];

/** Le soir, on regarde aussi les écrans les plus denses : les mêmes encres y servent autrement. */
const EVENING_SCREENS: Screen[] = [
  // (Dans les paramètres, les réglages du verre sont hors d'atteinte le soir : moins de texte à mesurer.)
  ...SCREENS.map((s) => (s.path.startsWith("/parametres") ? { ...s, atLeast: 12 } : s)),
  { name: "mes tâches", path: "/mes-taches", heading: "Mes tâches", atLeast: 20 },
  { name: "le meeting", path: "/meeting", heading: "Meeting hebdomadaire", atLeast: 40 },
  { name: "les workflows", path: "/workflows", heading: "Workflows", atLeast: 6 },
];

async function settle(page: Page, heading: string | RegExp) {
  await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 15000 });
  // Loin de la navigation (elle s'ouvrirait) ; le temps que la photo se givre et que les tuiles arrivent.
  await page.mouse.move(1270, 6);
  await page.waitForTimeout(1500);
}

test.describe("Lisibilité sur le verre", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const scene of ["La ferme", "Le yacht"] as const) {
    test(`${scene} : tout le texte tient 4,5:1 sur ce qui est réellement derrière lui`, async ({ page }) => {
      await page.goto("/");
      await settle(page, /Dominic/);
      if (scene === "Le yacht") {
        // Choisie comme un membre le ferait, dans les paramètres : la scène vient avec le givre qui lui convient.
        await page.goto("/parametres?section=apparence");
        await page.getByRole("radio", { name: scene }).click();
        await expect(page.locator('.gw-scope > div[aria-hidden] img[src*="yacht"]')).toHaveCount(1);
      }

      for (const screen of SCREENS) {
        await page.goto(screen.path);
        await settle(page, screen.heading);
        const { measured, weak } = await weakText(page);
        // La mesure a bien vu l'écran, et rien n'y est sous le seuil.
        expect(measured, `${screen.name} : morceaux de texte mesurés`).toBeGreaterThanOrEqual(screen.atLeast);
        expect(weak, `${screen.name} sur ${scene}`).toEqual([]);
      }
    });
  }

  test("Le soir : sur l'encre mate aussi, tout le texte tient 4,5:1", async ({ page }) => {
    test.setTimeout(150_000);
    // Choisi comme un membre le ferait, dans les paramètres.
    await page.goto("/parametres?section=apparence");
    await settle(page, "Paramètres");
    await page.locator("label").filter({ has: page.getByRole("radio", { name: /^Soir/ }) }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "night");

    for (const screen of EVENING_SCREENS) {
      await page.goto(screen.path);
      await settle(page, screen.heading);
      const { measured, weak } = await weakText(page);
      expect(measured, `${screen.name} : morceaux de texte mesurés`).toBeGreaterThanOrEqual(screen.atLeast);
      expect(weak, `${screen.name}, le soir`).toEqual([]);
    }
  });
});
