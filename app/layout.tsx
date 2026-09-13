import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AMFI — Focus sur le prof. Le reste est géré.",
  description:
    "Enregistre ton cours en amphi, AMFI transcrit, nettoie et transforme l'audio en leçon structurée, quiz et carte mentale.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
