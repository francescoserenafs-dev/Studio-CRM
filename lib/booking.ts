import { addDaysToDateKey, isWeekendDateKey, localWeekday, parseLocalDateTime, toLocalDateKey } from "@/lib/datetime";

export const BOOKING_FORM_FIELD_KEYS = ["firstName", "lastName", "email", "phone", "birthDate", "participantsCount", "notes"] as const;
export type BookingFormFieldKey = (typeof BOOKING_FORM_FIELD_KEYS)[number];
export type BookingFormFieldConfig = Record<BookingFormFieldKey, { enabled: boolean; required: boolean }>;

export const DEFAULT_BOOKING_FORM_FIELDS: BookingFormFieldConfig = {
  firstName: { enabled: true, required: true },
  lastName: { enabled: true, required: true },
  email: { enabled: true, required: true },
  phone: { enabled: false, required: false },
  birthDate: { enabled: false, required: false },
  participantsCount: { enabled: false, required: false },
  notes: { enabled: false, required: false },
};

export const BOOKING_FIELD_LABELS: Record<BookingFormFieldKey, string> = {
  firstName: "Nome",
  lastName: "Cognome",
  email: "Email",
  phone: "Cellulare",
  birthDate: "Data di nascita",
  participantsCount: "Numero di persone che partecipano alla sessione",
  notes: "Note",
};

export const LOCKED_FORM_FIELD_KEYS: BookingFormFieldKey[] = ["firstName", "lastName", "email"];
export const MAX_CUSTOM_FIELD_LABEL = 80;
export const MAX_CUSTOM_FIELDS = 12;

// Campo del form pubblico: predefinito (key nota) oppure custom (testo lungo, key "custom_...").
export type BookingFormFieldItem = {
  key: string;
  custom: boolean;
  label: string;
  enabled: boolean;
  required: boolean;
};

function isPredefinedKey(key: string): key is BookingFormFieldKey {
  return (BOOKING_FORM_FIELD_KEYS as readonly string[]).includes(key);
}

// Normalizza la config (nuova forma array oppure vecchio oggetto) in una lista ordinata,
// garantendo la presenza di tutti i campi predefiniti e i vincoli sui campi bloccati.
export function normalizeFormFields(value: unknown): BookingFormFieldItem[] {
  const items: BookingFormFieldItem[] = [];
  const seen = new Set<string>();
  let customCounter = 0;

  const pushPredefined = (key: BookingFormFieldKey, enabled: boolean, required: boolean) => {
    if (seen.has(key)) return;
    const locked = LOCKED_FORM_FIELD_KEYS.includes(key);
    const isEnabled = locked || enabled;
    items.push({ key, custom: false, label: BOOKING_FIELD_LABELS[key], enabled: isEnabled, required: locked || (isEnabled && required) });
    seen.add(key);
  };

  if (Array.isArray(value)) {
    for (const raw of value) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Record<string, unknown>;
      const key = typeof entry.key === "string" ? entry.key : "";
      const enabled = entry.enabled === true;
      const required = entry.required === true;
      if (isPredefinedKey(key)) {
        pushPredefined(key, enabled, required);
      } else if (entry.custom === true || key.startsWith("custom_")) {
        const label = typeof entry.label === "string" ? entry.label.trim().slice(0, MAX_CUSTOM_FIELD_LABEL) : "";
        if (!label) continue;
        customCounter += 1;
        const stableKey = key.startsWith("custom_") && !seen.has(key) ? key : `custom_${customCounter}`;
        if (seen.has(stableKey)) continue;
        items.push({ key: stableKey, custom: true, label, enabled, required: enabled && required });
        seen.add(stableKey);
      }
    }
  } else if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of BOOKING_FORM_FIELD_KEYS) {
      const item = obj[key] && typeof obj[key] === "object" ? (obj[key] as Record<string, unknown>) : {};
      pushPredefined(key, item.enabled === true, item.required === true);
    }
  }

  for (const key of BOOKING_FORM_FIELD_KEYS) {
    if (!seen.has(key)) {
      const def = DEFAULT_BOOKING_FORM_FIELDS[key];
      pushPredefined(key, def.enabled, def.required);
    }
  }

  return items;
}

export const DEFAULT_BOOKING_FORM_FIELD_ITEMS: BookingFormFieldItem[] = normalizeFormFields(DEFAULT_BOOKING_FORM_FIELDS);

