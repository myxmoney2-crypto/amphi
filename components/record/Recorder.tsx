"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Subject } from "@/lib/types";

type Phase = "setup" | "ready" | "recording" | "stopped" | "uploading" | "processing" | "error";

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
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startRecording() {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        audioBlobRef.current = new Blob(chunksRef.current, { type: mimeType });
        setPhase("stopped");
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setPhase("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err) {
      setErrorMessage(
        "Impossible d'accéder au micro. Vérifie les autorisations de ton navigateur."
      );
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
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
            <button
              onClick={stopRecording}
              className="mt-6 flex h-20 w-20 items-center justify-center rounded-full bg-ink text-cream shadow-lg transition hover:scale-105"
              aria-label="Arrêter l'enregistrement"
            >
              <span className="text-xl">■</span>
            </button>
          </>
        )}

        {phase === "stopped" && (
          <>
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
