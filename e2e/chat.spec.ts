import { expect, test, type Page } from "@playwright/test";

/** Demo data: the team channel and the people (src/lib/chat.ts, src/lib/data/seed.ts). */
const GENERAL = "c0000000-0000-4000-8000-000000000001";
const MATHIEU = "22222222-2222-4222-8222-222222222222";
const SOPHIE = "55555555-5555-4555-8555-555555555555";

/** The page header (title, « N non lus », « Nouveau message »). */
const header = (page: Page) => page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });
const list = (page: Page) => page.getByRole("navigation", { name: "Conversations", exact: true });
const thread = (page: Page) => page.getByRole("log");
const messages = (page: Page) => thread(page).locator("[data-message-id]");
const composer = (page: Page, to: string) => page.getByRole("textbox", { name: `Message à ${to}`, exact: true });
const confirmDelete = (page: Page) => page.getByRole("dialog").getByRole("button", { name: "Supprimer", exact: true }).click();

/**
 * In demo mode a tab is whoever `tthq:demo:me` names when it starts (Camille by
 * default): the next tab opened in the same browser is that member, the tabs
 * already open stay who they are.
 */
async function nextTabIs(page: Page, memberId: string) {
  await page.evaluate((id) => localStorage.setItem("tthq:demo:me", id), memberId);
}

