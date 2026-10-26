import type { Metadata } from "next";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/dm-serif-display/latin-400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studio CRM | Portfolio Demo",
  description: "Demo locale di un CRM per studio fotografico con dati sintetici e prenotazioni integrate.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        {children}
      </body>
    </html>
  );
}
