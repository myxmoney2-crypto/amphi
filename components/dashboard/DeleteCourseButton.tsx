"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DeleteCourseButton({
  courseId,
  audioPath,
}: {
  courseId: string;
  audioPath: string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const supabase = createClient();

    if (audioPath) {
      await supabase.storage.from("course-audio").remove([audioPath]);
    }

    // lessons/quizzes/mindmaps partent en cascade (on delete cascade en base).
    const { error: deleteError } = await supabase.from("courses").delete().eq("id", courseId);

    if (deleteError) {
      setError("Impossible de supprimer ce cours. Réessaie.");
      setDeleting(false);
      return;
    }
    // La carte disparaît toute seule via l'abonnement Realtime du dashboard.
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setConfirming(true);
        }}
        className="rounded-full p-1.5 text-ink/30 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
        title="Supprimer ce cours"
        aria-label="Supprimer ce cours"
      >
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M3.5 5h11M7 5V3.5h4V5M6 5v9.5A1 1 0 007 15.5h4a1 1 0 001-1.5V5" />
          <path d="M7.5 7.5v5M10.5 7.5v5" />
        </svg>
      </button>

      {confirming && (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6"
        >
          <div className="animate-pop-in w-full max-w-sm rounded-3xl bg-cream p-8 text-center shadow-2xl">
            <p className="text-3xl">🗑️</p>
            <p className="mt-3 text-base font-semibold text-ink">
              Supprimer ce cours définitivement ?
            </p>
            <p className="mt-2 text-sm text-ink/60">
              La leçon, le quiz, la carte mentale et l'audio associés seront supprimés. Cette
              action est irréversible.
            </p>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="mt-6 w-full rounded-full bg-red-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? "Suppression..." : "Supprimer définitivement"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="mt-3 text-sm text-ink/50 underline underline-offset-2 disabled:opacity-60"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  );
}
