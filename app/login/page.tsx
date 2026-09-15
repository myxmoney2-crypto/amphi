"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/ui/Logo";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(
        error.message === "Email not confirmed"
          ? "Confirme d'abord ton email (regarde ta boîte mail)."
          : "Email ou mot de passe incorrect."
      );
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-paleblue to-cream px-6">
      <div className="w-full max-w-sm">
        <a href="/" className="mb-8 flex justify-center">
          <Logo />
        </a>
        <div className="rounded-3xl border border-ink/10 bg-white/80 p-8 shadow-sm backdrop-blur">
          <h1 className="text-xl font-bold text-ink">Se connecter</h1>
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-ink/15 px-4 py-3 text-sm outline-none focus:border-ink"
            />
            <input
              type="password"
              required
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-ink/15 px-4 py-3 text-sm outline-none focus:border-ink"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream transition hover:scale-[1.02] disabled:opacity-60"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-ink/60">
            Pas encore de compte ?{" "}
            <a href="/signup" className="font-semibold text-ink underline">
              Créer un compte
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
