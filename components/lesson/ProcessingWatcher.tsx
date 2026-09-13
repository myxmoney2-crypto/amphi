"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Rendu uniquement pendant que `courses.status === 'processing'`. Écoute les
 * changements en Realtime (Edge Function qui passe le statut à done/error)
 * et rafraîchit la page serveur dès que le traitement se termine — avec un
 * polling de secours si Realtime n'est pas disponible.
 */
export default function ProcessingWatcher({ courseId }: { courseId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`course-${courseId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "courses", filter: `id=eq.${courseId}` },
        (payload: any) => {
          if (payload.new?.status && payload.new.status !== "processing") {
            router.refresh();
          }
        }
      )
      .subscribe();

    const poll = setInterval(() => router.refresh(), 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [courseId, router]);

  return null;
}
