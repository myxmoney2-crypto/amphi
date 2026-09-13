import type { Course } from "@/lib/types";
import { courseTitle } from "@/lib/format";

const STATUS_LABEL: Record<Course["status"], string> = {
  recording: "En cours d'enregistrement",
  processing: "Traitement en cours...",
  done: "Prêt",
  error: "Erreur de traitement",
};

const STATUS_STYLE: Record<Course["status"], string> = {
  recording: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  done: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
};

export default function CourseCard({ course }: { course: Course }) {
  const title = course.title || courseTitle(course.course_number, course.created_at);

  return (
    <a
      href={`/dashboard/course/${course.id}`}
      className="block rounded-2xl border border-ink/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-ink">{title}</h3>
        <span
          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[course.status]}`}
        >
          {STATUS_LABEL[course.status]}
        </span>
      </div>
      <p className="mt-2 text-sm text-ink/50">
        {new Date(course.created_at).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
    </a>
  );
}