export type BookingEventType = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  service_type_id: string;
  duration_minutes: number;
  buffer_minutes: number;
  location: string | null;
  weekday_price_cents: number;
  weekend_price_cents: number;
  show_price: boolean;
  window_start_date: string;
  window_end_date: string;
  visibility_start_date: string;
  visibility_end_date: string;
  min_notice_hours: number;
  max_bookings_per_day: number | null;
  max_bookings_total: number | null;
  ask_image_consent: boolean;
  addons_digital_mode: AddonSelectionMode;
  addons_print_mode: AddonSelectionMode;
  deposit_cents: number;
  form_fields: BookingFormFieldItem[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const ADDON_CATEGORIES = ["digital", "print"] as const;
export type AddonCategory = (typeof ADDON_CATEGORIES)[number];
export type AddonSelectionMode = "single" | "multiple";

export type BookingAddon = {
  id: string;
  event_type_id: string;
  category: AddonCategory;
  name: string;
  tooltip: string | null;
  price_cents: number;
  max_quantity: number | null;
  is_active: boolean;
  sort_order: number;
};

export type BookingAvailabilityRule = {
  id: string;
  event_type_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

export type BookingAvailabilityException = {
  id: string;
  event_type_id: string;
  exception_date: string;
  is_closed: boolean;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
};

export type BusyInterval = { start: Date; end: Date };

export type BookingSlot = { startsAt: string; endsAt: string };

export type BookingDay = { date: string; slots: BookingSlot[] };

export const WEEKDAY_LABELS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

export function priceForDate(eventType: BookingEventType, dateKey: string): number {
  return isWeekendDateKey(dateKey) ? eventType.weekend_price_cents : eventType.weekday_price_cents;
}

export function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function maxDateKey(a: string, b: string): string {
  return a > b ? a : b;
}

function minDateKey(a: string, b: string): string {
  return a < b ? a : b;
}

function conflictsWithBusy(slotStart: Date, slotEnd: Date, bufferMinutes: number, busy: BusyInterval[]): boolean {
  const bufferMs = bufferMinutes * 60_000;
  const guardedStart = slotStart.getTime() - bufferMs;
  const guardedEnd = slotEnd.getTime() + bufferMs;
  return busy.some((interval) => interval.start.getTime() < guardedEnd && interval.end.getTime() > guardedStart);
}

function windowsForDate(dateKey: string, rules: BookingAvailabilityRule[], exceptions: BookingAvailabilityException[]): Array<{ start: string; end: string }> {
  const dayExceptions = exceptions.filter((item) => item.exception_date === dateKey);
  if (dayExceptions.some((item) => item.is_closed)) return [];
  if (dayExceptions.length > 0) {
    return dayExceptions.map((item) => ({ start: normalizeTime(item.start_time ?? "00:00"), end: normalizeTime(item.end_time ?? "00:00") }));
  }
  const weekday = localWeekday(dateKey);
  return rules
    .filter((rule) => rule.weekday === weekday)
    .map((rule) => ({ start: normalizeTime(rule.start_time), end: normalizeTime(rule.end_time) }));
}

export type ComputeSlotsInput = {
  eventType: BookingEventType;
  rules: BookingAvailabilityRule[];
  exceptions: BookingAvailabilityException[];
  /** Sessioni gia' a calendario che occupano il tempo. */
  busy: BusyInterval[];
  /** Numero di prenotazioni gia' esistenti per questo evento, per data (chiave "YYYY-MM-DD"). */
  bookingsPerDay: Record<string, number>;
  /** Orari di inizio delle prenotazioni gia' esistenti per questo evento, per data. */
  bookedStartsByDay: Record<string, string[]>;
  totalBookings: number;
  rangeStart: string;
  rangeEnd: string;
  now?: Date;
};

export function computeAvailableDays({
  eventType,
  rules,
  exceptions,
  busy,
  bookingsPerDay,
  bookedStartsByDay,
  totalBookings,
  rangeStart,
  rangeEnd,
  now = new Date(),
}: ComputeSlotsInput): BookingDay[] {
  if (eventType.max_bookings_total !== null && totalBookings >= eventType.max_bookings_total) return [];

  const earliestStart = new Date(now.getTime() + eventType.min_notice_hours * 3_600_000);
  const from = maxDateKey(maxDateKey(eventType.window_start_date, rangeStart), toLocalDateKey(earliestStart));
  const to = minDateKey(eventType.window_end_date, rangeEnd);

  const step = eventType.duration_minutes + eventType.buffer_minutes;
  const days: BookingDay[] = [];

  for (let dateKey = from; dateKey <= to; dateKey = addDaysToDateKey(dateKey, 1)) {
    if (eventType.max_bookings_per_day !== null && (bookingsPerDay[dateKey] ?? 0) >= eventType.max_bookings_per_day) continue;

    const slots: BookingSlot[] = [];
    for (const window of windowsForDate(dateKey, rules, exceptions)) {
      const windowStart = parseLocalDateTime(`${dateKey}T${window.start}`);
      const windowEnd = parseLocalDateTime(`${dateKey}T${window.end}`);

      for (let cursor = windowStart.getTime(); ; cursor += step * 60_000) {
        const slotStart = new Date(cursor);
        const slotEnd = new Date(cursor + eventType.duration_minutes * 60_000);
        if (slotEnd.getTime() > windowEnd.getTime()) break;
        if (slotStart.getTime() < earliestStart.getTime()) continue;
        if (conflictsWithBusy(slotStart, slotEnd, eventType.buffer_minutes, busy)) continue;
        slots.push({ startsAt: slotStart.toISOString(), endsAt: slotEnd.toISOString() });
      }
    }

    if (slots.length > 0) {
      slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

      if (eventType.max_bookings_per_day !== null && (bookedStartsByDay[dateKey]?.length ?? 0) > 0) {
        const stepMs = step * 60_000;
        const bookedStarts = (bookedStartsByDay[dateKey] ?? []).map((startsAt) => new Date(startsAt).getTime());
        slots.splice(0, slots.length, ...slots.filter((slot) => {
          const starts = [...bookedStarts, new Date(slot.startsAt).getTime()].sort((a, b) => a - b);
          if (starts.length > eventType.max_bookings_per_day!) return false;
          return starts.every((start, index) => index === 0 || start - starts[index - 1] === stepMs);
        }));
      }

      if (slots.length === 0) continue;
      days.push({ date: dateKey, slots });
    }
  }

  return days;
}
