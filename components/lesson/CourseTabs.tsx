"use client";

import { useState } from "react";
import LessonViewer from "./LessonViewer";
import QuizView, { type QuizMode } from "./QuizView";
import MindMap from "./MindMap";
import type { LessonBlock, MindMapNode, QuizQuestion } from "@/lib/types";

type Tab = "lesson" | "quiz" | "mindmap";

export default function CourseTabs({
  courseId,
  lessonBlocks,
  quizQuestions,
  mindmapData,
  hasFullAccess,
}: {
  courseId: string;
  lessonBlocks: LessonBlock[];
  quizQuestions: QuizQuestion[];
  mindmapData: MindMapNode;
  hasFullAccess: boolean;
}) {
  const [tab, setTab] = useState<Tab>("lesson");

  // Levé ici (plutôt que local à QuizView) pour survivre à un aller-retour
  // vers l'onglet Leçon pendant la phase de relecture du mode "S'exercer".
  const [quizMode, setQuizMode] = useState<QuizMode | null>(null);
  const [quizStartedAt, setQuizStartedAt] = useState<number | null>(null);

  const tabs: { key: Tab; label: string }[] = [
    { key: "lesson", label: "Leçon" },
    { key: "quiz", label: "Quiz" },
    { key: "mindmap", label: "Carte mentale" },
  ];

  return (
    <div>
      <div className="mb-6 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition ${
              tab === t.key ? "bg-ink text-cream" : "bg-white text-ink/60 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "lesson" && (
        <LessonViewer courseId={courseId} initialBlocks={lessonBlocks} hasFullAccess={hasFullAccess} />
      )}
      {tab === "quiz" && (
        <QuizView
          questions={quizQuestions}
          hasFullAccess={hasFullAccess}
          mode={quizMode}
          onSelectMode={setQuizMode}
          startedAt={quizStartedAt}
          onStart={() => setQuizStartedAt(Date.now())}
          onRestart={() => {
            setQuizMode(null);
            setQuizStartedAt(null);
          }}
          onGoToLesson={() => setTab("lesson")}
        />
      )}
      {tab === "mindmap" && <MindMap data={mindmapData} hasFullAccess={hasFullAccess} />}
    </div>
  );
}
