"use client";

export default function UpgradeOverlay({
  message,
  children,
}: {
  message: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mt-4">
      <div className="blurred-content select-none">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/40 px-6 text-center">
        <p className="max-w-xs text-sm font-semibold text-ink">{message}</p>
        <button
          onClick={() => alert("Les abonnements arrivent bientôt — merci de tester la beta !")}
          className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-cream"
        >
          Voir les offres
        </button>
      </div>
    </div>
  );
}
