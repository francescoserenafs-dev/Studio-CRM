"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import type { Action, DemoState } from "@/lib/demo";
import { transact } from "@/lib/demo-store";

type DemoContext = { state: DemoState; run: (action: Action | "reset") => Promise<DemoState>; busy: boolean };
const Context = createContext<DemoContext | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => { void transact().then((value) => { if (active) { setState(value); setError(""); } }).catch((reason: Error) => { if (active) setError(reason.message); }); };
    refresh();
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("studio-crm-changes");
      channel.current.onmessage = refresh;
    }
    window.addEventListener("focus", refresh);
    return () => { active = false; channel.current?.close(); channel.current = null; window.removeEventListener("focus", refresh); };
  }, []);

  async function run(action: Action | "reset") {
    setBusy(true);
    try {
      const next = await transact(action);
      setState(next);
      setError("");
      channel.current?.postMessage("changed");
      return next;
    } finally { setBusy(false); }
  }

  if (error) return <main className="storage-error"><h1>Archivio locale non disponibile</h1><p role="alert">{error}</p><button disabled={busy} onClick={() => { if (confirm("Ripristinare tutti i dati della demo in questo browser?")) void run("reset").catch((reason: Error) => setError(reason.message)); }}><RotateCcw size={16} /> Ripristina dati demo</button></main>;
  if (!state) return <main className="storage-error" aria-busy="true">Apertura Studio CRM...</main>;
  return <Context.Provider value={{ state, run, busy }}>{children}</Context.Provider>;
}

export function useDemo() {
  const context = useContext(Context);
  if (!context) throw new Error("DemoProvider mancante.");
  return context;
}