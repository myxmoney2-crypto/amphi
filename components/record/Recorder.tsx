"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Subject } from "@/lib/types";

type Phase = "setup" | "ready" | "recording" | "stopped" | "uploading" | "processing" | "error";

// 32 kbps (opus) reste très intelligible pour de la parole — nettement
// au-dessus du niveau "téléphone" (~16kbps) — tout en gardant les fichiers
// petits : un cours de 3h30 tient dans ~48 Mo, sous la limite globale
// actuelle de 50 MiB du projet Supabase (voir supabase/migrations et le
// commentaire dans schema.sql), sans avoir besoin de relever cette limite.
// Le débit par défaut du navigateur (souvent 128-256kbps, pensé pour de la
// musique) aurait produit un fichier 4 à 8 fois plus gros pour rien.
const AUDIO_BITS_PER_SECOND = 32_000;

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "audio/webm";
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

/**
 * Durée réelle d'un blob audio. Les navigateurs (Chrome en particulier)
 * renvoient parfois `Infinity` pour un webm produit par MediaRecorder tant
 * qu'on n'a pas cherché une position — d'où le détour par `currentTime`.
 */
function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    const url = URL.createObjectURL(blob);
    audio.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) {
        cleanup();
        resolve(audio.duration);
        return;
      }
      // Force le navigateur à calculer la vraie durée.
      audio.currentTime = Number.MAX_SAFE_INTEGER;
      audio.ontimeupdate = () => {
        audio.ontimeupdate = null;
        cleanup();
        resolve(Number.isFinite(audio.duration) ? audio.duration : NaN);
      };
    };
    audio.onerror = () => {
      cleanup();
      resolve(NaN);
    };
  });
}

