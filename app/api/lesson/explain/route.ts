import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// Instancié à la première utilisation pour ne pas exiger ANTHROPIC_API_KEY
// au moment du build.
let anthropic: Anthropic | null = null;
function getClient(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return anthropic;
}

/**
 * "Demander une explication à AMFI" sur un passage surligné dans la leçon.
 * Requête courte et isolée : Haiku plutôt que le modèle principal utilisé
 * pour la structuration complète du cours (moins cher, largement suffisant
 * pour reformuler un passage simplement).
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { selectedText, contextText } = await request.json().catch(() => ({}));
  if (!selectedText || typeof selectedText !== "string" || !selectedText.trim()) {
    return NextResponse.json({ error: "Passage surligné manquant." }, { status: 400 });
  }

  const trimmedSelection = selectedText.slice(0, 500);
  const trimmedContext = typeof contextText === "string" ? contextText.slice(0, 2000) : "";

  try {
    const message = await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 350,
      system:
        "Tu es AMFI, un assistant pédagogique sympathique et encourageant. Un·e étudiant·e vient " +
        "de surligner un passage de son cours parce qu'il/elle ne le comprend pas bien et te " +
        "demande une explication. Explique le terme ou l'idée surligné(e) simplement et " +
        "clairement, comme à un·e ami·e, en t'appuyant sur le contexte du paragraphe fourni pour " +
        "rester pertinent·e par rapport au cours. Reste court (3 à 5 phrases maximum). " +
        "Ponctuation : n'utilise presque exclusivement que des virgules et des points, évite les " +
        "tirets. Ne répète pas la consigne, réponds directement.",
      messages: [
        {
          role: "user",
          content:
            `Passage surligné : "${trimmedSelection}"\n\n` +
            `Contexte (paragraphe du cours) : "${trimmedContext}"\n\n` +
            "Explique ce passage simplement.",
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const explanation =
      textBlock && textBlock.type === "text"
        ? textBlock.text.trim()
        : "Désolé, je n'ai pas réussi à générer d'explication.";

    return NextResponse.json({ explanation });
  } catch (err) {
    return NextResponse.json(
      { error: "Erreur lors de la génération de l'explication." },
      { status: 500 }
    );
  }
}
