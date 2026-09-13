"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RetryButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function retry() {
    setLoading(true);
    await fetch("/api/courses/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={retry}
      disabled={loading}
      className="mt-2 rounded-full border border-ink px-6 py-3 text-sm font-semibold text-ink disabled:opacity-50"
    >
      {loading ? "Relance..." : "Réessayer"}
    </button>
  );
}