export default function Recorder({ initialSubjects }: { initialSubjects: Subject[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [subjectId, setSubjectId] = useState<string | "new" | "">(
    initialSubjects[0]?.id ?? "new"
  );
  const [newSubjectName, setNewSubjectName] = useState("");

  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [durationWarning, setDurationWarning] = useState<string | null>(null);
  const [micInterrupted, setMicInterrupted] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const phaseRef = useRef<Phase>("ready");
  phaseRef.current = phase;
  // true seulement quand c'est l'utilisateur qui a cliqué sur Stop — permet
  // à `recorder.onstop` de distinguer un arrêt volontaire d'un arrêt
  // provoqué par le navigateur lui-même (piste audio terminée).
  const userInitiatedStopRef = useRef(false);

  async function acquireWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      }
    } catch {
      // Wake Lock refusé/non supporté : on continue sans, ce n'est pas bloquant.
    }
  }

  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }

  useEffect(() => {
    // Le Wake Lock est automatiquement relâché quand l'onglet passe en
    // arrière-plan — on le redemande dès qu'il redevient visible, pour
    // limiter la mise en veille de l'écran pendant un enregistrement long.
    function handleVisibility() {
      if (document.visibilityState === "visible" && phaseRef.current === "recording") {
        acquireWakeLock();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    // Avertit avant de fermer l'onglet pendant un enregistrement en cours :
    // les chunks ne sont qu'en mémoire, tout serait perdu.
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (phaseRef.current === "recording") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      releaseWakeLock();
    };
  }, []);

  async function startRecording() {
    setErrorMessage(null);
    setDurationWarning(null);
    setMicInterrupted(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType,
          audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        });
      } catch {
        // Au cas où le navigateur refuse audioBitsPerSecond pour ce mimeType.
        recorder = new MediaRecorder(stream, { mimeType });
      }
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      // `onstop` est le SEUL endroit fiable pour nettoyer : le navigateur
      // peut arrêter le MediaRecorder de son propre chef quand la piste
      // audio sous-jacente se termine (veille système, permission révoquée,
      // périphérique débranché) sans jamais passer par notre fonction
      // `stopRecording` — un premier test l'a confirmé : le chrono
      // continuait de tourner après l'arrêt automatique parce que seule
      // `stopRecording` coupait l'intervalle. On ne se fie donc plus à
      // "est-ce que stopRecording a été appelé", mais à un flag explicite
      // posé uniquement quand c'est l'utilisateur qui a cliqué sur Stop.
      recorder.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        releaseWakeLock();

        if (!userInitiatedStopRef.current) {
          setMicInterrupted(true);
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        audioBlobRef.current = blob;

        // Vérifie que la durée réellement capturée correspond au temps
        // écoulé — si le micro a été coupé en cours de route, ça se verra
        // ici plutôt que de découvrir un fichier tronqué après coup.
        const wallClockSeconds = startTimeRef.current
          ? (Date.now() - startTimeRef.current) / 1000
          : elapsed;
        const actualDuration = await getAudioDuration(blob);
        if (Number.isFinite(actualDuration) && actualDuration < wallClockSeconds * 0.9 - 5) {
          const missing = Math.round(wallClockSeconds - actualDuration);
          setDurationWarning(
            `L'audio capturé (${formatElapsed(Math.round(actualDuration))}) est plus court que ` +
              `la durée de l'enregistrement (${formatElapsed(Math.round(wallClockSeconds))}) : ` +
              `environ ${formatElapsed(missing)} semblent manquants, probablement dus à une ` +
              `interruption (mise en veille, micro coupé...). Vérifie le contenu avant de continuer.`
          );
        }

        setPhase("stopped");
      };

      // Détecte une vraie coupure du micro (permission révoquée, appareil
      // déconnecté, ou accès suspendu par le système) pendant l'enregistrement
      // — plutôt que de laisser le chrono tourner sur un flux mort en silence.
      // `onstop` ci-dessus fait déjà le ménage/la détection de toute façon ;
      // ceci accélère juste l'arrêt effectif du MediaRecorder dès que la
      // piste meurt, au lieu d'attendre le prochain chunk.
      const [track] = stream.getAudioTracks();
      if (track) {
        track.onended = () => {
          if (phaseRef.current === "recording") {
            stopRecording();
          }
        };
      }

      userInitiatedStopRef.current = false;
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setPhase("recording");
      setElapsed(0);
      startTimeRef.current = Date.now();
      acquireWakeLock();

      // Le décompte se recalcule depuis l'horodatage de départ (pas un
      // simple +1 par tick) : setInterval est fortement throttlé par les
      // navigateurs quand l'onglet est en arrière-plan, mais dès qu'un tick
      // finit par s'exécuter, on retombe sur le vrai temps écoulé au lieu
      // d'accumuler un retard. L'enregistrement audio lui-même (MediaRecorder)
      // n'est pas concerné par ce throttling : il continue de capturer.
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
    } catch (err) {
      setErrorMessage(
        "Impossible d'accéder au micro. Vérifie les autorisations de ton navigateur."
      );
    }
  }

  function handleStopClick() {
    userInitiatedStopRef.current = true;
    stopRecording();
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    releaseWakeLock();
  }

  async function resolveSubjectId(userId: string): Promise<string | null> {
    if (subjectId === "new") {
      const name = newSubjectName.trim();
      if (!name) return null;
      const existing = subjects.find((s) => s.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing.id;

      const { data, error } = await supabase
        .from("subjects")
        .insert({ user_id: userId, name })
        .select()
        .single();
      if (error) throw error;
      setSubjects((prev) => [...prev, data as Subject]);
      return (data as Subject).id;
    }
    return subjectId || null;
  }

  async function submitCourse() {
    if (!audioBlobRef.current) return;
    setPhase("uploading");
    setErrorMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée, reconnecte-toi.");

      const subjectIdResolved = await resolveSubjectId(user.id);

      const courseId = crypto.randomUUID();
      const mimeType = audioBlobRef.current.type || "audio/webm";
      const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
      const path = `${user.id}/${courseId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("course-audio")
        .upload(path, audioBlobRef.current, { contentType: mimeType, upsert: true });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("courses").insert({
        id: courseId,
        user_id: user.id,
        subject_id: subjectIdResolved,
        status: "processing",
        audio_path: path,
      });
      if (insertError) throw insertError;

      setPhase("processing");

      const res = await fetch("/api/courses/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Le traitement a échoué.");
      }

      router.push(`/dashboard/course/${courseId}`);
    } catch (err: any) {
      setPhase("error");
      setErrorMessage(err.message || "Une erreur est survenue.");
    }
  }

  const canRecord =
    subjectId !== "new" || newSubjectName.trim().length > 0 || subjects.length > 0;

  return (
    <div className="mx-auto max-w-lg">
      {(phase === "ready" || phase === "recording") && (
        <div className="mb-8">
          <label className="mb-2 block text-sm font-medium text-ink/70">Matière</label>
          <div className="flex gap-2">
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={phase === "recording"}
              className="flex-1 rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm outline-none focus:border-ink"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="new">+ Nouvelle matière</option>
            </select>
          </div>
          {subjectId === "new" && (
            <input
              type="text"
              placeholder="Ex : Sociologie"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              disabled={phase === "recording"}
              className="mt-2 w-full rounded-xl border border-ink/15 px-4 py-3 text-sm outline-none focus:border-ink"
            />
          )}
        </div>
      )}

      <div className="flex flex-col items-center rounded-3xl border border-ink/10 bg-white p-10 text-center">
        <div className="text-4xl font-black tabular-nums text-ink">
          {formatElapsed(elapsed)}
        </div>

        {phase === "ready" && (
          <button
            onClick={startRecording}
            disabled={!canRecord}
            className="mt-8 flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:scale-105 disabled:opacity-40"
            aria-label="Démarrer l'enregistrement"
          >
            <span className="text-2xl">●</span>
          </button>
        )}

        {phase === "recording" && (
          <>
            <p className="mt-4 animate-pulse text-sm font-medium text-red-500">
              Enregistrement en cours...
            </p>
            <p className="mt-1 text-xs text-ink/40">
              Tu peux changer d'onglet, l'enregistrement continue en arrière-plan.
            </p>
            <button
              onClick={handleStopClick}
              className="mt-6 flex h-20 w-20 items-center justify-center rounded-full bg-ink text-cream shadow-lg transition hover:scale-105"
              aria-label="Arrêter l'enregistrement"
            >
              <span className="text-xl">■</span>
            </button>
          </>
        )}

        {phase === "stopped" && (
          <>
            {micInterrupted && (
              <p className="mt-4 max-w-sm text-sm font-medium text-red-600">
                Le micro a été coupé pendant l'enregistrement (mise en veille, permission
                révoquée...) — l'enregistrement a été arrêté automatiquement.
              </p>
            )}
            {durationWarning && (
              <p className="mt-4 max-w-sm text-sm font-medium text-amber-600">
                ⚠️ {durationWarning}
              </p>
            )}
            <p className="mt-4 text-sm font-medium text-ink/70">
              Cours enregistré ({formatElapsed(elapsed)}). Prêt à être traité.
            </p>
            <button
              onClick={submitCourse}
              className="mt-6 rounded-full bg-ink px-8 py-4 text-sm font-semibold text-cream transition hover:scale-105"
            >
              Terminer et traiter
            </button>
          </>
        )}

        {(phase === "uploading" || phase === "processing") && (
          <p className="mt-6 max-w-xs text-sm text-ink/70">
            {phase === "uploading"
              ? "Envoi de l'audio..."
              : "Lancement du traitement — tu vas être redirigé, la transcription continue en arrière-plan."}
          </p>
        )}

        {phase === "error" && (
          <>
            <p className="mt-6 text-sm text-red-600">{errorMessage}</p>
            <button
              onClick={submitCourse}
              className="mt-4 rounded-full border border-ink px-6 py-3 text-sm font-semibold text-ink"
            >
              Réessayer
            </button>
          </>
        )}

        {errorMessage && phase === "ready" && (
          <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