test.describe("Messages", () => {
  test("canal Général : écrire, aller à la ligne, retrouver son message puis le supprimer", async ({ page }) => {
    await page.goto("/messages");
    await expect(page.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();

    // Sur un grand écran, le canal de l'équipe est ouvert d'office.
    const field = composer(page, "Général");
    await expect(thread(page).getByText("Je regarde ça tout de suite.")).toBeVisible();

    await field.fill("Bonjour l'équipe, test du canal");
    await field.press("Enter");
    await expect(field).toHaveValue("");
    await expect(messages(page).last()).toContainText("Bonjour l'équipe, test du canal");
    await expect(list(page).getByRole("link", { name: /Général/ })).toContainText("Vous : Bonjour l'équipe, test du canal");

    // Maj + Entrée va à la ligne, Entrée envoie.
    await field.fill("Première ligne");
    await field.press("Shift+Enter");
    await field.pressSequentially("Deuxième ligne");
    await expect(thread(page).getByText("Première ligne")).toHaveCount(0);
    await field.press("Enter");
    await expect(messages(page).last()).toContainText(/Première ligne\s+Deuxième ligne/);

    // Un émoji s'insère là où se trouve le curseur.
    await field.fill("Bravo  !");
    await field.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(6, 6));
    await page.getByRole("button", { name: "Insérer un émoji" }).click();
    await page.getByRole("group", { name: "Émojis" }).getByRole("button", { name: "Tomate", exact: true }).click();
    await expect(field).toHaveValue("Bravo 🍅 !");
    await expect(field).toBeFocused();
    await field.fill("");

    // Tout est encore là après rechargement.
    await page.reload();
    const mine = messages(page).filter({ hasText: "Bonjour l'équipe, test du canal" });
    await expect(mine).toBeVisible();

    // Supprimer : le message garde sa place dans le fil, sans son texte.
    await mine.hover();
    await mine.getByRole("button", { name: "Supprimer ce message" }).click();
    await confirmDelete(page);
    await expect(thread(page).getByText("Bonjour l'équipe, test du canal")).toHaveCount(0);
    await expect(thread(page).getByText("Message supprimé")).toBeVisible();

    await page.reload();
    await expect(thread(page).getByText("Message supprimé")).toBeVisible();
    await expect(thread(page).getByText("Bonjour l'équipe, test du canal")).toHaveCount(0);
  });

  test("message direct : le sélecteur ouvre la conversation, le destinataire voit un non-lu, personne d'autre ne la voit", async ({
    context,
    page,
  }) => {
    await page.goto("/messages");
    await page.getByRole("button", { name: "Nouveau message" }).click();
    await page.getByPlaceholder("À qui écrire ?").fill("mathieu");
    await page.getByRole("option", { name: /Mathieu Gagnon/ }).click();

    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/);
    const address = page.url();
    await expect(thread(page).getByText("Dites bonjour à Mathieu")).toBeVisible();
    await expect(thread(page).getByText("Cette conversation n'est visible que par vous deux.")).toBeVisible();

    // Prêt à écrire dès l'ouverture.
    const field = composer(page, "Mathieu Gagnon");
    await expect(field).toBeFocused();
    await field.fill("Salut Mathieu, as-tu deux minutes ?");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(thread(page).getByText("Salut Mathieu, as-tu deux minutes ?")).toBeVisible();
    await expect(list(page).getByRole("link", { name: /Mathieu Gagnon/ })).toContainText("Vous : Salut Mathieu");

    // Choisir de nouveau Mathieu ramène à la même conversation, pas à une deuxième.
    await page.goto("/messages");
    await page.getByRole("button", { name: "Nouveau message" }).click();
    await page.getByRole("option", { name: /Mathieu Gagnon/ }).click();
    await expect(page).toHaveURL(address);
    await expect(list(page).getByRole("link", { name: /Mathieu Gagnon/ })).toHaveCount(1);

    // Passer d'une conversation à l'autre ne touche pas à la liste : la recherche reste.
    const search = page.getByRole("textbox", { name: "Rechercher une conversation" });
    await search.fill("tremb");
    await list(page).getByRole("link", { name: /Léa Tremblay/ }).click();
    await expect(composer(page, "Léa Tremblay")).toBeVisible();
    await expect(search).toHaveValue("tremb");
    await expect(list(page).getByRole("link")).toHaveCount(1);
    await search.fill("");

    // Mathieu, dans un autre onglet : un non-lu sur la conversation avec Camille.
    await nextTabIs(page, MATHIEU);
    const mathieu = await context.newPage();
    await mathieu.goto("/messages");
    const fromCamille = list(mathieu).getByRole("link", { name: /Camille Roy/ });
    await expect(fromCamille.getByLabel("1 non lu")).toBeVisible();
    await expect(header(mathieu).getByText("1 non lu", { exact: true })).toBeVisible();

    // L'ouvrir la marque comme lue.
    await fromCamille.click();
    await expect(thread(mathieu).getByText("Salut Mathieu, as-tu deux minutes ?")).toBeVisible();
    await expect(fromCamille.getByLabel("1 non lu")).toHaveCount(0);

    // Sa réponse arrive chez Camille (qui lit autre chose) sans recharger : un non-lu, puis le message.
    const reply = composer(mathieu, "Camille Roy");
    await reply.fill("Oui, j'arrive.");
    await reply.press("Enter");
    const fromMathieu = list(page).getByRole("link", { name: /Mathieu Gagnon/ });
    await expect(fromMathieu.getByLabel("1 non lu")).toBeVisible();
    await expect(fromMathieu).toContainText("Oui, j'arrive.");
    await fromMathieu.click();
    await expect(thread(page).getByText("Oui, j'arrive.")).toBeVisible();
    await expect(fromMathieu.getByLabel("1 non lu")).toHaveCount(0);

    // Une troisième personne ne voit pas cette conversation, même avec son adresse.
    await nextTabIs(page, SOPHIE);
    const sophie = await context.newPage();
    await sophie.goto(address);
    await expect(sophie.getByRole("link", { name: "Retour aux messages" })).toBeVisible();
    await expect(sophie.getByText("Cette conversation n'existe pas")).toBeVisible();
    await expect(sophie.getByText("Salut Mathieu, as-tu deux minutes ?")).toHaveCount(0);
    await sophie.getByRole("link", { name: "Retour aux messages" }).click();
    await expect(list(sophie).getByRole("link", { name: /Général/ })).toBeVisible();
    await expect(list(sophie).getByRole("link", { name: /Camille Roy/ })).toHaveCount(0);
  });

  test("deux onglets restent synchronisés : un message, puis sa suppression", async ({ context, page }) => {
    await page.goto(`/messages/${GENERAL}`);
    const other = await context.newPage();
    await other.goto("/messages");
    await expect(composer(other, "Général")).toBeVisible();

    const field = composer(page, "Général");
    await field.fill("Visible dans l'autre onglet");
    await field.press("Enter");
    await expect(thread(other).getByText("Visible dans l'autre onglet")).toBeVisible();
    await expect(list(other).getByRole("link", { name: /Général/ })).toContainText("Vous : Visible dans l'autre onglet");

    // Par le menu du message (clic droit ; appui long sur un téléphone).
    await thread(page).getByText("Visible dans l'autre onglet").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Supprimer" }).click();
    await confirmDelete(page);
    await expect(thread(other).getByText("Visible dans l'autre onglet")).toHaveCount(0);
    await expect(thread(other).getByText("Message supprimé")).toBeVisible();
    await expect(list(other).getByRole("link", { name: /Général/ })).toContainText("Vous : Message supprimé");

    // La présence, envoyée à toute l'équipe, dit « dans les messages » : jamais dans quelle conversation.
    await other.evaluate(() => {
      const seen: string[] = [];
      (window as unknown as { presencePages: string[] }).presencePages = seen;
      new BroadcastChannel("tthq:demo:presence").addEventListener("message", (e) => {
        if (e.data?.type === "beat") seen.push(e.data.state.page);
      });
    });
    await list(page).getByRole("link", { name: /Léa Tremblay/ }).click();
    await expect(composer(page, "Léa Tremblay")).toBeVisible();
    const pages = () => other.evaluate(() => (window as unknown as { presencePages: string[] }).presencePages);
    await expect.poll(pages).toContain("/messages");
    expect((await pages()).filter((p) => p.startsWith("/messages/"))).toEqual([]);
  });

  test("un long fil s'ouvre sur ses derniers messages ; les précédents se chargent sans faire sauter la lecture", async ({ page }) => {
    await page.goto("/messages");
    // Le canal est lu (il reste le message de Léa) : plus rien ne s'écrit dans la base de démo.
    await expect(header(page).getByText("1 non lu", { exact: true })).toBeVisible();

    // 350 anciens messages dans le canal, comme s'il vivait depuis des mois.
    const seeded = await page.evaluate(
      ({ general, author }) => {
        const key = "tthq:demo:db:v1";
        const db = JSON.parse(localStorage.getItem(key)!);
        const before = db.chat_messages.filter((m: { conversation_id: string }) => m.conversation_id === general).length;
        const start = Date.now() - 400 * 86_400_000;
        for (let i = 0; i < 350; i++) {
          db.chat_messages.push({
            id: `e2e00000-0000-4000-8000-${String(i).padStart(12, "0")}`,
            conversation_id: general,
            author_id: author,
            body: `Ancien message ${i + 1}`,
            created_at: new Date(start + i * 3_600_000).toISOString(),
            deleted_at: null,
          });
        }
        localStorage.setItem(key, JSON.stringify(db));
        return before;
      },
      { general: GENERAL, author: MATHIEU },
    );
    await page.reload();

    // À l'ouverture : les 100 derniers seulement.
    await expect(thread(page).getByText("Je regarde ça tout de suite.")).toBeVisible();
    await expect(messages(page)).toHaveCount(100);
    await expect(thread(page).getByText("Ancien message 350", { exact: true })).toBeAttached();
    await expect(thread(page).getByText("Ancien message 1", { exact: true })).toHaveCount(0);

    // Une page de plus : le message qu'on lisait ne bouge pas à l'écran. (Position relevée et clic
    // dans la page, d'un seul geste : un clic piloté peut lui-même faire défiler le fil.)
    const more = page.getByRole("button", { name: "Voir les messages précédents" });
    await more.scrollIntoViewIfNeeded();
    const before = await thread(page).evaluate((log) => {
      const first = log.querySelector("[data-message-id]")!;
      const top = first.getBoundingClientRect().top;
      log.querySelector("button")!.click();
      return { id: first.getAttribute("data-message-id"), top };
    });
    await expect(messages(page)).toHaveCount(300);
    const after = await thread(page).evaluate(
      (log, id) => log.querySelector(`[data-message-id="${id}"]`)!.getBoundingClientRect().top,
      before.id,
    );
    expect(Math.abs(after - before.top)).toBeLessThanOrEqual(1);

    // Jusqu'au début du fil : le bouton disparaît.
    await more.click();
    await expect(messages(page)).toHaveCount(350 + seeded);
    await expect(thread(page).getByText("Ancien message 1", { exact: true })).toBeAttached();
    await expect(more).toHaveCount(0);
  });

  test("une démo enregistrée avant l'arrivée des messages reçoit le canal et ses conversations d'exemple", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Camille/ })).toBeVisible();
    await page.evaluate(() => {
      const key = "tthq:demo:db:v1";
      const db = JSON.parse(localStorage.getItem(key)!);
      for (const table of ["chat_conversations", "chat_participants", "chat_messages"]) delete db[table];
      localStorage.setItem(key, JSON.stringify(db));
    });
    await page.goto("/messages");
    await expect(thread(page).getByText("Je regarde ça tout de suite.")).toBeVisible();
    await expect(list(page).getByRole("link", { name: /Léa Tremblay/ })).toBeVisible();
    // Et le reste de la démo n'a pas bougé.
    await page.goto("/projets/application");
    await expect(page.getByLabel("Ajouter une tâche (À faire)")).toBeVisible();
  });

  test("quitter les messages et y revenir : le brouillon est resté, ce qui est arrivé entre-temps est repéré", async ({ context, page }) => {
    /** ⌘K, the way to move around that does not depend on the navigation's layout. */
    const goTo = async (name: string) => {
      await page.keyboard.press("Control+k");
      await page.getByRole("option", { name, exact: true }).click();
    };

    await page.goto(`/messages/${GENERAL}`);
    // Tout est lu dans le canal (il reste le message de Léa).
    await expect(header(page).getByText("1 non lu", { exact: true })).toBeVisible();
    const field = composer(page, "Général");
    await field.fill("Je réponds dans une minute");

    await goTo("Dashboard");
    await expect(page.getByRole("heading", { name: /Camille/ })).toBeVisible();

    // Pendant ce temps, Mathieu écrit dans le canal.
    await nextTabIs(page, MATHIEU);
    const mathieu = await context.newPage();
    await mathieu.goto("/messages");
    const his = composer(mathieu, "Général");
    await his.fill("Quelqu'un a vu le correctif ?");
    await his.press("Enter");
    await expect(thread(mathieu).getByText("Quelqu'un a vu le correctif ?")).toBeVisible();

    await goTo("Messages");
    await expect(page).toHaveURL(/\/messages$/);
    // Le repère « nouveaux messages » est juste au-dessus de ce qui est arrivé pendant l'absence.
    await expect(thread(page).locator("[data-unread-divider] + [data-message-id]")).toContainText("Quelqu'un a vu le correctif ?");
    await expect(thread(page).locator("[data-unread-divider]")).toHaveCount(1);
    await expect(field).toHaveValue("Je réponds dans une minute");
    // Et c'est lu, maintenant qu'on l'a sous les yeux.
    await expect(header(page).getByText("1 non lu", { exact: true })).toBeVisible();

    await field.press("Enter");
    await expect(field).toHaveValue("");
    await expect(thread(mathieu).getByText("Je réponds dans une minute")).toBeVisible();
  });
});

