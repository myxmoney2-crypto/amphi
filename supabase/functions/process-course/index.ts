// Edge Function Supabase (Deno) — traitement asynchrone d'un cours.
//
// Déclenchée par une requête POST courte depuis l'app Next.js ({ courseId }).
// Elle répond immédiatement (202) puis continue le vrai travail (Whisper +
// Claude, potentiellement plusieurs minutes) en arrière-plan via
// EdgeRuntime.waitUntil — donc complètement affranchie de la limite de 60s
// des fonctions serverless Vercel. Le statut du cours (`processing` →
// `done`/`error`) est mis à jour en base ; le front s'y abonne en Realtime.
//
// Déploiement : supabase functions deploy process-course
// Secrets requis : supabase secrets set OPENAI_API_KEY=... ANTHROPIC_API_KEY=...
// (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectées automatiquement)

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const CLAUDE_MODEL = "claude-sonnet-5";

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Les blocs de leçon sont rendus côté client comme du HTML (pour que
// l'élève puisse y ajouter gras/souligné/surlignage) : on échappe le texte
// brut de Claude une fois pour toutes ici, à la source.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function transcribeAudio(audioBlob: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", audioBlob, filename);
  form.append("model", "whisper-1");
  form.append("language", "fr");
  form.append("response_format", "text");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Whisper a échoué (${res.status}) : ${await res.text()}`);
  }
  return await res.text();
}

// Whisper plafonne à 25 Mo PAR FICHIER — un cours d'1h20+ dépasse cette
// limite. `audio_path` pointe donc vers un DOSSIER de segments (chacun un
// webm valide à part entière, produit par des MediaRecorder successifs côté
// client, jamais un simple découpage d'octets) : on les liste, on les
// transcrit un par un (séquentiellement, pour rester sous les limites de
// débit de l'API), puis on concatène. Rétrocompatible avec les cours
// enregistrés avant ce changement, où `audio_path` pointait directement
// vers un fichier unique (le `list()` sur ce chemin renvoie alors une liste
// vide, et on retombe sur un téléchargement direct).
async function transcribeCourseAudio(
  admin: SupabaseClient,
  audioPathOrPrefix: string
): Promise<string> {
  const { data: entries } = await admin.storage.from("course-audio").list(audioPathOrPrefix);

  const segmentPaths = (entries ?? [])
    .filter((e: { name: string }) => e.name && !e.name.endsWith("/"))
    .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
    .map((e: { name: string }) => `${audioPathOrPrefix}/${e.name}`);

  if (segmentPaths.length === 0) {
    segmentPaths.push(audioPathOrPrefix);
  }

  const transcripts: string[] = [];
  for (const path of segmentPaths) {
    const { data: audioFile, error: downloadError } = await admin.storage
      .from("course-audio")
      .download(path);
    if (downloadError || !audioFile) {
      throw new Error(`Impossible de récupérer le segment audio : ${path}`);
    }
    if (audioFile.size < 1000) continue; // segment quasi vide (bascule juste avant l'arrêt) : ignoré

    const filename = path.split("/").pop() || "segment.webm";
    const text = await transcribeAudio(audioFile, filename);
    if (text && text.trim()) transcripts.push(text.trim());
  }

  return transcripts.join("\n\n");
}

async function callClaudeTool(
  system: string,
  userContent: string,
  tool: Record<string, unknown>
): Promise<any> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      // Le system prompt et le tool sont identiques à chaque appel, pour
      // tous les cours de tous les utilisateurs — on marque le system prompt
      // comme cache Anthropic (ephemeral, ~5 min glissants) pour qu'il ne
      // soit facturé plein tarif qu'à la première requête dans la fenêtre ;
      // les suivantes ne paient qu'une fraction du prix sur cette partie.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: [tool],
      tool_choice: { type: "tool", name: (tool as any).name },
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Claude a échoué (${res.status}) : ${await res.text()}`);
  }
  const data = await res.json();
  const toolUse = data.content?.find((b: any) => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude n'a pas retourné de résultat structuré.");
  return toolUse.input;
}

