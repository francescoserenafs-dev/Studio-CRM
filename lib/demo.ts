import { computeAvailableDays, DEFAULT_BOOKING_FORM_FIELD_ITEMS, type BookingEventType } from "./booking";
import { addDaysToDateKey, parseLocalDateTime, toLocalDateKey } from "./datetime";

export type Client = { id: string; name: string; email: string; phone: string; notes: string };
export type Package = { id: string; name: string; service: string; price: number; photos: number; minutes: number };
export type Extra = { id: string; name: string; price: number };
export type Session = { id: string; clientId: string; package: Package; extras: Extra[]; start: string; status: "scheduled" | "completed" | "cancelled"; source: "booking" | "crm" | "lead"; notes: string };
export type Lead = { id: string; name: string; email: string; service: string; notes: string; status: "new" | "contacted" | "converted" | "lost"; sessionId?: string };
export type Payment = { id: string; sessionId: string; amount: number; date: string; method: "Bonifico" | "Contanti" | "Carta (registrazione)" };
export type Settings = { enabled: boolean; weekdays: number[]; open: string; close: string; buffer: number; notice: number; horizon: number; closedDates: string[] };
export type DemoState = { version: 1; createdAt: string; clients: Client[]; packages: Package[]; extras: Extra[]; sessions: Session[]; leads: Lead[]; payments: Payment[]; settings: Settings };
export type Action =
  | { type: "client"; client: Client }
  | { type: "lead"; lead: Lead }
  | { type: "package"; package: Package }
  | { type: "settings"; settings: Settings }
  | { type: "session"; clientId: string; packageId: string; extraIds: string[]; start: string; notes: string; leadId?: string }
  | { type: "book"; name: string; email: string; phone: string; packageId: string; extraIds: string[]; start: string; notes: string }
  | { type: "status"; sessionId: string; status: Session["status"] }
  | { type: "payment"; sessionId: string; amount: number; date: string; method: Payment["method"] }
  | { type: "delete-payment"; id: string };

