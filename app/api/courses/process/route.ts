import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Déclenche le traitement d'un cours et répond immédiatement — le vrai
 * travail (Whisper + Claude) tourne en arrière-plan dans l'Edge Function
 * Supabase `process-course` (voir supabase/functions/process-course), donc
 * ce endpoint n'est jamais bloqué par la durée d'un cours long.
 */
export async function POST(request: NextRequest) {
  const { courseId } = await request.json();
  if (!courseId) {
    return NextResponse.json({ error: "courseId manquant." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  // Vérifie que le cours appartient bien à l'utilisateur avant de déclencher
  // le traitement (RLS le garantirait déjà pour cette requête).
  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("user_id", user.id)
    .single();

  if (!course) {
    return NextResponse.json({ error: "Cours introuvable." }, { status: 404 });
  }

  const admin = createAdminClient();

  // Repasse le cours en "processing" (utile aussi pour un réessai après une
  // erreur) avant de déclencher l'Edge Function.
  await admin
    .from("courses")
    .update({ status: "processing", error_message: null })
    .eq("id", courseId);

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-course`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ courseId }),
    });

    if (!res.ok) {
      throw new Error(`Edge Function a répondu ${res.status} : ${await res.text()}`);
    }
  } catch (err: any) {
    await admin
      .from("courses")
      .update({
        status: "error",
        error_message: "Impossible de démarrer le traitement (Edge Function injoignable).",
      })
      .eq("id", courseId);
    return NextResponse.json({ error: "Impossible de démarrer le traitement." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, courseId, started: true });
}
