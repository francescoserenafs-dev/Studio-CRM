import Link from "next/link";

export default function NotFound() {
  return <main className="storage-error"><h1>Pagina non disponibile</h1><p>Questa pagina non fa parte della demo.</p><Link className="button primary" href="/">Apri Studio CRM</Link></main>;
}