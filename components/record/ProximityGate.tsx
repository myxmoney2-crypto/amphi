"use client";

import { useState } from "react";

/**
 * Pop-up d'avertissement affiché avant de pouvoir démarrer un enregistrement
 * — bloque l'accès au contenu (le Recorder) tant que l'utilisateur n'a pas
 * confirmé.
 */
export default function ProximityGate({ children }: { children: React.ReactNode }) {
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6">
      <div className="animate-pop-in w-full max-w-sm rounded-3xl bg-cream p-8 text-center shadow-2xl">
        <p className="text-3xl">🎙️</p>
        <p className="mt-3 text-base font-semibold text-ink">
          Assure-toi d'être suffisamment proche du prof pour bien capter le cours.
        </p>
        <button
          onClick={() => setConfirmed(true)}
          className="mt-6 w-full rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-cream transition hover:scale-[1.02]"
        >
          C'est bon, je suis prêt
        </button>
        <a
          href="/dashboard"
          className="mt-3 inline-block text-sm text-ink/50 underline underline-offset-2"
        >
          Annuler
        </a>
      </div>
    </div>
  );
}
