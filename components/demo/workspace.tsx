"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Camera, Check, CircleDollarSign, ExternalLink, LayoutDashboard, Package as PackageIcon, Pencil, Plus, RotateCcw, Search, Settings2, Trash2, UserRound, Users } from "lucide-react";
import { money, sessionBalance, sessionPaid, sessionTotal, type Lead, type Package, type Session } from "@/lib/demo";
import { addDaysToDateKey, toLocalDateKey } from "@/lib/datetime";
import { DemoProvider, useDemo } from "./demo-provider";
import { ActionForm, ClientForm, dateLabel, dateTimeLabel, LeadForm, Modal, PackageForm, PaymentForm, SessionComposer } from "./forms";

const navigation = [
  { href: "/", title: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", title: "Clienti", icon: Users },
  { href: "/leads", title: "Lead", icon: UserRound },
  { href: "/sessions", title: "Sessioni", icon: Camera },
  { href: "/payments", title: "Pagamenti", icon: CircleDollarSign },
  { href: "/pacchetti", title: "Pacchetti", icon: PackageIcon },
  { href: "/prenotazioni", title: "Prenotazioni", icon: CalendarDays },
];
const sessionLabels: Record<Session["status"], string> = { scheduled: "In programma", completed: "Completata", cancelled: "Annullata" };
const leadLabels: Record<Lead["status"], string> = { new: "Nuovo", contacted: "Contattato", converted: "Convertito", lost: "Perso" };

export function DemoWorkspace() { return <DemoProvider><Shell /></DemoProvider>; }

function Shell() {
  const pathname = usePathname();
  const { state, run, busy } = useDemo();
  const [error, setError] = useState("");
  const isPublic = pathname.startsWith("/prenota/");
  const section = pathname.split("/")[1];
  const id = pathname.split("/")[2];
  async function reset() {
    if (!confirm("Ripristinare la demo? Tutte le modifiche locali di questo browser saranno eliminate, anche nelle altre schede.")) return;
    try { await run("reset"); setError(""); } catch (reason) { setError((reason as Error).message); }
  }
  return <div className={isPublic ? "public-shell" : "app-shell"}>
    {!isPublic && <aside className="sidebar"><Link className="brand" href="/"><span className="brand-symbol"><Camera size={23} /></span><span>Studio CRM<small>PORTFOLIO EDITION</small></span></Link><nav aria-label="Navigazione principale">{navigation.map(({ href, title, icon: Icon }) => <Link key={href} href={href} aria-current={(href === "/" ? pathname === "/" || section === "home" : pathname.startsWith(href)) ? "page" : undefined}><Icon size={19} />{title}</Link>)}</nav><div className="sidebar-bottom"><span className="local-dot" /> Archivio locale<span className="muted">Studio dimostrativo</span></div></aside>}
    <div className="workspace"><header className="topbar">{isPublic ? <Link className="brand" href="/"><Camera size={24} /> Studio CRM</Link> : <span className="breadcrumb">Studio / <strong>{navigation.find((item) => item.href === `/${section}`)?.title ?? "Dashboard"}</strong></span>}<div className="topbar-actions"><span className="demo-badge">DEMO</span><button className="icon-button" aria-label="Ripristina demo" title="Ripristina demo" disabled={busy} onClick={() => void reset()}><RotateCcw size={18} /></button>{isPublic ? <Link className="button" href="/">Apri CRM <ArrowRight size={16} /></Link> : <Link className="button" href="/prenota/studio">Pagina prenotazioni <ExternalLink size={15} /></Link>}</div></header>
      <div className="demo-notice">Dati sintetici, salvati solo in questo browser. Nessuna email o transazione reale. Non inserire dati personali.</div>
      {error && <p role="alert" className="error">{error}</p>}
      <main className="main-content" key={`${pathname}-${state.createdAt}`}>
        {isPublic ? <PublicBooking /> : section === "clients" ? id ? <ClientProfile id={id} /> : <Clients /> : section === "leads" ? id ? <LeadProfile id={id} /> : <Leads /> : section === "sessions" ? id ? <SessionProfile id={id} /> : <Sessions /> : section === "payments" ? <Payments /> : section === "pacchetti" ? <Packages /> : section === "prenotazioni" ? <BookingSettings /> : <Dashboard />}
      </main><footer className="workspace-footer"><span>Studio CRM · Portfolio demo</span><span>Orari Europe/Rome · EUR</span></footer>
    </div>
  </div>;
}

function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) { return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div><div className="heading-actions">{children}</div></div>; }
function Empty({ children = "Nessun risultato." }: { children?: ReactNode }) { return <p className="empty">{children}</p>; }
function Missing() { return <><h1>Elemento non trovato</h1><p>Il record non esiste in questo archivio locale o e stato ripristinato.</p><Link className="button" href="/">Torna alla dashboard</Link></>; }
function SearchBox({ value, change, label }: { value: string; change: (value: string) => void; label: string }) { return <label className="search"><Search size={17} /><input aria-label={label} placeholder={label} value={value} onChange={(event) => change(event.target.value)} /></label>; }
function Badge({ value, children }: { value: string; children: ReactNode }) { return <span className={`badge badge-${value}`}>{children}</span>; }
function Metrics({ values }: { values: { label: string; value: string; detail: string }[] }) { return <div className="metrics">{values.map((item) => <div className="metric" key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></div>)}</div>; }

