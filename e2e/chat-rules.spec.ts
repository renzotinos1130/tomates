/**
 * The chat's rules, tested without a browser (src/lib/chat.ts is plain logic):
 * what a load keeps in memory, how a thread is laid out, what counts as unread.
 * The screens themselves are covered by chat.spec.ts.
 */
import { expect, test } from "@playwright/test";
import {
  CHAT_RECENT,
  conversationViews,
  directPair,
  GENERAL_CHANNEL_ID,
  mergeLoadedMessages,
  olderMessages,
  presencePath,
  readPosition,
  recentPerConversation,
  threadItems,
} from "../src/lib/chat";
import type { ChatConversation, ChatMessage, ChatParticipant, ID, Member } from "../src/lib/types";

const ME = "11111111-1111-4111-8111-111111111111";
const LEA = "33333333-3333-4333-8333-333333333333";
const SOPHIE = "55555555-5555-4555-8555-555555555555";
const DM = "d0000000-0000-4000-8000-000000000001";

/** Local time, so "the same day" means the same thing wherever the tests run. */
const at = (day: number, hour: number, minute = 0) => new Date(2026, 4, day, hour, minute).toISOString();

let serial = 0;
const message = (conversation_id: ID, author_id: ID, created_at: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `m-${String(++serial).padStart(6, "0")}`,
  conversation_id,
  author_id,
  body: "…",
  created_at,
  deleted_at: null,
  ...extra,
});

/** `count` messages in a conversation, one per minute, oldest first. */
const run = (conversation: ID, count: number, startMinute = 0) =>
  Array.from({ length: count }, (_, i) => message(conversation, LEA, new Date(Date.UTC(2026, 0, 1, 0, startMinute + i)).toISOString()));

const byId = (list: ChatMessage[]) => Object.fromEntries(list.map((m) => [m.id, m]));

test.describe("Chat — ce qu'un chargement garde en mémoire", () => {
  test("les derniers messages de chaque conversation, pas ceux de la plus bavarde", () => {
    const busy = run(GENERAL_CHANNEL_ID, 150);
    const quiet = run(DM, 3);
    const kept = recentPerConversation([...busy, ...quiet]);
    expect(kept.filter((m) => m.conversation_id === DM)).toHaveLength(3);
    const general = kept.filter((m) => m.conversation_id === GENERAL_CHANNEL_ID);
    expect(general).toHaveLength(CHAT_RECENT);
    expect(general.map((m) => m.id)).toContain(busy[149].id);
    expect(general.map((m) => m.id)).not.toContain(busy[49].id);

    // Une page de plus : les plus récents parmi ceux d'avant, dans cette conversation seulement.
    const page = olderMessages([...busy, ...quiet], GENERAL_CHANNEL_ID, busy[50].created_at, 20);
    expect(page.map((m) => m.id)).toEqual(busy.slice(30, 50).reverse().map((m) => m.id));
  });

  test("premier chargement : un fil plein a peut-être une suite, un fil court est complet", () => {
    const fresh = recentPerConversation([...run(GENERAL_CHANNEL_ID, 150), ...run(DM, 3)]);
    const { messages, hasOlder } = mergeLoadedMessages(fresh, {}, {});
    expect(Object.keys(messages)).toHaveLength(CHAT_RECENT + 3);
    expect(hasOlder).toEqual({ [GENERAL_CHANNEL_ID]: true });
  });

  test("relecture (retour sur l'onglet) : les pages déjà lues restent tant qu'elles se raccordent", () => {
    const all = run(GENERAL_CHANNEL_ID, 260);
    // En mémoire : la fenêtre du premier chargement (160 à 259) et une page plus ancienne (60 à 159).
    const held = byId(all.slice(60));
    const arrived = run(GENERAL_CHANNEL_ID, 5, 1000);
    const fresh = recentPerConversation([...all, ...arrived]);

    const again = mergeLoadedMessages(fresh, held, { [GENERAL_CHANNEL_ID]: true });
    expect(Object.keys(again.messages)).toHaveLength(200 + 5);
    expect(again.messages[all[60].id]).toBeDefined();
    expect(again.hasOlder).toEqual({ [GENERAL_CHANNEL_ID]: true });

    // Le début du fil avait été atteint : il l'est toujours.
    const complete = mergeLoadedMessages(fresh, byId(all), { [GENERAL_CHANNEL_ID]: false });
    expect(Object.keys(complete.messages)).toHaveLength(260 + 5);
    expect(complete.hasOlder).toEqual({ [GENERAL_CHANNEL_ID]: false });

    // Un fil entièrement en mémoire qui a dépassé la fenêtre en direct reste complet.
    const grown = run(DM, 120);
    const live = mergeLoadedMessages(recentPerConversation(grown), byId(grown), {});
    expect(Object.keys(live.messages)).toHaveLength(120);
    expect(live.hasOlder).toEqual({ [DM]: false });
  });

  test("après une longue absence, pas de trou au milieu du fil : il repart de sa partie récente", () => {
    const old = run(GENERAL_CHANNEL_ID, 130);
    const missed = run(GENERAL_CHANNEL_ID, 140, 5000);
    const fresh = recentPerConversation([...old, ...missed]);
    const { messages, hasOlder } = mergeLoadedMessages(fresh, byId(old), { [GENERAL_CHANNEL_ID]: false });
    expect(Object.keys(messages)).toHaveLength(CHAT_RECENT);
    expect(messages[old[129].id]).toBeUndefined();
    expect(hasOlder).toEqual({ [GENERAL_CHANNEL_ID]: true });
  });
});

