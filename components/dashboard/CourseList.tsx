"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CourseCard from "./CourseCard";
import type { Course, Subject } from "@/lib/types";

export default function CourseList({
  userId,
  initialCourses,
  subjects,
}: {
  userId: string;
  initialCourses: Course[];
  subjects: Subject[];
}) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`dashboard-courses-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "courses", filter: `user_id=eq.${userId}` },
        (payload: any) => {
          setCourses((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((c) => c.id !== payload.old.id);
            }
            const next = payload.new as Course;
            const exists = prev.some((c) => c.id === next.id);
            if (exists) {
              return prev.map((c) => (c.id === next.id ? next : c));
            }
            return [next, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (courses.length === 0) {
    return (
      <div className="mt-16 rounded-3xl border border-dashed border-ink/20 p-12 text-center">
        <p className="text-ink/60">Tu n'as pas encore de cours enregistré.</p>
        <a
          href="/dashboard/new"
          className="mt-4 inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream"
        >
          Faire ton premier cours
        </a>
      </div>
    );
  }

  const bySubject = new Map<string | null, Course[]>();
  for (const c of courses) {
    const key = c.subject_id;
    if (!bySubject.has(key)) bySubject.set(key, []);
    bySubject.get(key)!.push(c);
  }

  const groups: { label: string; courses: Course[] }[] = [];
  for (const subject of subjects) {
    const list = bySubject.get(subject.id);
    if (list?.length) groups.push({ label: subject.name, courses: list });
  }
  const unclassified = bySubject.get(null);
  if (unclassified?.length) groups.push({ label: "Sans matière", courses: unclassified });

  return (
    <div className="mt-10 flex flex-col gap-10">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink/40">
            {group.label}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
