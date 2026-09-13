import HoloBlob from "@/components/landing/HoloBlob";
import AmphiScene from "@/components/landing/AmphiScene";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-paleblue via-cream to-cream">
      {/* Formes flottantes décoratives — dispersées sur toute la page, réagissent au survol */}
      <HoloBlob size={220} className="animate-float absolute -left-16 top-24 hidden md:block" />
      <HoloBlob
        size={140}
        variant="ring"
        color="#a78bfa"
        className="animate-floatSlow absolute right-10 top-6 hidden md:block"
      />
      <HoloBlob
        size={70}
        variant="dot"
        color="#7ee8fa"
        className="animate-float absolute right-1/3 top-40 hidden md:block"
      />
      <HoloBlob
        size={130}
        className="animate-float absolute bottom-10 left-1/4 hidden md:block"
      />
      <HoloBlob
        size={90}
        variant="ring"
        color="#ff9ecb"
        className="animate-floatSlow absolute bottom-40 right-16 hidden md:block"
      />
      <HoloBlob
        size={50}
        variant="dot"
        color="#ffd166"
        className="animate-floatSlow absolute left-16 top-1/2 hidden lg:block"
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
        <span className="text-2xl font-black tracking-tight text-ink">AMFI</span>
        <nav>
          <a
            href={user ? "/dashboard" : "/login"}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream transition hover:scale-105"
          >
            {user ? "Mon espace" : "Se connecter"}
          </a>
        </nav>
      </header>

      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pb-24 pt-16 text-center md:pt-20">
        <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-ink sm:text-6xl md:text-7xl">
          Focus sur le prof.
          <br />
          Le reste est géré.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink/70">
          Enregistre ton cours en amphi. AMFI transcrit, nettoie et transforme l'audio en
          leçon structurée, quiz et carte mentale — prêts à réviser.
        </p>

        <div className="relative mt-10 w-full max-w-3xl">
          <HoloBlob
            size={60}
            variant="dot"
            color="#ff9ecb"
            className="animate-float absolute -left-4 top-4 hidden sm:block"
          />
          <HoloBlob
            size={80}
            variant="ring"
            color="#8bb4ff"
            className="animate-floatSlow absolute -right-6 bottom-6 hidden sm:block"
          />
          <AmphiScene className="mx-auto h-[340px] w-full md:h-[460px]" />
        </div>

        <div className="mt-8">
          <a
            href={user ? "/starting" : "/login?next=/starting"}
            className="rounded-full bg-ink px-8 py-4 text-base font-semibold text-cream shadow-lg transition hover:scale-105 hover:shadow-xl"
          >
            Faire mon nouveau cours
          </a>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-24 text-center">
        <HoloBlob
          size={100}
          variant="ring"
          color="#a78bfa"
          className="animate-float absolute -right-4 -top-6 hidden md:block"
        />
        <div className="rounded-3xl border border-ink/10 bg-white/60 p-8 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink/50">
            Comment ça marche
          </p>
          <div className="mt-6 grid gap-6 text-left sm:grid-cols-3">
            <div>
              <p className="text-3xl font-black text-ink">1</p>
              <p className="mt-2 text-sm text-ink/70">
                Tu enregistres ton cours d'un bout à l'autre, sans rien noter.
              </p>
            </div>
            <div>
              <p className="text-3xl font-black text-ink">2</p>
              <p className="mt-2 text-sm text-ink/70">
                L'IA transcrit, déduplique et structure une vraie leçon lisible.
              </p>
            </div>
            <div>
              <p className="text-3xl font-black text-ink">3</p>
              <p className="mt-2 text-sm text-ink/70">
                Tu révises avec un quiz et une carte mentale générés automatiquement.
              </p>
            </div>
          </div>
        </div>
        <HoloBlob
          size={50}
          variant="dot"
          color="#7ee8fa"
          className="animate-floatSlow absolute -bottom-4 left-1/4 hidden md:block"
        />
      </section>
    </main>
  );
}
