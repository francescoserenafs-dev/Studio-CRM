import { applyAction, createDemo, type Action, type DemoState } from "./demo";

const databaseName = "studio-crm-portfolio";
const storeName = "demo";
const stateKey = "visitor-state";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error("Questo browser non consente il salvataggio locale. Abilita i dati dei siti per usare la demo.")); return; }
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Archivio locale non accessibile. Verifica le impostazioni del browser."));
    request.onblocked = () => reject(new Error("Archivio bloccato. Chiudi le altre schede della demo e riprova."));
  });
}

export async function transact(action?: Action | "reset"): Promise<DemoState> {
  const database = await openDatabase();
  try {
    return await new Promise<DemoState>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.get(stateKey);
      let result: DemoState;
      let failure: Error | undefined;
      request.onsuccess = () => {
        try {
          const saved = request.result as DemoState | undefined;
          if (action !== "reset" && saved && (saved.version !== 1 || !Array.isArray(saved.clients) || !Array.isArray(saved.sessions) || !Array.isArray(saved.packages) || !Array.isArray(saved.payments) || !Array.isArray(saved.leads) || !Array.isArray(saved.extras) || !saved.settings)) {
            throw new Error("Archivio locale incompatibile. Ripristina i dati demo per continuare.");
          }
          const current = action === "reset" || !saved ? createDemo() : saved;
          result = action && action !== "reset" ? applyAction(current, action) : current;
          if (action || !saved) store.put(result, stateKey);
        } catch (error) {
          failure = error instanceof Error ? error : new Error("Operazione non riuscita.");
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(failure ?? new Error("Salvataggio locale non riuscito. Nessuna modifica salvata; controlla lo spazio disponibile."));
      transaction.onerror = () => { failure ??= new Error("Archivio locale non accessibile. Nessuna modifica salvata."); };
    });
  } finally { database.close(); }
}