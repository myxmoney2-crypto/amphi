"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import KeyboardScene from "@/components/landing/KeyboardScene";
import HoloBlob from "@/components/landing/HoloBlob";

type Phase = "appearing" | "holding" | "vanishing";

const HOLD_AT_MS = 500; // fin du zoom d'apparition
const VANISH_AT_MS = 1400; // fin du palier, début de la disparition
const NAVIGATE_AT_MS = 2100; // fin de la disparition → page suivante

/**
 * Écran de transition à part entière (pas une superposition sur la landing
 * page) : le clavier 3D apparaît, reste un instant, puis disparaît — une
 * fois l'animation terminée, on enchaîne automatiquement sur la page de
 * création du cours.
 */
export default function StartingCoursePage() {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("appearing");

  useEffect(() => {
    wrapRef.current?.classList.add("keyboard-appear");

    const t1 = setTimeout(() => setPhase("holding"), HOLD_AT_MS);
    const t2 = setTimeout(() => {
      setPhase("vanishing");
      wrapRef.current?.classList.remove("keyboard-appear");
      wrapRef.current?.classList.add("keyboard-zoom-vanish");
    }, VANISH_AT_MS);
    const t3 = setTimeout(() => {
      router.push("/dashboard/new");
    }, NAVIGATE_AT_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [router]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-paleblue via-cream to-cream px-6">
      <HoloBlob
        size={170}
        variant="ring"
        color="#a78bfa"
        className="animate-float absolute -left-10 top-20 hidden sm:block"
      />
      <HoloBlob
        size={90}
        variant="dot"
        color="#ff9ecb"
        className="animate-floatSlow absolute right-16 top-16 hidden sm:block"
      />
      <HoloBlob
        size={210}
        className="animate-floatSlow absolute -bottom-16 -left-12 hidden sm:block"
      />
      <HoloBlob
        size={70}
        variant="ring"
        color="#8bb4ff"
        className="animate-float absolute bottom-24 right-14 hidden sm:block"
      />
      <HoloBlob
        size={50}
        variant="dot"
        color="#ffd166"
        className="animate-floatSlow absolute right-1/3 bottom-10 hidden lg:block"
      />

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        <div ref={wrapRef} className="h-56 w-80 md:h-64 md:w-[26rem]">
          <KeyboardScene className="h-full w-full" />
        </div>
        <p className="animate-pop-in text-2xl font-black text-ink sm:text-3xl">
          Plus besoin d'écrire.
        </p>
        <p className="text-sm text-ink/50">
          {phase === "vanishing" ? "C'est parti..." : "Préparation de ton cours..."}
        </p>
      </div>
    </main>
  );
}
