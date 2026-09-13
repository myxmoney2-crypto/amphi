export function formatCourseDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
}

export function courseTitle(courseNumber: number, createdAt: string): string {
  return `Cours n°${courseNumber} — ${formatCourseDate(createdAt)}`;
}
