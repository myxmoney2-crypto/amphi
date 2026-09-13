import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CourseTabs from "@/components/lesson/CourseTabs";
import ProcessingWatcher from "@/components/lesson/ProcessingWatcher";
import RetryButton from "@/components/lesson/RetryButton";
import { courseTitle } from "@/lib/format";
import { hasFullAccess, type Course, type Lesson, type MindMap, type Profile, type Quiz } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user!.id)
    .single<Course>();

  if (!course) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  const title = course.title || courseTitle(course.course_number, course.created_at);

  if (course.status === "processing") {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <ProcessingWatcher courseId={course.id} />
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        <p className="max-w-sm text-sm text-ink/60">
          Transcription et structuration en cours — cette page se met à jour toute seule
          dès que c'est prêt, pas besoin de recharger.
        </p>
      </div>
    );
  }

  if (course.status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        <p className="max-w-md text-sm text-red-600">
          {course.error_message || "Le traitement de ce cours a échoué."}
        </p>
        <RetryButton courseId={course.id} />
      </div>
    );
  }

  const [{ data: lesson }, { data: quiz }, { data: mindmap }] = await Promise.all([
    supabase.from("lessons").select("*").eq("course_id", course.id).single<Lesson>(),
    supabase.from("quizzes").select("*").eq("course_id", course.id).single<Quiz>(),
    supabase.from("mindmaps").select("*").eq("course_id", course.id).single<MindMap>(),
  ]);

  return (
    <div>
      <a href="/dashboard" className="text-sm text-ink/40 hover:text-ink">
        ← Retour au dashboard
      </a>
      <h1 className="mt-2 text-2xl font-bold text-ink">{title}</h1>

      <div className="mt-8">
        <CourseTabs
          courseId={course.id}
          lessonBlocks={lesson?.content ?? []}
          quizQuestions={quiz?.questions ?? []}
          mindmapData={mindmap?.data ?? { title }}
          hasFullAccess={hasFullAccess(profile)}
        />
      </div>
    </div>
  );
}
