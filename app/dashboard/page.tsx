import { createClient } from "@/lib/supabase/server";
import CourseList from "@/components/dashboard/CourseList";
import type { Course, Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: courses }, { data: subjects }] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase.from("subjects").select("*").eq("user_id", user!.id).order("name"),
  ]);

  const allCourses = (courses ?? []) as Course[];
  const allSubjects = (subjects ?? []) as Subject[];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Mes cours</h1>
          <p className="mt-1 text-sm text-ink/50">
            {allCourses.length} cours enregistré{allCourses.length > 1 ? "s" : ""}
          </p>
        </div>
        <a
          href="/dashboard/new"
          className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream transition hover:scale-105"
        >
          + Nouveau cours
        </a>
      </div>

      <CourseList userId={user!.id} initialCourses={allCourses} subjects={allSubjects} />
    </div>
  );
}
