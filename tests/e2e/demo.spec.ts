import { test, expect, type Page } from "@playwright/test";
import type { DemoState } from "../../lib/demo";

async function readState(page: Page): Promise<DemoState> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open("studio-crm-portfolio", 1);
    open.onsuccess = () => {
      const database = open.result;
      const request = database.transaction("demo").objectStore("demo").get("visitor-state");
      request.onsuccess = () => { database.close(); resolve(request.result); };
      request.onerror = () => reject(request.error);
    };
    open.onerror = () => reject(open.error);
  }));
}

async function prepareBooking(page: Page, name = "Visitatore Demo", email = "visitor@example.com") {
  await page.goto("/prenota/studio");
  await expect(page.getByRole("heading", { name: "Prenota una sessione" })).toBeVisible();
  await page.locator(".slots button").first().click();
  await page.getByLabel("Nome completo").fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Uso dati fittizi").check();
}

test("booking to CRM, package extras, payment, dashboard and persistence", async ({ page, context }) => {
  const external: string[] = [];
  const errors: string[] = [];
  context.on("request", (request) => { if (!request.url().startsWith("http://127.0.0.1:3100") && !request.url().startsWith("data:")) external.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Il tuo studio, oggi" })).toBeVisible();
  const initial = await readState(page);
  const crm = await context.newPage();
  await crm.goto("/sessions");
  await expect(crm.getByRole("heading", { name: "Sessioni", exact: true })).toBeVisible();
  await prepareBooking(page);
  await page.getByLabel("Set 5 stampe").check();
  await page.getByRole("button", { name: "Conferma prenotazione" }).click();
  await expect(page.getByRole("heading", { name: "Prenotazione confermata" })).toBeVisible();
  await expect(crm.getByRole("link", { name: "Visitatore Demo", exact: true })).toBeVisible();
  const booked = await readState(page);
  expect(booked.clients).toHaveLength(initial.clients.length + 1);
  expect(booked.sessions).toHaveLength(initial.sessions.length + 1);
  expect(booked.payments).toHaveLength(initial.payments.length);
  expect(booked.sessions.at(-1)!.extras[0].price).toBe(3500);
  await page.getByRole("link", { name: "Apri la sessione nel CRM" }).click();
  await page.getByRole("button", { name: "Registra pagamento" }).click();
  await page.getByLabel("Importo (EUR)").fill("50");
  await page.getByRole("dialog").getByRole("button", { name: "Registra pagamento" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await readState(page)).payments.at(-1)!.amount).toBe(5000);
  await page.reload();
  await expect(page.locator(".metric").filter({ hasText: "Saldo" }).locator("strong")).toHaveText(/165,00/);
  await page.getByRole("navigation").getByRole("link", { name: "Dashboard" }).click();
  const after = await readState(page);
  expect(after.payments.reduce((sum, payment) => sum + payment.amount, 0)).toBe(initial.payments.reduce((sum, payment) => sum + payment.amount, 0) + 5000);
  await expect(page.locator(".metric").filter({ hasText: "Prossime sessioni" }).locator("strong")).toHaveText("5");
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("two simultaneous submissions commit only one booking", async ({ page, context }) => {
  await context.addInitScript(() => { Object.defineProperty(window, "BroadcastChannel", { value: undefined }); });
  const other = await context.newPage();
  await prepareBooking(page, "Primo Demo", "first@example.com");
  await prepareBooking(other, "Secondo Demo", "second@example.com");
  expect(await page.getByLabel("Data disponibile").inputValue()).toBe(await other.getByLabel("Data disponibile").inputValue());
  expect(await page.locator(".slots button[aria-pressed=true]").textContent()).toBe(await other.locator(".slots button[aria-pressed=true]").textContent());
  await Promise.all([page.locator("form").evaluate((form: HTMLFormElement) => form.requestSubmit()), other.locator("form").evaluate((form: HTMLFormElement) => form.requestSubmit())]);
  await expect.poll(async () => (await page.getByRole("heading", { name: "Prenotazione confermata" }).count()) + (await other.getByRole("heading", { name: "Prenotazione confermata" }).count())).toBe(1);
  await expect.poll(async () => (await page.getByRole("main").getByRole("alert").count()) + (await other.getByRole("main").getByRole("alert").count())).toBe(1);
  const state = await readState(page);
  expect(state.sessions).toHaveLength(9);
  expect(state.clients).toHaveLength(7);
});

test("visitor isolation and reset synchronize across same-browser tabs", async ({ page, context, browser }) => {
  await prepareBooking(page);
  await page.getByRole("button", { name: "Conferma prenotazione" }).click();
  await expect(page.getByRole("heading", { name: "Prenotazione confermata" })).toBeVisible();
  const other = await context.newPage();
  await other.goto("/clients");
  await expect(other.getByRole("link", { name: "Visitatore Demo" })).toBeVisible();
  const isolated = await browser.newContext();
  const visitor = await isolated.newPage();
  await visitor.goto("http://127.0.0.1:3100/clients");
  await expect(visitor.getByRole("heading", { name: "Clienti", exact: true })).toBeVisible();
  expect((await readState(visitor)).clients).toHaveLength(6);
  await isolated.close();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Ripristina demo" }).click();
  await expect(other.getByRole("link", { name: "Visitatore Demo" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Prenota una sessione" })).toBeVisible();
  expect((await readState(page)).sessions).toHaveLength(8);
});

test("lead conversion and package snapshot survive catalog changes", async ({ page }) => {
  await page.goto("/leads");
  await page.getByRole("button", { name: "Nuovo lead" }).click();
  await page.getByLabel("Nome completo").fill("Lead Portfolio");
  await page.getByLabel("Email", { exact: true }).fill("lead@example.com");
  await page.getByRole("dialog").getByRole("button", { name: "Salva" }).click();
  await page.getByRole("link", { name: "Lead Portfolio" }).click();
  await page.getByRole("button", { name: "Converti in sessione" }).click();
  await page.locator(".slots button").first().click();
  await page.getByRole("button", { name: "Converti e crea sessione" }).click();
  await page.getByRole("link", { name: "Apri sessione", exact: true }).click();
  const before = (await readState(page)).sessions.at(-1)!;
  const sessionUrl = page.url();
  await page.getByRole("navigation").getByRole("link", { name: "Pacchetti" }).click();
  await page.getByRole("article").filter({ hasText: "Ritratto essenziale" }).getByRole("button", { name: "Modifica pacchetto" }).click();
  await page.getByLabel("Prezzo (EUR)").fill("250");
  await page.getByRole("dialog").getByRole("button", { name: "Salva" }).click();
  await page.goto(sessionUrl);
  await expect(page.getByRole("heading", { name: "Ritratto essenziale", exact: true })).toBeVisible();
  const after = await readState(page);
  expect(after.sessions.at(-1)).toEqual(before);
  expect(after.packages[0].price).toBe(25000);
  expect(after.leads.at(-1)!.status).toBe("converted");
  expect(after.clients.at(-1)!.email).toBe("lead@example.com");
});

test("availability settings, cancellations and payment reversals", async ({ page }) => {
  await prepareBooking(page);
  const date = await page.getByLabel("Data disponibile").inputValue();
  await page.goto("/prenotazioni");
  await page.getByLabel("Date di chiusura").fill(date);
  await page.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.goto("/prenota/studio");
  await expect(page.getByLabel("Data disponibile")).not.toHaveValue(date);
  await page.goto("/sessions/session-4");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Annulla sessione" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Storna prima");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Storna registrazione" }).click();
  await expect(page.getByText("Nessun pagamento registrato.")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Annulla sessione" }).click();
  await expect(page.locator(".heading-actions .badge")).toHaveText("Annullata");
  await page.goto("/prenotazioni");
  await page.getByLabel("Prenotazioni attive").uncheck();
  await page.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.goto("/prenota/studio");
  await expect(page.getByText(/Nessun orario disponibile/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Conferma prenotazione" })).toBeDisabled();
});

test("desktop and mobile screens render without page overflow or remote assets", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [path, heading] of [["/", "Il tuo studio, oggi"], ["/clients", "Clienti"], ["/leads", "Lead"], ["/sessions", "Sessioni"], ["/payments", "Pagamenti"], ["/pacchetti", "Pacchetti"], ["/prenotazioni", "Prenotazioni"], ["/prenota/studio", "Prenota una sessione"]]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    if (path === "/" || path === "/prenota/studio") {
      if (path === "/prenota/studio") await expect.poll(() => page.locator(".studio-image").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      await page.screenshot({ path: `docs/screenshots/${path === "/" ? "dashboard" : "booking"}-${testInfo.project.name}.png`, fullPage: true, scale: "css" });
    }
  }
  for (const path of ["/calendly", "/mailerlite", "/api/clients", "/api/public/booking/studio", "/login", "/vouchers", "/prenota/missing"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }
});

test("client creation, profile editing and internal session creation", async ({ page }) => {
  await page.goto("/clients");
  await page.getByRole("button", { name: "Nuovo cliente" }).click();
  await page.getByLabel("Nome completo").fill("Cliente Portfolio");
  await page.getByLabel("Email", { exact: true }).fill("client@example.com");
  await page.getByRole("dialog").getByRole("button", { name: "Salva" }).click();
  await page.getByLabel("Cerca clienti").fill("Cliente Portfolio");
  await page.getByRole("link", { name: "Cliente Portfolio", exact: true }).click();
  await page.getByLabel("Note", { exact: true }).fill("Brief sintetico aggiornato.");
  await page.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.getByRole("button", { name: "Nuova sessione" }).click();
  await page.getByRole("combobox", { name: "Servizio", exact: true }).selectOption("Branding");
  await page.getByLabel("10 fotografie aggiuntive").check();
  await page.locator(".slots button").first().click();
  await page.getByRole("button", { name: "Crea sessione", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("table").getByRole("link", { name: "Cliente Portfolio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Personal branding", exact: true })).toBeVisible();
  const state = await readState(page);
  expect(state.sessions.at(-1)!.source).toBe("crm");
  expect(state.sessions.at(-1)!.package.photos).toBe(24);
  expect(state.sessions.at(-1)!.extras[0].price).toBe(7000);
  expect(state.clients.at(-1)!.notes).toBe("Brief sintetico aggiornato.");
});

test("blocked local storage fails explicitly without submitting network writes", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "indexedDB", { value: undefined }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Archivio locale non disponibile" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("salvataggio locale");
});