function Dashboard() {
  const { state } = useDemo();
  const today = toLocalDateKey(new Date());
  const cutoff = addDaysToDateKey(today, -29);
  const upcoming = state.sessions.filter((session) => session.status === "scheduled" && session.start >= new Date().toISOString()).sort((first, second) => first.start.localeCompare(second.start));
  const outstanding = state.sessions.filter((session) => session.status !== "cancelled").reduce((sum, session) => sum + sessionBalance(state, session), 0);
  const income = state.payments.filter((payment) => payment.date >= cutoff).reduce((sum, payment) => sum + payment.amount, 0);
  const weeks = Array.from({ length: 6 }, (_, index) => { const start = addDaysToDateKey(today, -41 + index * 7); const end = addDaysToDateKey(start, 6); return { start, amount: state.payments.filter((payment) => payment.date >= start && payment.date <= end).reduce((sum, payment) => sum + payment.amount, 0) }; });
  const maxIncome = Math.max(...weeks.map((week) => week.amount), 1);
  return <><Heading eyebrow={new Intl.DateTimeFormat("it-IT", { dateStyle: "full", timeZone: "Europe/Rome" }).format(new Date())} title="Il tuo studio, oggi"><Link className="button primary" href="/sessions"><Plus size={17} />Gestisci sessioni</Link></Heading>
    <Metrics values={[{ label: "Incassi registrati", value: money(income), detail: "Ultimi 30 giorni" }, { label: "Saldo da incassare", value: money(outstanding), detail: "Sessioni non annullate" }, { label: "Prossime sessioni", value: String(upcoming.length), detail: "Appuntamenti in programma" }, { label: "Lead aperti", value: String(state.leads.filter((lead) => lead.status === "new" || lead.status === "contacted").length), detail: "Nuovi e contattati" }]} />
    <div className="dashboard-split"><section><div className="section-heading"><h2>Incassi per settimana</h2><Link href="/payments">Tutti i pagamenti <ArrowRight size={15} /></Link></div><div className="income-chart" aria-label="Incassi nelle ultime sei settimane">{weeks.map((week) => <div className="chart-column" key={week.start}><span>{money(week.amount)}</span><div className="chart-track"><div className="chart-bar" style={{ height: `${Math.max(week.amount / maxIncome * 100, 2)}%` }} /></div><small>{dateLabel(week.start).split(" ").slice(0, 2).join(" ")}</small></div>)}</div></section><section className="lead-summary"><div className="section-heading"><h2>Da ricontattare</h2><Link href="/leads">Lead <ArrowRight size={15} /></Link></div>{state.leads.filter((lead) => lead.status === "new" || lead.status === "contacted").slice(0, 4).map((lead) => <Link className="contact-row" href={`/leads/${lead.id}`} key={lead.id}><span className="avatar">{lead.name.slice(0, 1)}</span><span><strong>{lead.name}</strong><small>{lead.service}</small></span><Badge value={lead.status}>{leadLabels[lead.status]}</Badge></Link>)}{!state.leads.some((lead) => lead.status === "new" || lead.status === "contacted") && <Empty>Nessun lead da ricontattare.</Empty>}</section></div>
    <section><div className="section-heading"><h2>In agenda</h2><Link href="/sessions">Tutte le sessioni <ArrowRight size={15} /></Link></div><SessionTable sessions={upcoming.slice(0, 5)} /></section>
  </>;
}