export const money = (cents: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
export const sessionTotal = (session: Session) => session.package.price + session.extras.reduce((sum, extra) => sum + extra.price, 0);
export const sessionPaid = (state: DemoState, id: string) => state.payments.filter((payment) => payment.sessionId === id).reduce((sum, payment) => sum + payment.amount, 0);
export const sessionBalance = (state: DemoState, session: Session) => sessionTotal(session) - sessionPaid(state, session.id);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validMoney = (amount: number) => Number.isSafeInteger(amount) && amount >= 0 && amount <= 10_000_000;
function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

export function createDemo(now = new Date()): DemoState {
  const today = toLocalDateKey(now);
  const at = (offset: number, time = "10:00") => parseLocalDateTime(`${addDaysToDateKey(today, offset)}T${time}`).toISOString();
  const packages: Package[] = [
    { id: "portrait", name: "Ritratto essenziale", service: "Ritratto", price: 18000, photos: 8, minutes: 60 },
    { id: "family", name: "Storie di famiglia", service: "Famiglia", price: 28000, photos: 15, minutes: 90 },
    { id: "brand", name: "Personal branding", service: "Branding", price: 42000, photos: 24, minutes: 120 },
  ];
  const extras = [{ id: "prints", name: "Set 5 stampe", price: 3500 }, { id: "gallery", name: "10 fotografie aggiuntive", price: 7000 }];
  const names = ["Marta Esempio", "Luca Modello", "Elena Prova", "Andrea Campione", "Sara Esempio", "Nico Modello"];
  const clients = names.map((name, index) => ({ id: `client-${index}`, name, email: `cliente${index + 1}@example.com`, phone: "", notes: "Profilo sintetico per la demo." }));
  const sessions: Session[] = [-24, -16, -8, -3, 2, 5, 9, 12].map((offset, index) => ({ id: `session-${index}`, clientId: clients[index % clients.length].id, package: { ...packages[index % packages.length] }, extras: index % 2 ? [{ ...extras[0] }] : [], start: at(offset), status: offset < 0 ? "completed" : "scheduled", source: "crm", notes: "" }));
  const payments: Payment[] = sessions.slice(0, 6).map((session, index) => ({ id: `payment-${index}`, sessionId: session.id, amount: index < 4 ? sessionTotal(session) : 8000, date: addDaysToDateKey(today, index < 4 ? [-24, -16, -8, -3][index] : -1), method: "Bonifico" }));
  return { version: 1, createdAt: now.toISOString(), clients, packages, extras, sessions, payments,
    leads: [
      { id: "lead-1", name: "Giulia Demo", email: "giulia@example.com", service: "Famiglia", notes: "Vorrebbe una sessione nel fine settimana.", status: "new" },
      { id: "lead-2", name: "Paolo Campione", email: "paolo@example.com", service: "Branding", notes: "Preventivo inviato, in attesa di riscontro.", status: "contacted" },
      { id: "lead-3", name: "Ada Prova", email: "ada@example.com", service: "Ritratto", notes: "Richiesta per il prossimo mese.", status: "new" },
    ], settings: { enabled: true, weekdays: [1, 2, 3, 4, 5, 6], open: "09:00", close: "18:00", buffer: 15, notice: 12, horizon: 45, closedDates: [] } };
}

export function availableDays(state: DemoState, packageId: string, now = new Date()) {
  const selected = state.packages.find((item) => item.id === packageId);
  if (!selected || !state.settings.enabled) return [];
  const today = toLocalDateKey(now);
  const end = addDaysToDateKey(today, state.settings.horizon);
  const eventType: BookingEventType = {
    id: selected.id, slug: selected.id, name: selected.name, description: null, service_type_id: selected.service,
    duration_minutes: selected.minutes, buffer_minutes: state.settings.buffer, location: "Studio fotografico demo",
    weekday_price_cents: selected.price, weekend_price_cents: selected.price, show_price: true,
    window_start_date: today, window_end_date: end, visibility_start_date: today, visibility_end_date: end,
    min_notice_hours: state.settings.notice, max_bookings_per_day: null, max_bookings_total: null,
    ask_image_consent: false, addons_digital_mode: "multiple", addons_print_mode: "multiple", deposit_cents: 0,
    form_fields: DEFAULT_BOOKING_FORM_FIELD_ITEMS, is_active: true, created_at: state.createdAt, updated_at: state.createdAt,
  };
  return computeAvailableDays({ eventType,
    rules: state.settings.weekdays.map((weekday) => ({ id: String(weekday), event_type_id: selected.id, weekday, start_time: state.settings.open, end_time: state.settings.close })),
    exceptions: state.settings.closedDates.map((date) => ({ id: date, event_type_id: selected.id, exception_date: date, is_closed: true, start_time: null, end_time: null, note: null })),
    busy: state.sessions.filter((session) => session.status !== "cancelled").map((session) => ({ start: new Date(session.start), end: new Date(new Date(session.start).getTime() + session.package.minutes * 60_000) })),
    bookingsPerDay: {}, bookedStartsByDay: {}, totalBookings: 0, rangeStart: today, rangeEnd: end, now,
  });
}

export function applyAction(current: DemoState, action: Action, now = new Date()): DemoState {
  const state = structuredClone(current);
  const id = () => crypto.randomUUID();
  const upsert = <T extends { id: string }>(items: T[], value: T) => {
    const index = items.findIndex((item) => item.id === value.id);
    if (index === -1) items.push(value); else items[index] = value;
  };
  const contact = (name: string, email: string) => {
    requireValue(name.trim().length >= 2 && name.length <= 100, "Inserisci un nome valido (2-100 caratteri).");
    requireValue(emailPattern.test(email.trim()) && email.length <= 200, "Inserisci un indirizzo email valido.");
  };
  switch (action.type) {
    case "client": {
      contact(action.client.name, action.client.email);
      requireValue(!state.clients.some((item) => item.id !== action.client.id && item.email.toLowerCase() === action.client.email.trim().toLowerCase()), "Esiste gia un cliente con questa email.");
      upsert(state.clients, { ...action.client, name: action.client.name.trim(), email: action.client.email.trim().toLowerCase() });
      break;
    }
    case "lead": {
      contact(action.lead.name, action.lead.email);
      const previous = state.leads.find((item) => item.id === action.lead.id);
      requireValue(action.lead.status !== "converted" && previous?.status !== "converted", "La conversione richiede una sessione e non puo essere annullata.");
      upsert(state.leads, { ...action.lead, name: action.lead.name.trim(), email: action.lead.email.trim().toLowerCase() });
      break;
    }
    case "package": {
      const item = action.package;
      requireValue(item.name.trim() && item.service.trim(), "Nome e servizio sono obbligatori.");
      requireValue(validMoney(item.price) && Number.isInteger(item.photos) && item.photos >= 1 && item.photos <= 1000 && Number.isInteger(item.minutes) && item.minutes >= 15 && item.minutes <= 480, "Prezzo, fotografie o durata non validi.");
      upsert(state.packages, item);
      break;
    }
    case "settings": {
      const settings = action.settings;
      const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
      requireValue(timePattern.test(settings.open) && timePattern.test(settings.close) && settings.open < settings.close, "La chiusura deve essere successiva all'apertura.");
      requireValue(settings.weekdays.length > 0 && settings.weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6), "Seleziona almeno un giorno.");
      requireValue(Number.isInteger(settings.buffer) && settings.buffer >= 0 && settings.buffer <= 120 && Number.isInteger(settings.notice) && settings.notice >= 0 && settings.notice <= 168 && Number.isInteger(settings.horizon) && settings.horizon >= 1 && settings.horizon <= 90, "Intervalli di prenotazione non validi.");
      requireValue(settings.closedDates.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date), "Data di chiusura non valida.");
      state.settings = settings;
      break;
    }
    case "book":
    case "session": {
      const selected = state.packages.find((item) => item.id === action.packageId);
      requireValue(selected, "Pacchetto non trovato.");
      requireValue(availableDays(state, selected.id, now).some((day) => day.slots.some((slot) => slot.startsAt === action.start)), "Orario non disponibile: sovrapposizione o disponibilita modificata. Seleziona un altro slot.");
      requireValue(new Set(action.extraIds).size === action.extraIds.length && action.extraIds.every((extraId) => state.extras.some((extra) => extra.id === extraId)), "Extra non validi.");
      let clientId: string;
      let lead: Lead | undefined;
      if (action.type === "book" || action.leadId) {
        if (action.type === "session") {
          lead = state.leads.find((item) => item.id === action.leadId);
          requireValue(lead && lead.status !== "converted" && lead.status !== "lost", "Lead non convertibile.");
        }
        const person = action.type === "book" ? action : lead!;
        contact(person.name, person.email);
        const email = person.email.trim().toLowerCase();
        let client = state.clients.find((item) => item.email.toLowerCase() === email);
        if (!client) {
          client = { id: id(), name: person.name.trim(), email, phone: action.type === "book" ? action.phone : "", notes: "" };
          state.clients.push(client);
        }
        clientId = client.id;
      } else {
        requireValue(state.clients.some((client) => client.id === action.clientId), "Seleziona un cliente.");
        clientId = action.clientId;
      }
      const session: Session = { id: id(), clientId, package: { ...selected }, extras: state.extras.filter((extra) => action.extraIds.includes(extra.id)).map((extra) => ({ ...extra })), start: action.start, status: "scheduled", source: action.type === "book" ? "booking" : lead ? "lead" : "crm", notes: action.notes };
      state.sessions.push(session);
      if (lead) { lead.status = "converted"; lead.sessionId = session.id; }
      break;
    }
    case "status": {
      const session = state.sessions.find((item) => item.id === action.sessionId);
      requireValue(session && session.status !== "cancelled", "Sessione non modificabile.");
      requireValue(action.status !== "cancelled" || sessionPaid(state, session.id) === 0, "Storna prima le registrazioni di pagamento.");
      requireValue(action.status !== "completed" || new Date(session.start) <= now, "Una sessione futura non puo essere completata.");
      session.status = action.status;
      break;
    }
    case "payment": {
      const session = state.sessions.find((item) => item.id === action.sessionId);
      requireValue(session && session.status !== "cancelled", "Sessione non trovata o annullata.");
      requireValue(validMoney(action.amount) && action.amount > 0 && action.amount <= sessionBalance(state, session), "L'importo deve essere positivo e non superare il saldo.");
      requireValue(/^\d{4}-\d{2}-\d{2}$/.test(action.date) && !Number.isNaN(Date.parse(action.date)) && new Date(action.date).toISOString().slice(0, 10) === action.date && action.date <= toLocalDateKey(now), "Inserisci una data valida, non futura.");
      requireValue(["Bonifico", "Contanti", "Carta (registrazione)"].includes(action.method), "Metodo non valido.");
      state.payments.push({ id: id(), sessionId: session.id, amount: action.amount, date: action.date, method: action.method });
      break;
    }
    case "delete-payment": {
      requireValue(state.payments.some((payment) => payment.id === action.id), "Registrazione non trovata.");
      state.payments = state.payments.filter((payment) => payment.id !== action.id);
      break;
    }
  }
  return state;
}