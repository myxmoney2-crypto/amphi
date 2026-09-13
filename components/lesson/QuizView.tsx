"use client";

import { useEffect, useState } from "react";
import { FREE_QUIZ_LIMIT, type QuizQuestion } from "@/lib/types";
import UpgradeOverlay from "@/components/ui/UpgradeOverlay";

export type QuizMode = "controle" | "exercice";

const EXERCICE_SECONDS = 5 * 60;

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function QuestionCard({
  question,
  index,
  selected,
  submitted,
  onSelect,
}: {
  question: QuizQuestion;
  index: number;
  selected: number | undefined;
  submitted: boolean;
  onSelect: (optionIndex: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-6">
      <p className="font-semibold text-ink">
        {index + 1}. {question.question}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {question.options.map((option, optIndex) => {
          const isSelected = selected === optIndex;
          const isCorrect = submitted && optIndex === question.correctIndex;
          const isWrongSelected = submitted && isSelected && optIndex !== question.correctIndex;

          return (
            <button
              key={optIndex}
              onClick={() => onSelect(optIndex)}
              className={`rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                isCorrect
                  ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                  : isWrongSelected
                    ? "border-red-300 bg-red-50 text-red-700"
                    : isSelected
                      ? "border-ink bg-ink/5"
                      : "border-ink/10 hover:border-ink/30"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {submitted && question.explanation && (
        <p className="mt-3 text-xs text-ink/50">{question.explanation}</p>
      )}
    </div>
  );
}

export default function QuizView({
  questions,
  hasFullAccess,
  mode,
  onSelectMode,
  startedAt,
  onStart,
  onRestart,
  onGoToLesson,
}: {
  questions: QuizQuestion[];
  hasFullAccess: boolean;
  mode: QuizMode | null;
  onSelectMode: (mode: QuizMode) => void;
  startedAt: number | null;
  onStart: () => void;
  onRestart: () => void;
  onGoToLesson: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [remaining, setRemaining] = useState(EXERCICE_SECONDS);

  // Le décompte se recalcule depuis `startedAt` (pas un simple compteur
  // local) pour rester correct même si le composant est remonté (ex :
  // l'élève va et vient entre l'onglet Leçon et l'onglet Quiz).
  useEffect(() => {
    if (mode !== "exercice" || startedAt === null || submitted) return;

    function tick() {
      const left = EXERCICE_SECONDS - Math.floor((Date.now() - (startedAt as number)) / 1000);
      if (left <= 0) {
        setRemaining(0);
        setSubmitted(true);
      } else {
        setRemaining(left);
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [mode, startedAt, submitted]);

  if (!questions?.length) {
    return <p className="text-sm text-ink/50">Aucun quiz disponible pour ce cours.</p>;
  }

  if (mode === null) {
    return (
      <div className="rounded-3xl border border-ink/10 bg-white p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-ink/40">
          Avant de commencer
        </p>
        <h3 className="mt-2 text-lg font-bold text-ink">Comment veux-tu faire ce quiz ?</h3>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => onSelectMode("controle")}
            className="rounded-2xl border-2 border-ink/10 p-5 text-left transition hover:border-ink"
          >
            <p className="font-semibold text-ink">Contrôle</p>
            <p className="mt-1 text-sm text-ink/60">Sans contrainte de temps, à ton rythme.</p>
          </button>
          <button
            onClick={() => onSelectMode("exercice")}
            className="rounded-2xl border-2 border-ink/10 p-5 text-left transition hover:border-ink"
          >
            <p className="font-semibold text-ink">S'exercer</p>
            <p className="mt-1 text-sm text-ink/60">
              Relis la leçon à ton rythme, puis {Math.round(EXERCICE_SECONDS / 60)} min chrono
              pour te mettre en conditions d'examen.
            </p>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "exercice" && startedAt === null) {
    return (
      <div className="rounded-3xl border border-ink/10 bg-white p-8 text-center">
        <p className="text-3xl">📖</p>
        <h3 className="mt-3 text-lg font-bold text-ink">Relis la leçon à ton rythme</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink/60">
          Pas de minuteur pendant la lecture. Quand tu es prêt(e), lance le quiz : tu auras{" "}
          {Math.round(EXERCICE_SECONDS / 60)} minutes pour répondre.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            onClick={onGoToLesson}
            className="rounded-full border border-ink px-6 py-2.5 text-sm font-semibold text-ink"
          >
            Relire la leçon
          </button>
          <button
            onClick={onStart}
            className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream"
          >
            Je suis prêt(e), lancer le quiz
          </button>
        </div>
      </div>
    );
  }

  const visibleQuestions = hasFullAccess ? questions : questions.slice(0, FREE_QUIZ_LIMIT);
  const lockedQuestions = hasFullAccess ? [] : questions.slice(FREE_QUIZ_LIMIT);

  const score = visibleQuestions.reduce(
    (acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0),
    0
  );

  function selectAnswer(qIndex: number, optionIndex: number) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: optionIndex }));
  }

  function handleRestart() {
    setAnswers({});
    setSubmitted(false);
    setRemaining(EXERCICE_SECONDS);
    onRestart();
  }

  return (
    <div className="flex flex-col gap-6">
      {mode === "exercice" && !submitted && (
        <div
          className={`self-start rounded-full px-4 py-1.5 text-sm font-semibold ${
            remaining <= 60 ? "bg-red-100 text-red-700" : "bg-ink/5 text-ink/70"
          }`}
        >
          ⏱ {formatTime(remaining)}
        </div>
      )}

      {visibleQuestions.map((q, qIndex) => (
        <QuestionCard
          key={qIndex}
          question={q}
          index={qIndex}
          selected={answers[qIndex]}
          submitted={submitted}
          onSelect={(optionIndex) => selectAnswer(qIndex, optionIndex)}
        />
      ))}

      {lockedQuestions.length > 0 && (
        <UpgradeOverlay message="Débloque les questions restantes de ce quiz avec l'offre payante AMFI.">
          <div className="flex flex-col gap-6">
            {lockedQuestions.map((q, i) => (
              <QuestionCard
                key={i}
                question={q}
                index={visibleQuestions.length + i}
                selected={undefined}
                submitted={false}
                onSelect={() => {}}
              />
            ))}
          </div>
        </UpgradeOverlay>
      )}

      <div className="flex items-center gap-4">
        {!submitted ? (
          <button
            onClick={() => setSubmitted(true)}
            disabled={Object.keys(answers).length < visibleQuestions.length}
            className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream disabled:opacity-40"
          >
            Valider le quiz
          </button>
        ) : (
          <>
            <p className="font-semibold text-ink">
              Score : {score} / {visibleQuestions.length}
            </p>
            <button
              onClick={handleRestart}
              className="rounded-full border border-ink px-6 py-3 text-sm font-semibold text-ink"
            >
              Recommencer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