// Un seul appel Claude produit la leçon structurée + le quiz + la carte
// mentale directement à partir de la transcription brute — auparavant
// c'étaient deux appels séparés, le second renvoyant en entrée la leçon que
// Claude venait tout juste de générer (des tokens payés deux fois pour rien).
async function generateCoursePackage(rawTranscript: string) {
  const tool = {
    name: "submit_course_package",
    description: "Soumet la leçon structurée, le quiz et la carte mentale du cours.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre court du cours (matière + sujet)." },
        blocks: {
          type: "array",
          description: "La leçon, nettoyée et structurée en blocs.",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["heading", "subheading", "definition", "paragraph"],
              },
              text: { type: "string" },
            },
            required: ["type", "text"],
          },
        },
        quiz: {
          type: "array",
          description: "5 à 10 questions à choix multiples basées sur la leçon ci-dessus.",
          minItems: 5,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
              correctIndex: { type: "integer", minimum: 0, maximum: 3 },
              explanation: { type: "string" },
            },
            required: ["question", "options", "correctIndex"],
          },
        },
        mindmap: {
          type: "object",
          description:
            "Carte mentale de la leçon ci-dessus (racine = titre du cours, max 3 niveaux).",
          properties: {
            title: { type: "string" },
            children: {
              type: "array",
              description: "Branches thématiques.",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  children: {
                    type: "array",
                    description: "Notions/définitions clés de la branche.",
                    items: {
                      type: "object",
                      properties: { title: { type: "string" } },
                      required: ["title"],
                    },
                  },
                },
                required: ["title"],
              },
            },
          },
          required: ["title"],
        },
      },
      required: ["title", "blocks", "quiz", "mindmap"],
    },
  };

  const system =
    "Tu es un assistant pédagogique. À partir de la transcription brute d'un cours magistral, tu " +
    "produis en une seule fois, en français : la leçon structurée, un quiz, et une carte mentale — " +
    "le quiz et la carte mentale doivent porter sur la leçon telle que tu viens de la structurer, " +
    "pas directement sur la transcription brute.\n\n" +
    "RÈGLES POUR LA LEÇON (blocks) :\n" +
    "1. Déduplique agressivement : la transcription contient souvent des répétitions (le prof qui " +
    "reformule, du bruit de fond mal transcrit). Ne garde qu'une seule occurrence de chaque idée.\n" +
    "2. Supprime le bruit non pédagogique : consignes de discipline, hésitations, digressions hors-sujet.\n" +
    "3. Organise le contenu par thème avec des titres (heading) et sous-titres (subheading).\n" +
    "4. Marque les définitions importantes avec le type 'definition', en gardant le format " +
    "\"Terme : explication\".\n" +
    "5. Le reste du contenu explicatif va dans des blocs 'paragraph'.\n" +
    "6. N'invente aucun contenu qui ne serait pas dans la transcription.\n" +
    "7. Ponctuation : n'utilise presque exclusivement que des virgules et des points. Évite " +
    "absolument les tirets moyens/cadratins (—) et les tirets utilisés comme séparateurs de " +
    "proposition : ils donnent un style trop reconnaissable comme 'généré par IA'. Préfère des " +
    "phrases courtes, reliées par des virgules ou simplement séparées par des points, pour un " +
    "rendu naturel, comme si un humain l'avait écrit.\n\n" +
    "RÈGLES POUR LE QUIZ :\n" +
    "8. 5 à 10 questions à choix multiples (4 options, une seule correcte), qui testent la " +
    "compréhension des notions clés, pas des détails anecdotiques.\n\n" +
    "RÈGLES POUR LA CARTE MENTALE :\n" +
    "9. Arbre hiérarchique, 2 à 3 niveaux max : la racine est le sujet du cours, les branches sont " +
    "les thèmes, les feuilles les notions/définitions clés.\n\n" +
    "Réponds uniquement via l'outil submit_course_package.";

  const input = await callClaudeTool(
    system,
    `Transcription brute du cours à traiter :\n\n"""\n${rawTranscript}\n"""`,
    tool
  );

  return {
    title: input.title as string,
    blocks: (input.blocks as { type: string; text: string }[]).map((b) => ({
      id: randomId(),
      type: b.type,
      text: escapeHtml(b.text),
    })),
    quiz: input.quiz,
    mindmap: input.mindmap,
  };
}

async function processCourse(admin: SupabaseClient, courseId: string) {
  try {
    const { data: course, error: courseError } = await admin
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .single();
    if (courseError || !course) throw new Error("Cours introuvable.");
    if (!course.audio_path) throw new Error("Aucun audio associé à ce cours.");

    const rawTranscript = await transcribeCourseAudio(admin, course.audio_path);
    if (!rawTranscript || rawTranscript.trim().length < 20) {
      throw new Error(
        "La transcription est vide — l'audio est peut-être trop court ou inaudible."
      );
    }

    const { title, blocks, quiz, mindmap } = await generateCoursePackage(rawTranscript);

    const { error: lessonError } = await admin
      .from("lessons")
      .upsert({ course_id: courseId, content: blocks }, { onConflict: "course_id" });
    if (lessonError) throw lessonError;

    const { error: quizError } = await admin
      .from("quizzes")
      .upsert({ course_id: courseId, questions: quiz }, { onConflict: "course_id" });
    if (quizError) throw quizError;

    const { error: mindmapError } = await admin
      .from("mindmaps")
      .upsert({ course_id: courseId, data: mindmap }, { onConflict: "course_id" });
    if (mindmapError) throw mindmapError;

    const { error: updateError } = await admin
      .from("courses")
      .update({ status: "done", title, error_message: null })
      .eq("id", courseId);
    if (updateError) throw updateError;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue pendant le traitement.";
    await admin.from("courses").update({ status: "error", error_message: message }).eq(
      "id",
      courseId
    );
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée." }), { status: 405 });
  }

  let courseId: string | undefined;
  try {
    ({ courseId } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Corps JSON invalide." }), { status: 400 });
  }
  if (!courseId) {
    return new Response(JSON.stringify({ error: "courseId manquant." }), { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Lance le traitement en arrière-plan et répond tout de suite : le client
  // n'attend jamais la fin de la transcription/structuration.
  // @ts-ignore — EdgeRuntime est fourni par le runtime Supabase Edge Functions.
  EdgeRuntime.waitUntil(processCourse(admin, courseId));

  return new Response(JSON.stringify({ started: true, courseId }), {
    status: 202,
    headers: { "content-type": "application/json" },
  });
});