function SessionTable({ sessions }: { sessions: Session[] }) {
  const { state } = useDemo();
  if (!sessions.length) return <Empty>Nessuna sessione.</Empty>;
  return <div className="table-scroll"><table><thead><tr><th>Cliente / pacchetto</th><th>Data e ora</th><th>Stato</th><th>Totale</th><th>Saldo</th><th><span className="sr-only">Dettaglio</span></th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td><Link className="record-link" href={`/sessions/${session.id}`}>{state.clients.find((client) => client.id === session.clientId)?.name}</Link><small>{session.package.name}</small></td><td>{dateTimeLabel(session.start)}</td><td><Badge value={session.status}>{sessionLabels[session.status]}</Badge></td><td>{money(sessionTotal(session))}</td><td>{session.status === "cancelled" ? "-" : money(sessionBalance(state, session))}</td><td><Link className="icon-button" aria-label={`Apri sessione ${state.clients.find((client) => client.id === session.clientId)?.name}`} href={`/sessions/${session.id}`}><ArrowRight size={17} /></Link></td></tr>)}</tbody></table></div>;
}

function Clients() {
  const { state } = useDemo();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const clients = state.clients.filter((client) => `${client.name} ${client.email}`.toLowerCase().includes(search.toLowerCase())).sort((first, second) => first.name.localeCompare(second.name));
  return <><Heading eyebrow={`${state.clients.length} contatti`} title="Clienti"><button className="primary" onClick={() => setAdding(true)}><Plus size={17} />Nuovo cliente</button></Heading><div className="toolbar"><SearchBox value={search} change={setSearch} label="Cerca clienti" /></div>{clients.length ? <div className="table-scroll"><table><thead><tr><th>Cliente</th><th>Email</th><th>Sessioni</th><th>Incassato</th><th>Saldo</th></tr></thead><tbody>{clients.map((client) => { const sessions = state.sessions.filter((session) => session.clientId === client.id && session.status !== "cancelled"); return <tr key={client.id}><td><Link className="record-link" href={`/clients/${client.id}`}>{client.name}</Link></td><td>{client.email}</td><td>{sessions.length}</td><td>{money(sessions.reduce((sum, session) => sum + sessionPaid(state, session.id), 0))}</td><td>{money(sessions.reduce((sum, session) => sum + sessionBalance(state, session), 0))}</td></tr>; })}</tbody></table></div> : <Empty />}{adding && <Modal title="Nuovo cliente" close={() => setAdding(false)}><ClientForm done={() => setAdding(false)} /></Modal>}</>;
}

function ClientProfile({ id }: { id: string }) {
  const { state } = useDemo();
  const [adding, setAdding] = useState(false);
  const client = state.clients.find((item) => item.id === id);
  if (!client) return <Missing />;
  const sessions = state.sessions.filter((session) => session.clientId === id).sort((first, second) => second.start.localeCompare(first.start));
  return <><Link className="back-link" href="/clients"><ArrowLeft size={16} />Clienti</Link><Heading eyebrow="Scheda cliente" title={client.name}><button className="primary" onClick={() => setAdding(true)}><Plus size={17} />Nuova sessione</button></Heading><section className="profile-form"><h2>Anagrafica</h2><ClientForm client={client} /></section><section><div className="section-heading"><h2>Storico sessioni</h2><span>{sessions.length} sessioni</span></div><SessionTable sessions={sessions} /></section>{adding && <Modal title="Nuova sessione" close={() => setAdding(false)}><SessionComposer clientId={id} done={() => setAdding(false)} /></Modal>}</>;
}

