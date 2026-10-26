import assert from "node:assert/strict";
import test from "node:test";
import { applyAction, availableDays, createDemo, sessionBalance, sessionTotal, type Action } from "../lib/demo";

const now = new Date("2026-10-23T08:00:00Z");
function booking(state = createDemo(now)): Action {
  return { type: "book", name: "Visitatore Demo", email: "visitor@example.com", phone: "", packageId: "portrait", extraIds: ["prints"], start: availableDays(state, "portrait", now)[0].slots[0].startsAt, notes: "" };
}
test("booking creates client, session and package snapshot, without recording payment", () => {
  const initial = createDemo(now);
  const action = booking(initial);
  const next = applyAction(initial, action, now);
  assert.equal(next.clients.length, initial.clients.length + 1);
  assert.equal(next.sessions.length, initial.sessions.length + 1);
  assert.equal(next.payments.length, initial.payments.length);
  assert.equal(sessionTotal(next.sessions.at(-1)!), 21500);
  assert.equal(initial.clients.length, 6);
  assert.throws(() => applyAction(next, action, now), /Orario non disponibile/);
});
test("all services share busy intervals; buffers and closed days are respected", () => {
  const state = createDemo(now);
  const action = booking(state);
  const next = applyAction(state, action, now);
  assert.throws(() => applyAction(next, { ...action, packageId: "family" } as Action, now), /Orario non disponibile/);
  const start = new Date((action as { start: string }).start).getTime();
  for (const day of availableDays(next, "portrait", now)) for (const slot of day.slots) {
    const slotStart = Date.parse(slot.startsAt);
    assert.ok(slotStart + 75 * 60_000 <= start || slotStart >= start + 75 * 60_000);
  }
  const closed = applyAction(state, { type: "settings", settings: { ...state.settings, closedDates: [availableDays(state, "portrait", now)[0].date] } }, now);
  assert.notEqual(availableDays(closed, "portrait", now)[0].date, availableDays(state, "portrait", now)[0].date);
  assert.equal(availableDays({ ...state, settings: { ...state.settings, enabled: false } }, "portrait", now).length, 0);
});
test("lead conversion reuses email and cannot run twice", () => {
  const state = createDemo(now);
  state.leads[0].email = state.clients[0].email.toUpperCase();
  const action: Action = { type: "session", clientId: "", leadId: state.leads[0].id, packageId: "family", extraIds: [], start: availableDays(state, "family", now)[0].slots[0].startsAt, notes: "" };
  const next = applyAction(state, action, now);
  assert.equal(next.clients.length, state.clients.length);
  assert.equal(next.leads[0].status, "converted");
  assert.equal(next.sessions.at(-1)!.clientId, state.clients[0].id);
  assert.throws(() => applyAction(next, { ...action, start: availableDays(next, "family", now)[0].slots[0].startsAt }, now), /Lead non convertibile/);
});
test("payments use cents, prevent overpayment and can be reversed", () => {
  const state = applyAction(createDemo(now), booking(), now);
  const session = state.sessions.at(-1)!;
  const action: Action = { type: "payment", sessionId: session.id, amount: 5000, date: "2026-10-23", method: "Bonifico" };
  const next = applyAction(state, action, now);
  assert.equal(sessionBalance(next, session), 16500);
  for (const amount of [-1, 0, 0.5, 16501, NaN]) assert.throws(() => applyAction(next, { ...action, amount }, now), /importo/);
  assert.throws(() => applyAction(next, { type: "status", sessionId: session.id, status: "cancelled" }, now), /Storna/);
  const reversed = applyAction(next, { type: "delete-payment", id: next.payments.at(-1)!.id }, now);
  assert.equal(sessionBalance(reversed, session), 21500);
  const cancelled = applyAction(reversed, { type: "status", sessionId: session.id, status: "cancelled" }, now);
  assert.ok(availableDays(cancelled, "portrait", now).some((day) => day.slots.some((slot) => slot.startsAt === session.start)));
});
test("catalog changes do not change existing sessions", () => {
  const state = createDemo(now);
  const next = applyAction(state, { type: "package", package: { ...state.packages[0], price: 99900, minutes: 45 } }, now);
  assert.deepEqual(next.sessions, state.sessions);
  assert.equal(next.packages[0].price, 99900);
});
test("invalid input leaves state untouched and seed dates are relative", () => {
  const state = createDemo(now);
  const before = structuredClone(state);
  assert.throws(() => applyAction(state, { ...booking(state), email: "invalid" } as Action, now), /email/);
  assert.deepEqual(state, before);
  assert.throws(() => applyAction(state, { type: "settings", settings: { ...state.settings, buffer: -60 } }, now), /Intervalli/);
  assert.throws(() => applyAction(state, { type: "settings", settings: { ...state.settings, open: "18:00", close: "09:00" } }, now), /chiusura/);
  const later = createDemo(new Date("2027-02-10T08:00:00Z"));
  assert.ok(later.sessions.every((session) => session.start.startsWith("2027-")));
  assert.ok(availableDays(later, "portrait", new Date("2027-02-10T08:00:00Z")).length > 0);
});