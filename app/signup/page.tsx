"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          next
        )}`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-paleblue to-cream px-6">
        <div className="w-full max-w-sm rounded-3xl border border-ink/10 bg-white/80 p-8 text-center shadow-sm backdrop-blur">
          <h1 className="text-xl font-bold text-ink">Vérifie ta boîte mail 📬</h1>
          <p className="mt-3 text-sm text-ink/70">
            On t'a envoyé un lien de confirmation à <strong>{email}</strong>. Clique dessus
            pour activer ton compte AMFI.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-paleblue to-cream px-6">
      <div className="w-full max-w-sm">
        <a href="/" className="mb-8 block text-center text-2xl font-black text-ink">
          AMFI
        </a>
        <div className="rounded-3xl border border-ink/10 bg-white/80 p-8 shadow-sm backdrop-blur">
          <h1 className="text-xl font-bold text-ink">Créer un compte</h1>
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <input
              type="text"
              required
              placeholder="Prénom"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded-xl border border-ink/15 px-4 py-3 text-sm outline-none focus:border-ink"
            />
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
              minLength={6}
              placeholder="Mot de passe (6 caractères min.)"
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
              {loading ? "Création..." : "Créer mon compte"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-ink/60">
            Déjà un compte ?{" "}
            <a href="/login" className="font-semibold text-ink underline">
              Se connecter
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