function Leads() {
  const { state } = useDemo();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const leads = state.leads.filter((lead) => (!status || lead.status === status) && `${lead.name} ${lead.email}`.toLowerCase().includes(search.toLowerCase()));
  return <><Heading eyebrow="Dalla richiesta alla sessione" title="Lead"><button className="primary" onClick={() => setAdding(true)}><Plus size={17} />Nuovo lead</button></Heading><div className="toolbar"><SearchBox value={search} change={setSearch} label="Cerca lead" /><select aria-label="Filtra stato lead" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tutti gli stati</option>{Object.entries(leadLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{leads.length ? <div className="table-scroll"><table><thead><tr><th>Contatto</th><th>Servizio</th><th>Stato</th><th>Note</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id}><td><Link className="record-link" href={`/leads/${lead.id}`}>{lead.name}</Link><small>{lead.email}</small></td><td>{lead.service}</td><td><Badge value={lead.status}>{leadLabels[lead.status]}</Badge></td><td className="note-cell">{lead.notes || "-"}</td></tr>)}</tbody></table></div> : <Empty />}{adding && <Modal title="Nuovo lead" close={() => setAdding(false)}><LeadForm done={() => setAdding(false)} /></Modal>}</>;
}

function LeadProfile({ id }: { id: string }) {
  const { state } = useDemo();
  const [converting, setConverting] = useState(false);
  const lead = state.leads.find((item) => item.id === id);
  if (!lead) return <Missing />;
  return <><Link className="back-link" href="/leads"><ArrowLeft size={16} />Lead</Link><Heading eyebrow={leadLabels[lead.status]} title={lead.name}>{lead.status !== "converted" && lead.status !== "lost" && <button className="primary" onClick={() => setConverting(true)}><CalendarDays size={17} />Converti in sessione</button>}</Heading>{lead.status === "converted" ? <section><p>{lead.email}</p><p>{lead.notes}</p><Link className="button primary" href={`/sessions/${lead.sessionId}`}>Apri sessione <ArrowRight size={16} /></Link></section> : <section className="profile-form"><LeadForm lead={lead} /></section>}{converting && <Modal title="Converti lead" close={() => setConverting(false)}><SessionComposer lead={lead} done={() => setConverting(false)} /></Modal>}</>;
}