test("Chat — la présence dit « dans les messages », jamais dans quelle conversation", () => {
  expect(presencePath(`/messages/${DM}`)).toBe("/messages");
  expect(presencePath("/messages")).toBe("/messages");
  expect(presencePath("/meeting/2026-05-13")).toBe("/meeting/2026-05-13");
  expect(presencePath("/")).toBe("/");
});

test.describe("Chat — le fil et les non-lus", () => {
  const general: ChatConversation = {
    id: GENERAL_CHANNEL_ID,
    kind: "channel",
    name: "Général",
    member_a: null,
    member_b: null,
    created_by: null,
    created_at: at(1, 8),
  };
  const direct = (id: ID, a: ID, b: ID): ChatConversation => {
    const [member_a, member_b] = directPair(a, b);
    return { id, kind: "direct", name: null, member_a, member_b, created_by: a, created_at: at(1, 8) };
  };
  const member = (id: ID, full_name: string): Member => ({
    id,
    email: `${id.slice(0, 4)}@prospero.test`,
    full_name,
    color: "teal",
    avatar_url: null,
    role: "member",
    active: true,
    must_change_password: false,
    created_at: at(1, 8),
  });
  const members = { [ME]: member(ME, "Camille Roy"), [LEA]: member(LEA, "Léa Tremblay"), [SOPHIE]: member(SOPHIE, "Sophie Lavoie") };

  test("un séparateur par jour, les messages d'une même personne regroupés, un seul repère « nouveaux »", () => {
    const list = [
      message(GENERAL_CHANNEL_ID, LEA, at(11, 10, 0)),
      message(GENERAL_CHANNEL_ID, LEA, at(11, 10, 2)),
      message(GENERAL_CHANNEL_ID, ME, at(11, 10, 3)),
      message(GENERAL_CHANNEL_ID, LEA, at(11, 10, 30)),
      message(GENERAL_CHANNEL_ID, LEA, at(11, 10, 31)),
      message(GENERAL_CHANNEL_ID, LEA, at(12, 9, 0)),
    ];
    const items = threadItems(list, ME, at(11, 10, 10), new Date(2026, 4, 12, 12));
    expect(items.map((i) => i.type)).toEqual(["day", "message", "message", "message", "unread", "message", "message", "day", "message"]);

    const rows = items.filter((i) => i.type === "message");
    // Deux messages de Léa à deux minutes d'écart : un seul bloc.
    expect([rows[0].head, rows[0].tail, rows[1].head, rows[1].tail]).toEqual([true, false, false, true]);
    expect(rows[2].mine).toBe(true);
    // Le repère « nouveaux » coupe un bloc ; il n'apparaît qu'une fois.
    expect(rows[3].head).toBe(true);
    const days = items.filter((i) => i.type === "day");
    expect(days.map((d) => [d.label, d.fresh])).toEqual([
      ["Hier", false],
      ["Aujourd'hui", false],
    ]);
  });

  test("quand le nouveau commence avec la journée, le séparateur du jour le dit ; jamais au-dessus du premier message", () => {
    const list = [message(GENERAL_CHANNEL_ID, LEA, at(11, 16)), message(GENERAL_CHANNEL_ID, LEA, at(12, 9))];
    const now = new Date(2026, 4, 12, 12);
    expect(threadItems(list, ME, at(11, 17), now).map((i) => (i.type === "day" ? i.fresh : i.type))).toEqual([false, "message", true, "message"]);
    // Tout est nouveau : rien à séparer.
    expect(threadItems(list, ME, at(10, 8), now).some((i) => i.type === "unread" || (i.type === "day" && i.fresh))).toBe(false);
  });

  test("la liste : le canal d'abord, mes conversations seulement, les non-lus des autres auteurs", () => {
    const mine = direct(DM, ME, LEA);
    const empty = direct("d0000000-0000-4000-8000-000000000002", ME, SOPHIE);
    const theirs = direct("d0000000-0000-4000-8000-000000000003", LEA, SOPHIE);
    const list = [
      message(GENERAL_CHANNEL_ID, LEA, at(12, 9, 0)),
      message(GENERAL_CHANNEL_ID, SOPHIE, at(12, 9, 5), { deleted_at: at(12, 9, 6), body: "" }),
      message(GENERAL_CHANNEL_ID, ME, at(12, 9, 7)),
      message(DM, LEA, at(12, 11, 0)),
      message(DM, LEA, at(12, 11, 1)),
      message(theirs.id, LEA, at(12, 11, 30)),
    ];
    const participants: ChatParticipant[] = [
      { conversation_id: GENERAL_CHANNEL_ID, member_id: ME, last_read_at: at(12, 8) },
      { conversation_id: DM, member_id: ME, last_read_at: at(12, 11, 0) },
      // La position de lecture de quelqu'un d'autre ne compte pas pour moi.
      { conversation_id: DM, member_id: LEA, last_read_at: at(12, 12) },
    ];
    const input = { conversations: [theirs, empty, mine, general], messages: list, participants, members, meId: ME };

    const views = conversationViews(input);
    expect(views.map((v) => v.title)).toEqual(["Général", "Léa Tremblay"]);
    // Canal : le message de Léa. Ni le mien, ni celui qui a été supprimé.
    expect(views.map((v) => v.unread)).toEqual([1, 1]);

    // Une conversation vide n'apparaît que pendant qu'on l'ouvre.
    expect(conversationViews({ ...input, keepId: empty.id }).map((v) => v.title)).toEqual(["Général", "Léa Tremblay", "Sophie Lavoie"]);
  });

  test("jamais ouvert : ce qui s'est dit avant mon arrivée dans l'équipe est de l'histoire, pas du non-lu", () => {
    const list = [message(GENERAL_CHANNEL_ID, LEA, at(3, 9)), message(GENERAL_CHANNEL_ID, LEA, at(12, 9))];
    const newcomer = { ...members, [ME]: { ...members[ME], created_at: at(10, 8) } };
    const views = conversationViews({ conversations: [general], messages: list, participants: [], members: newcomer, meId: ME });
    expect(views.map((v) => v.unread)).toEqual([1]);
    expect(readPosition(undefined, newcomer[ME])).toBe(at(10, 8));
    expect(readPosition({ conversation_id: GENERAL_CHANNEL_ID, member_id: ME, last_read_at: at(12, 10) }, newcomer[ME])).toBe(at(12, 10));
  });
});
