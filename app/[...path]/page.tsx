import { notFound } from "next/navigation";
import { DemoWorkspace } from "@/components/demo/workspace";

export default async function Page({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const list = path.length === 1 && ["home", "clients", "leads", "sessions", "payments", "pacchetti", "prenotazioni"].includes(path[0]);
  const detail = path.length === 2 && ["clients", "leads", "sessions"].includes(path[0]) && path[1] !== "import" && path[1] !== "analisi";
  const booking = path.join("/") === "prenota/studio";
  if (!list && !detail && !booking) notFound();
  return <DemoWorkspace />;
}