function Sessions() {
  const { state } = useDemo();
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const sessions = state.sessions.filter((session) => (!status || session.status === status) && `${session.package.name} ${state.clients.find((client) => client.id === session.clientId)?.name}`.toLowerCase().includes(search.toLowerCase())).sort((first, second) => second.start.localeCompare(first.start));
  return <><Heading eyebrow={`${state.sessions.length} sessioni`} title="Sessioni"><button className="primary" onClick={() => setAdding(true)}><Plus size={17} />Nuova sessione</button></Heading><div className="toolbar"><SearchBox value={search} change={setSearch} label="Cerca sessioni" /><select aria-label="Filtra stato sessione" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tutti gli stati</option>{Object.entries(sessionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><SessionTable sessions={sessions} />{adding && <Modal title="Nuova sessione" close={() => setAdding(false)}><SessionComposer done={() => setAdding(false)} /></Modal>}</>;
}

function SessionProfile({ id }: { id: string }) {
  const { state, run, busy } = useDemo();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const session = state.sessions.find((item) => item.id === id);
  if (!session) return <Missing />;
  const client = state.clients.find((item) => item.id === session.clientId)!;
  async function status(value: Session["status"]) {
    if (!confirm(value === "cancelled" ? "Annullare la sessione e liberare lo slot?" : "Segnare la sessione come completata?")) return;
    try { await run({ type: "status", sessionId: id, status: value }); setError(""); } catch (reason) { setError((reason as Error).message); }
  }
  return <><Link className="back-link" href="/sessions"><ArrowLeft size={16} />Sessioni</Link><Heading eyebrow={session.source === "booking" ? "Prenotazione pubblica" : session.source === "lead" ? "Conversione lead" : "Sessione CRM"} title={session.package.name}><Badge value={session.status}>{sessionLabels[session.status]}</Badge>{session.status !== "cancelled" && sessionBalance(state, session) > 0 && <button className="primary" onClick={() => setPaying(true)}><Plus size={17} />Registra pagamento</button>}</Heading>
    <Metrics values={[{ label: "Totale", value: money(sessionTotal(session)), detail: "Pacchetto ed extra applicati" }, { label: "Registrato", value: money(sessionPaid(state, id)), detail: "Nessun addebito reale" }, { label: "Saldo", value: session.status === "cancelled" ? "-" : money(sessionBalance(state, session)), detail: session.status === "cancelled" ? "Sessione annullata" : "Da registrare" }]} />
    <div className="detail-grid"><section><h2>Appuntamento</h2><dl><dt>Cliente</dt><dd><Link href={`/clients/${client.id}`}>{client.name}</Link></dd><dt>Data e ora</dt><dd>{dateTimeLabel(session.start)}</dd><dt>Durata</dt><dd>{session.package.minutes} minuti</dd><dt>Note</dt><dd>{session.notes || "Nessuna nota"}</dd></dl>{session.status === "scheduled" && <div className="row-actions"><button disabled={busy || new Date(session.start) > new Date()} onClick={() => void status("completed")}><Check size={16} />Completa</button><button className="danger" disabled={busy} onClick={() => void status("cancelled")}><Trash2 size={16} />Annulla sessione</button></div>}{error && <p className="error" role="alert">{error}</p>}</section><section><h2>Pacchetto applicato</h2><dl><dt>{session.package.name}</dt><dd>{money(session.package.price)}</dd><dt>Fotografie incluse</dt><dd>{session.package.photos}</dd>{session.extras.map((extra) => <div className="dl-row" key={extra.id}><dt>{extra.name}</dt><dd>{money(extra.price)}</dd></div>)}</dl></section></div><section><div className="section-heading"><h2>Pagamenti registrati</h2></div><PaymentTable sessionId={id} /></section>{paying && <Modal title="Registra pagamento" close={() => setPaying(false)}><PaymentForm session={session} done={() => setPaying(false)} /></Modal>}</>;
}

function PaymentTable({ sessionId }: { sessionId?: string }) {
  const { state, run, busy } = useDemo();
  const [error, setError] = useState("");
  const payments = state.payments.filter((payment) => !sessionId || payment.sessionId === sessionId).sort((first, second) => second.date.localeCompare(first.date));
  async function remove(id: string) { if (!confirm("Stornare questa registrazione? Il saldo sara ricalcolato. Non viene eseguito alcun rimborso reale.")) return; try { await run({ type: "delete-payment", id }); setError(""); } catch (reason) { setError((reason as Error).message); } }
  return <>{error && <p className="error" role="alert">{error}</p>}{payments.length ? <div className="table-scroll"><table><thead><tr><th>Data</th><th>Cliente / sessione</th><th>Metodo</th><th>Importo</th><th><span className="sr-only">Azioni</span></th></tr></thead><tbody>{payments.map((payment) => { const session = state.sessions.find((item) => item.id === payment.sessionId)!; return <tr key={payment.id}><td>{dateLabel(payment.date)}</td><td><Link className="record-link" href={`/sessions/${session.id}`}>{state.clients.find((client) => client.id === session.clientId)?.name}</Link><small>{session.package.name}</small></td><td>{payment.method}</td><td>{money(payment.amount)}</td><td><button className="icon-button danger" disabled={busy} title="Storna registrazione" aria-label="Storna registrazione" onClick={() => void remove(payment.id)}><RotateCcw size={16} /></button></td></tr>; })}</tbody></table></div> : <Empty>Nessun pagamento registrato.</Empty>}</>;
}

function Payments() {
  const { state } = useDemo();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState("");
  const payable = state.sessions.filter((session) => session.status !== "cancelled" && sessionBalance(state, session) > 0);
  const session = payable.find((item) => item.id === selected) ?? payable[0];
  return <><Heading eyebrow="Registro, senza elaborazione di transazioni" title="Pagamenti"><button className="primary" disabled={!payable.length} onClick={() => setAdding(true)}><Plus size={17} />Registra pagamento</button></Heading><Metrics values={[{ label: "Totale registrato", value: money(state.payments.reduce((sum, payment) => sum + payment.amount, 0)), detail: `${state.payments.length} registrazioni` }, { label: "Saldo complessivo", value: money(payable.reduce((sum, item) => sum + sessionBalance(state, item), 0)), detail: `${payable.length} sessioni da saldare` }]} /><PaymentTable />{adding && session && <Modal title="Registra pagamento" close={() => setAdding(false)}><label>Sessione<select value={session.id} onChange={(event) => setSelected(event.target.value)}>{payable.map((item) => <option key={item.id} value={item.id}>{state.clients.find((client) => client.id === item.clientId)?.name} · {item.package.name} · {dateLabel(item.start)}</option>)}</select></label><PaymentForm key={session.id} session={session} done={() => setAdding(false)} /></Modal>}</>;
}

function Packages() {
  const { state } = useDemo();
  const [editing, setEditing] = useState<Package | "new" | null>(null);
  return <><Heading eyebrow="Catalogo servizi" title="Pacchetti"><button className="primary" onClick={() => setEditing("new")}><Plus size={17} />Nuovo pacchetto</button></Heading><div className="package-grid">{state.packages.map((item) => <article className="package-card" key={item.id}><div className="package-card-top"><span className="eyebrow">{item.service}</span><Camera size={22} /></div><h2>{item.name}</h2><strong className="package-price">{money(item.price)}</strong><ul><li>{item.photos} fotografie incluse</li><li>{item.minutes} minuti in studio</li></ul><button onClick={() => setEditing(item)}><Pencil size={16} />Modifica pacchetto</button></article>)}</div><section><div className="section-heading"><h2>Extra disponibili</h2></div><div className="extra-catalog">{state.extras.map((extra) => <div key={extra.id}><span>{extra.name}</span><strong>{money(extra.price)}</strong></div>)}</div></section>{editing && <Modal title={editing === "new" ? "Nuovo pacchetto" : "Modifica pacchetto"} close={() => setEditing(null)}><PackageForm item={editing === "new" ? undefined : editing} done={() => setEditing(null)} /></Modal>}</>;
}

function BookingSettings() {
  const { state } = useDemo();
  const settings = state.settings;
  const weekdays = ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"];
  return <><Heading eyebrow="Calendario integrato" title="Prenotazioni"><Link className="button primary" href="/prenota/studio"><ExternalLink size={17} />Apri pagina pubblica</Link></Heading><section className="settings-section"><h2><Settings2 size={20} /> Disponibilita dello studio</h2><ActionForm action={(data) => ({ type: "settings", settings: { enabled: data.get("enabled") === "on", weekdays: data.getAll("weekday").map(Number), open: String(data.get("open")), close: String(data.get("close")), buffer: Number(data.get("buffer")), notice: Number(data.get("notice")), horizon: Number(data.get("horizon")), closedDates: String(data.get("closedDates") ?? "").split(/[\s,]+/).filter(Boolean) } })}>
    <label className="check-label"><input name="enabled" type="checkbox" defaultChecked={settings.enabled} />Prenotazioni attive</label><fieldset><legend>Giorni di apertura</legend><div className="weekdays">{[1, 2, 3, 4, 5, 6, 0].map((day) => <label className="check-label" key={day}><input type="checkbox" name="weekday" value={day} defaultChecked={settings.weekdays.includes(day)} />{weekdays[day]}</label>)}</div></fieldset><div className="form-grid"><label>Apertura<input name="open" type="time" required defaultValue={settings.open} /></label><label>Chiusura<input name="close" type="time" required defaultValue={settings.close} /></label><label>Pausa tra sessioni (min)<input name="buffer" type="number" min="0" max="120" required defaultValue={settings.buffer} /></label><label>Preavviso minimo (ore)<input name="notice" type="number" min="0" max="168" required defaultValue={settings.notice} /></label><label>Finestra prenotabile (giorni)<input name="horizon" type="number" min="1" max="90" required defaultValue={settings.horizon} /></label></div><label>Date di chiusura (AAAA-MM-GG, una per riga)<textarea name="closedDates" rows={3} defaultValue={settings.closedDates.join("\n")} placeholder="2026-12-25" /></label></ActionForm></section><section><div className="section-heading"><h2>Prenotazioni ricevute</h2></div><SessionTable sessions={state.sessions.filter((session) => session.source === "booking").sort((first, second) => first.start.localeCompare(second.start))} /></section></>;
}

function PublicBooking() {
  return <div className="public-booking"><div className="public-intro"><p className="eyebrow">STUDIO FOTOGRAFICO DEMO</p><h1>Prenota una sessione</h1><Image src="/studio-camera.jpg" alt="Fotocamera e obiettivo nello studio dimostrativo" width={800} height={530} priority className="studio-image" /><div className="public-facts"><span><Camera size={17} /> Ritratto, famiglia e branding</span><span><CalendarDays size={17} /> Orari Europe/Rome</span></div></div><SessionComposer publicBooking /></div>;
}