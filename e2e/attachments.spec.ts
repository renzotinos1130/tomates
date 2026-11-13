import { mkdirSync, truncateSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Les fichiers d'une tâche. En démo les octets restent dans le navigateur ; l'interface, elle,
 * est celle de l'application réelle : on ajoute (choisir, déposer, coller), on suit l'envoi, on
 * ouvre, on retire. Le vrai stockage (Supabase, envoi reprenable) est vérifié à part, contre une
 * instance locale (voir README, « Vérifié »).
 */

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const TASK = "Finaliser le parcours d'inscription";

async function openTask(page: Page): Promise<Locator> {
  await page.goto("/projets/application");
  await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 15000 });
  await page.getByText(TASK).first().click();
  const sheet = page.getByRole("dialog", { name: TASK });
  await expect(sheet.getByRole("heading", { name: "Fichiers" })).toBeVisible();
  return sheet;
}

const files = (sheet: Locator) => sheet.getByRole("region", { name: "Fichiers" });
const tile = (sheet: Locator, name: string) => sheet.getByRole("button", { name: `Ouvrir ${name}` });

test.describe("Fichiers d'une tâche", () => {
  test("on en ajoute, on les ouvre, on en retire, et ils sont encore là au rechargement", async ({ page }) => {
    const sheet = await openTask(page);
    const row = page.locator('[class*="group/row"]', { hasText: TASK });

    // Deux fichiers d'exemple : une maquette, montrée telle quelle, et des notes, par leur type.
    await expect(files(sheet).getByRole("listitem")).toHaveCount(2);
    await expect(tile(sheet, "Maquette écran profil.svg").locator("img")).toBeVisible();
    await expect(files(sheet).getByRole("listitem").filter({ hasText: "Notes parcours" })).toContainText("txt");
    await expect(row.getByTitle("Fichiers")).toHaveText("2");

    // On en choisit deux : chacun apparaît tout de suite avec son envoi, puis prend sa place.
    await sheet.getByLabel("Joindre des fichiers").setInputFiles([
      { name: "Capture d'écran.png", mimeType: "image/png", buffer: PNG },
      { name: "export-donnees.zip", mimeType: "application/zip", buffer: Buffer.alloc(2048) },
    ]);
    await expect(sheet.getByRole("progressbar", { name: "Envoi de Capture d'écran.png" })).toBeVisible();
    await expect(tile(sheet, "Capture d'écran.png")).toBeVisible();
    await expect(tile(sheet, "export-donnees.zip")).toBeVisible();
    // (Dans la section : les sous-tâches ont leur propre barre d'avancement.)
    await expect(files(sheet).getByRole("progressbar")).toHaveCount(0);
    await expect(files(sheet).getByRole("listitem")).toHaveCount(4);
    await expect(files(sheet).getByRole("listitem").filter({ hasText: "export-donnees.zip" })).toContainText(/2 Ko · Dominic/);
    await expect(row.getByTitle("Fichiers")).toHaveText("4");
    // L'historique de la tâche le dit.
    await expect(sheet.getByText("a joint « Capture d'écran.png »")).toBeVisible();

    // Ouvrir : l'image en grand, puis les flèches passent d'un fichier à l'autre.
    await tile(sheet, "Maquette écran profil.svg").click();
    const viewer = page.getByRole("dialog", { name: "Maquette écran profil.svg" });
    await expect(viewer.getByRole("img", { name: "Maquette écran profil.svg" })).toBeVisible();
    await expect(viewer).toContainText("ajouté par Maya Martel");
    await expect(viewer).toContainText("2 sur 4");
    await page.keyboard.press("ArrowLeft");
    const notes = page.getByRole("dialog", { name: "Notes parcours d'inscription.txt" });
    await expect(notes).toContainText("le code expire après 10 minutes");
    await notes.getByRole("button", { name: "Fichier précédent" }).click();
    // Un type que le navigateur ne montre pas : on le dit, et on propose de le télécharger.
    const archive = page.getByRole("dialog", { name: "export-donnees.zip" });
    await expect(archive).toContainText("Pas d'aperçu pour ce type de fichier.");
    const download = page.waitForEvent("download");
    await archive.getByRole("button", { name: "Télécharger export-donnees.zip" }).click();
    expect((await download).suggestedFilename()).toBe("export-donnees.zip");
    await page.keyboard.press("Escape");
    await expect(archive).toHaveCount(0);

    // Retirer se confirme.
    await sheet.getByRole("button", { name: "Actions pour export-donnees.zip" }).click();
    await page.getByRole("menuitem", { name: "Retirer" }).click();
    const confirm = page.getByRole("dialog", { name: "Retirer ce fichier ?" });
    await expect(confirm).toContainText("« export-donnees.zip » sera retiré de la tâche");
    await confirm.getByRole("button", { name: "Retirer" }).click();
    await expect(tile(sheet, "export-donnees.zip")).toHaveCount(0);
    await expect(files(sheet).getByRole("listitem")).toHaveCount(3);

    // Au rechargement, les fichiers et leurs octets sont toujours là.
    await page.reload();
    await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 15000 });
    await page.getByText(TASK).first().click();
    const again = page.getByRole("dialog", { name: TASK });
    await expect(files(again).getByRole("listitem")).toHaveCount(3);
    const picture = tile(again, "Capture d'écran.png").locator("img");
    await expect(picture).toBeVisible();
    await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
  });

  test("déposer ou coller joint aussi ; trop lourd, c'est non, avec des mots", async ({ page }) => {
    const sheet = await openTask(page);
    const dropped = await page.evaluateHandle(() => {
      const data = new DataTransfer();
      data.items.add(new File(["Bonjour"], "depose.txt", { type: "text/plain" }));
      return data;
    });

    // Un fichier tenu au-dessus du panneau : il dit où déposer ; lâché, il est joint.
    const title = sheet.getByLabel("Titre de la tâche");
    await title.dispatchEvent("dragenter", { dataTransfer: dropped });
    await expect(sheet.getByText("Déposez pour joindre à la tâche")).toBeVisible();
    await title.dispatchEvent("drop", { dataTransfer: dropped });
    await expect(sheet.getByText("Déposez pour joindre à la tâche")).toHaveCount(0);
    await expect(tile(sheet, "depose.txt")).toBeVisible();

    // Une capture collée dans la description part dans les fichiers, pas dans le texte.
    await sheet.getByLabel("Description").evaluate((field) => {
      const data = new DataTransfer();
      data.items.add(new File([new Uint8Array(900)], "capture-collee.png", { type: "image/png" }));
      field.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await expect(files(sheet).getByRole("listitem").filter({ hasText: "capture-collee.png" })).toBeVisible();
    // (Dans la section : les sous-tâches ont leur propre barre d'avancement.)
    await expect(files(sheet).getByRole("progressbar")).toHaveCount(0);
    await expect(files(sheet).getByRole("listitem")).toHaveCount(4);

    // 101 Mo : refusé avant tout envoi, avec le poids du fichier et la limite. (Un fichier « creux » :
    // sa taille est réelle, ses octets ne sont lus par personne.)
    const dir = test.info().outputPath();
    mkdirSync(dir, { recursive: true });
    const heavy = join(dir, "film-du-lancement.mov");
    writeFileSync(heavy, "");
    truncateSync(heavy, 101 * 1024 * 1024);
    await sheet.getByLabel("Joindre des fichiers").setInputFiles(heavy);
    await expect(page.getByText("« film-du-lancement.mov » n'a pas été joint")).toBeVisible();
    await expect(page.getByText("Ce fichier pèse 101 Mo : la limite est de 100 Mo.")).toBeVisible();
    await expect(files(sheet).getByRole("listitem")).toHaveCount(4);
  });

  test("un envoi s'annule en route, sans rien laisser", async ({ page }) => {
    // L'horloge est tenue : l'envoi de la démo avance quand on la fait avancer.
    await page.clock.install();
    await page.goto("/projets/application");
    await page.clock.runFor(8000);
    await page.getByText(TASK).first().click();
    const sheet = page.getByRole("dialog", { name: TASK });
    await expect(files(sheet).getByRole("listitem")).toHaveCount(2);

    await sheet.getByLabel("Joindre des fichiers").setInputFiles({ name: "rushes.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(4096) });
    const bar = sheet.getByRole("progressbar", { name: "Envoi de rushes.mp4" });
    await expect(bar).toBeVisible();
    // (L'horloge arrêtée arrête aussi les images : le clic n'attend pas que le bouton « se pose ».)
    await sheet.getByRole("button", { name: "Annuler l'envoi de rushes.mp4" }).dispatchEvent("click");
    await page.clock.runFor(3000);
    await expect(bar).toHaveCount(0);
    await expect(files(sheet).getByRole("listitem")).toHaveCount(2);
    await expect(tile(sheet, "rushes.mp4")).toHaveCount(0);
  });
});
