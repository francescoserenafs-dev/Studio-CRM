"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { CalendarCheck, Check, Save, X } from "lucide-react";
import { availableDays, money, sessionBalance, type Action, type Client, type Lead, type Package, type Payment, type Session } from "@/lib/demo";
import { toLocalDateKey, toLocalTimeLabel } from "@/lib/datetime";
import { useDemo } from "./demo-provider";

export const dateLabel = (value: string) => new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Rome" }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
export const dateTimeLabel = (value: string) => `${dateLabel(value)}, ${toLocalTimeLabel(new Date(value))}`;
const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const cents = (data: FormData, key: string) => Math.round(Number(data.get(key)) * 100);

export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const reference = useRef<HTMLDialogElement>(null);
  useEffect(() => { reference.current?.showModal(); }, []);
  return <dialog ref={reference} onClose={close} aria-label={title}><div className="dialog-heading"><h2>{title}</h2><button type="button" className="icon-button" title="Chiudi" aria-label="Chiudi" onClick={close}><X size={20} /></button></div>{children}</dialog>;
}

export function ActionForm({ children, action, done, label = "Salva", disabled = false }: { children: ReactNode; action: (data: FormData) => Action; done?: () => void; label?: string; disabled?: boolean }) {
  const { run, busy } = useDemo();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setSaved(false);
    try { await run(action(new FormData(event.currentTarget))); setSaved(true); done?.(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Operazione non riuscita."); }
  }
  return <form onSubmit={submit} className="form-stack">{children}{error && <p className="error" role="alert">{error}</p>}{saved && <p className="success" role="status">Salvato nell&apos;archivio locale.</p>}<div className="form-footer"><button className="primary" disabled={busy || disabled} type="submit"><Save size={16} />{busy ? "Salvataggio..." : label}</button></div></form>;
}

export function ClientForm({ client, done }: { client?: Client; done?: () => void }) {
  return <ActionForm done={done} action={(data) => ({ type: "client", client: { id: client?.id ?? crypto.randomUUID(), name: text(data, "name"), email: text(data, "email"), phone: text(data, "phone"), notes: text(data, "notes") } })}>
    <div className="form-grid"><label>Nome completo<input name="name" required maxLength={100} defaultValue={client?.name} /></label><label>Email<input name="email" type="email" required maxLength={200} defaultValue={client?.email} /></label><label>Telefono<input name="phone" type="tel" maxLength={40} defaultValue={client?.phone} /></label></div><label>Note<textarea name="notes" rows={3} maxLength={2000} defaultValue={client?.notes} /></label>
  </ActionForm>;
}

export function LeadForm({ lead, done }: { lead?: Lead; done?: () => void }) {
  const { state } = useDemo();
  return <ActionForm done={done} action={(data) => ({ type: "lead", lead: { id: lead?.id ?? crypto.randomUUID(), name: text(data, "name"), email: text(data, "email"), service: text(data, "service"), notes: text(data, "notes"), status: text(data, "status") as Lead["status"] } })}>
    <div className="form-grid"><label>Nome completo<input name="name" required maxLength={100} defaultValue={lead?.name} /></label><label>Email<input name="email" type="email" required defaultValue={lead?.email} /></label><label>Servizio<select name="service" defaultValue={lead?.service}>{Array.from(new Set(state.packages.map((item) => item.service))).map((service) => <option key={service}>{service}</option>)}</select></label><label>Stato<select name="status" defaultValue={lead?.status ?? "new"}><option value="new">Nuovo</option><option value="contacted">Contattato</option><option value="lost">Perso</option></select></label></div><label>Note<textarea name="notes" rows={3} maxLength={2000} defaultValue={lead?.notes} /></label>
  </ActionForm>;
}

export function PackageForm({ item, done }: { item?: Package; done: () => void }) {
  return <ActionForm done={done} action={(data) => ({ type: "package", package: { id: item?.id ?? crypto.randomUUID(), name: text(data, "name"), service: text(data, "service"), price: cents(data, "price"), photos: Number(data.get("photos")), minutes: Number(data.get("minutes")) } })}>
    <div className="form-grid"><label>Nome pacchetto<input name="name" required maxLength={100} defaultValue={item?.name} /></label><label>Servizio<input name="service" required maxLength={80} defaultValue={item?.service} /></label><label>Prezzo (EUR)<input name="price" type="number" min="0" max="100000" step="0.01" required defaultValue={(item?.price ?? 18000) / 100} /></label><label>Fotografie incluse<input name="photos" type="number" min="1" max="1000" required defaultValue={item?.photos ?? 8} /></label><label>Durata (minuti)<input name="minutes" type="number" min="15" max="480" required defaultValue={item?.minutes ?? 60} /></label></div>
  </ActionForm>;
}

export function PaymentForm({ session, done }: { session: Session; done: () => void }) {
  const { state } = useDemo();
  const balance = sessionBalance(state, session);
  return <ActionForm done={done} label="Registra pagamento" action={(data) => ({ type: "payment", sessionId: session.id, amount: cents(data, "amount"), date: text(data, "date"), method: text(data, "method") as Payment["method"] })}>
    <p className="notice">Solo registrazione demo. Nessun addebito reale.</p><div className="form-grid"><label>Importo (EUR)<input name="amount" type="number" step="0.01" min="0.01" max={balance / 100} defaultValue={balance / 100} required /></label><label>Data pagamento<input name="date" type="date" max={toLocalDateKey(new Date())} defaultValue={toLocalDateKey(new Date())} required /></label><label>Metodo<select name="method"><option>Bonifico</option><option>Contanti</option><option>Carta (registrazione)</option></select></label></div>
  </ActionForm>;
}

export function SessionComposer({ publicBooking = false, clientId, lead, done }: { publicBooking?: boolean; clientId?: string; lead?: Lead; done?: () => void }) {
  const { state, run, busy } = useDemo();
  const services = Array.from(new Set(state.packages.map((item) => item.service)));
  const [service, setService] = useState(lead?.service && services.includes(lead.service) ? lead.service : services[0]);
  const matching = state.packages.filter((item) => item.service === service);
  const [packageId, setPackageId] = useState(matching[0]?.id ?? "");
  const selected = state.packages.find((item) => item.id === packageId);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<Session | null>(null);
  const days = availableDays(state, packageId);
  const activeDay = days.find((day) => day.date === date) ?? days[0];
  const total = (selected?.price ?? 0) + state.extras.filter((extra) => extraIds.includes(extra.id)).reduce((sum, extra) => sum + extra.price, 0);
  const slotValid = days.some((day) => day.slots.some((slot) => slot.startsAt === start));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const data = new FormData(event.currentTarget);
    const common = { packageId, extraIds, start, notes: text(data, "notes") };
    try {
      const next = await run(publicBooking
        ? { type: "book", ...common, name: text(data, "name"), email: text(data, "email"), phone: text(data, "phone") }
        : { type: "session", ...common, clientId: clientId ?? text(data, "client"), leadId: lead?.id });
      if (publicBooking) setConfirmation(next.sessions.at(-1)!); else done?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Prenotazione non riuscita."); setStart(""); }
  }
  if (confirmation) return <section className="confirmation"><CalendarCheck size={42} /><h2>Prenotazione confermata</h2><p>{confirmation.package.name}</p><strong>{dateTimeLabel(confirmation.start)}</strong><p>{money(sessionTotalForConfirmation(confirmation))}</p><p className="muted">Registrata in questo browser. Nessuna email inviata.</p><Link className="button primary" href={`/sessions/${confirmation.id}`}>Apri la sessione nel CRM</Link><button onClick={() => { setConfirmation(null); setStart(""); }}>Nuova prenotazione</button></section>;
  return <form className="form-stack booking-form" onSubmit={submit}>
    {lead && <p className="notice">{lead.name} · {lead.email}</p>}
    {!publicBooking && !lead && !clientId && <label>Cliente<select name="client" required defaultValue=""><option value="" disabled>Seleziona cliente</option>{state.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>}
    <fieldset><legend>1. Servizio e pacchetto</legend><label>Servizio<select value={service} onChange={(event) => { setService(event.target.value); setPackageId(state.packages.find((item) => item.service === event.target.value)!.id); setStart(""); setDate(""); }}>{services.map((name) => <option key={name}>{name}</option>)}</select></label>
      <div className="package-options">{matching.map((item) => <label className={`package-option ${packageId === item.id ? "selected" : ""}`} key={item.id}><input type="radio" name="package" checked={packageId === item.id} onChange={() => { setPackageId(item.id); setStart(""); }} /><span><strong>{item.name}</strong><small>{item.minutes} min · {item.photos} fotografie</small></span><b>{money(item.price)}</b></label>)}</div>
      <div className="extras">{state.extras.map((extra) => <label className="check-label" key={extra.id}><input type="checkbox" checked={extraIds.includes(extra.id)} onChange={(event) => setExtraIds(event.target.checked ? [...extraIds, extra.id] : extraIds.filter((extraId) => extraId !== extra.id))} /><span>{extra.name}</span><strong>{money(extra.price)}</strong></label>)}</div>
    </fieldset>
    <fieldset><legend>2. Data e orario <span className="muted">(Europe/Rome)</span></legend>{days.length ? <><label>Data disponibile<select aria-label="Data disponibile" value={activeDay?.date ?? ""} onChange={(event) => { setDate(event.target.value); setStart(""); }}>{days.map((day) => <option value={day.date} key={day.date}>{dateLabel(day.date)}</option>)}</select></label><div className="slots" aria-label="Orari disponibili">{activeDay?.slots.map((slot) => <button type="button" key={slot.startsAt} className={start === slot.startsAt ? "selected" : ""} aria-pressed={start === slot.startsAt} onClick={() => setStart(slot.startsAt)}>{toLocalTimeLabel(new Date(slot.startsAt))}</button>)}</div>{start && !slotValid && <p role="alert" className="error">Lo slot non e piu disponibile. Seleziona un altro orario.</p>}</> : <p className="empty">Nessun orario disponibile. Verifica giorni, chiusure e durata del pacchetto nelle prenotazioni.</p>}</fieldset>
    <fieldset><legend>3. {publicBooking ? "I tuoi dati" : "Dettagli"}</legend>{publicBooking && <div className="form-grid"><label>Nome completo<input name="name" required maxLength={100} autoComplete="off" placeholder="Visitatore Demo" /></label><label>Email<input name="email" type="email" required maxLength={200} autoComplete="off" placeholder="visitatore@example.com" /></label><label>Telefono (facoltativo)<input name="phone" type="tel" maxLength={40} /></label></div>}<label>Note<textarea name="notes" rows={2} maxLength={2000} /></label>{publicBooking && <label className="check-label"><input type="checkbox" required />Uso dati fittizi per questa prenotazione dimostrativa.</label>}</fieldset>
    {error && <p role="alert" className="error">{error}</p>}<div className="booking-total"><span>Totale <strong>{money(total)}</strong></span><button className="primary" type="submit" disabled={busy || !slotValid}><Check size={18} />{busy ? "Salvataggio..." : publicBooking ? "Conferma prenotazione" : lead ? "Converti e crea sessione" : "Crea sessione"}</button></div>
  </form>;
}

function sessionTotalForConfirmation(session: Session) { return session.package.price + session.extras.reduce((sum, extra) => sum + extra.price, 0); }