test.describe("Messages sur un téléphone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("une vue à la fois : la liste, puis la conversation ; non-lus et recherche", async ({ page }) => {
    await page.goto("/messages");

    // La liste seule. Ce qui n'est pas à l'écran n'est pas lu : les non-lus du canal restent.
    const general = list(page).getByRole("link", { name: /Général/ });
    const lea = list(page).getByRole("link", { name: /Léa Tremblay/ });
    await expect(general.getByLabel("2 non lus")).toBeVisible();
    await expect(lea.getByLabel("1 non lu")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^Message à/ })).toBeHidden();
    await page.waitForTimeout(1_000);
    await expect(general.getByLabel("2 non lus")).toBeVisible();

    // La recherche ignore les accents.
    const search = page.getByRole("textbox", { name: "Rechercher une conversation" });
    await search.fill("lea");
    await expect(lea).toBeVisible();
    await expect(general).toHaveCount(0);
    await search.fill("zzz");
    await expect(page.getByText("Aucune conversation ne correspond à « zzz ».")).toBeVisible();
    await search.fill("");

    // Ouvrir une conversation : le fil prend tout l'écran, à partir de ce qui est nouveau.
    await lea.click();
    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Léa Tremblay" })).toBeVisible();
    await expect(list(page)).toBeHidden();
    await expect(thread(page).getByText("Parfait, je prépare trois écrans pour le meeting.")).toBeVisible();
    await expect(thread(page).locator("[data-unread-divider]")).toBeVisible();
    // Sur un écran tactile, pas de corbeille à côté du message : elle est dans le menu (appui long).
    await expect(thread(page).getByRole("button", { name: "Supprimer ce message" }).first()).toBeHidden();

    // Le temps de lire, puis retour : ce fil est lu, le canal ne l'est toujours pas.
    await page.waitForTimeout(1_000);
    await page.getByRole("link", { name: "Retour aux conversations" }).click();
    await expect(page).toHaveURL(/\/messages$/);
    await expect(lea).toBeVisible();
    await expect(lea.getByLabel("1 non lu")).toHaveCount(0);
    await expect(general.getByLabel("2 non lus")).toBeVisible();
  });
});
