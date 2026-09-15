"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FREE_BLOCK_LIMIT, type LessonBlock } from "@/lib/types";
import UpgradeOverlay from "@/components/ui/UpgradeOverlay";
import AmfiMascot from "@/components/lesson/AmfiMascot";

const HIGHLIGHT_COLORS = [
  { label: "Jaune", value: "#FFF3A3" },
  { label: "Rose", value: "#FFD1E8" },
  { label: "Vert", value: "#C8F7D6" },
  { label: "Bleu", value: "#CFE8FF" },
];

const ALLOWED_TAGS = new Set(["B", "STRONG", "U", "EM", "I", "SPAN", "BR"]);

/**
 * Le contenu édité par l'élève (gras/souligné/surlignage via execCommand)
 * repart en base sous forme de HTML — on ne garde qu'une poignée de balises
 * de mise en forme et, pour <span>, qu'un sous-ensemble de propriétés CSS
 * (styleWithCSS étant activé, gras/souligné/surlignage arrivent tous comme
 * des styles inline sur des <span>, pas comme des balises <b>/<u>), pour
 * éviter d'enregistrer n'importe quel HTML/JS arbitraire.
 */
const ALLOWED_STYLE_PROPS = ["background-color", "font-weight", "text-decoration", "text-decoration-line"];

function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";

  function clean(node: Element) {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (!ALLOWED_TAGS.has(el.tagName)) {
          while (el.firstChild) node.insertBefore(el.firstChild, el);
          node.removeChild(el);
          return;
        }
        [...el.attributes].forEach((attr) => {
          if (el.tagName === "SPAN" && attr.name === "style") {
            const preserved = ALLOWED_STYLE_PROPS.map((prop) => {
              const val = el.style.getPropertyValue(prop);
              return val ? `${prop}: ${val}` : null;
            }).filter(Boolean);
            el.removeAttribute("style");
            if (preserved.length) el.setAttribute("style", preserved.join("; "));
          } else {
            el.removeAttribute(attr.name);
          }
        });
        clean(el);
      } else if (child.nodeType !== Node.TEXT_NODE) {
        node.removeChild(child);
      }
    });
  }
  clean(root);
  return root.innerHTML;
}

/** Le bloc (paragraphe/titre) contentEditable contenant la sélection courante. */
function getContainingBlockElement(range: Range): HTMLElement | null {
  let node: Node | null = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  return (node as Element | null)?.closest('[contenteditable="true"]') as HTMLElement | null;
}

function BlockContent({
  block,
  editable,
  onBlur,
}: {
  block: LessonBlock;
  editable: boolean;
  onBlur: (html: string) => void;
}) {
  const baseProps = {
    "data-block-id": block.id,
    contentEditable: editable,
    suppressContentEditableWarning: true,
    onBlur: (e: React.FocusEvent<HTMLElement>) => onBlur(sanitizeHtml(e.currentTarget.innerHTML)),
    dangerouslySetInnerHTML: { __html: block.text },
  };

  switch (block.type) {
    case "heading":
      return <h2 className="mt-8 text-2xl font-bold text-ink first:mt-0" {...baseProps} />;
    case "subheading":
      return <h3 className="mt-6 text-lg font-semibold text-ink" {...baseProps} />;
    case "definition":
      return (
        <p
          className="mt-3 rounded-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-ink"
          {...baseProps}
        />
      );
    default:
      return <p className="mt-3 text-base leading-relaxed text-ink/90" {...baseProps} />;
  }
}

type BubbleStatus = "idle" | "loading" | "done" | "error";

interface AmfiBubble {
  x: number;
  y: number;
  selectedText: string;
  contextText: string;
  status: BubbleStatus;
  answer?: string;
}

export default function LessonViewer({
  courseId,
  initialBlocks,
  hasFullAccess,
}: {
  courseId: string;
  initialBlocks: LessonBlock[];
  hasFullAccess: boolean;
}) {
  const [blocks, setBlocks] = useState<LessonBlock[]>(initialBlocks);
  const [saving, setSaving] = useState(false);
  const [bubble, setBubble] = useState<AmfiBubble | null>(null);

  async function persist(next: LessonBlock[]) {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("lessons")
      .update({ content: next, updated_at: new Date().toISOString() })
      .eq("course_id", courseId);
    setSaving(false);
  }

  function handleBlockBlur(id: string, html: string) {
    const next = blocks.map((b) => (b.id === id ? { ...b, text: html } : b));
    setBlocks(next);
    persist(next);
  }

  // Toute mise en forme manipule le DOM directement (execCommand ou DOM API
  // manuelle), mais chaque bloc est rendu via dangerouslySetInnerHTML piloté
  // par `blocks` en state : si un re-render survient avant que le blur ne
  // sauvegarde le nouveau HTML (ex: setBubble() juste après un surlignage),
  // React réapplique l'ancien HTML et efface la modification. On resynchronise
  // donc l'état à partir du DOM juste après chaque commande, sans attendre le
  // blur.
  function syncBlockFromDom(blockEl: HTMLElement | null) {
    const blockId = blockEl?.dataset.blockId;
    if (!blockId) return;
    handleBlockBlur(blockId, sanitizeHtml(blockEl!.innerHTML));
  }

  // onMouseDown + preventDefault (plutôt que onClick) pour que le clic sur
  // le bouton ne fasse pas perdre la sélection de texte en cours avant que
  // execCommand ne s'applique.
  function applyBoldOrUnderline(command: "bold" | "underline") {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const blockEl = range ? getContainingBlockElement(range) : null;

      document.execCommand("styleWithCSS", false, "true");
      document.execCommand(command, false);

      syncBlockFromDom(blockEl);
    };
  }

  // execCommand("hiliteColor", ...) s'est avéré peu fiable en pratique : il
  // peut renvoyer `true` sans rien changer au DOM, voire faire disparaître
  // une mise en forme déjà appliquée, selon l'état exact de la sélection —
  // un problème connu et documenté de cette API historique. Le surlignage
  // est donc posé "à la main" en enveloppant la sélection dans un <span>.
  function wrapSelectionWithHighlight(range: Range, color: string) {
    const span = document.createElement("span");
    span.style.backgroundColor = color;
    try {
      range.surroundContents(span);
    } catch {
      // La sélection traverse plusieurs éléments (ex: à cheval sur un
      // passage déjà en gras) — surroundContents ne le supporte pas.
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }
    window.getSelection()?.removeAllRanges();
  }

  function clearHighlightInRange(range: Range, blockEl: HTMLElement | null) {
    const common = range.commonAncestorContainer;
    blockEl?.querySelectorAll('span[style*="background-color"]').forEach((span) => {
      // `intersectsNode` ne détecte pas le cas où le conteneur du range EST
      // le span lui-même (ex: sélection posée via selectNodeContents(span))
      // — on vérifie donc aussi le confinement mutuel span/range.
      const related =
        range.intersectsNode(span) || span.contains(common) || common.contains(span);
      if (!related) return;
      (span as HTMLElement).style.backgroundColor = "";
      if (!(span as HTMLElement).getAttribute("style")?.trim()) {
        while (span.firstChild) span.parentNode?.insertBefore(span.firstChild, span);
        span.parentNode?.removeChild(span);
      }
    });
    window.getSelection()?.removeAllRanges();
  }

  function handleHighlightClick(color: string) {
    return (e: React.MouseEvent) => {
      e.preventDefault();

      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      if (!range || (color !== "transparent" && selection!.isCollapsed)) return;
      const blockEl = getContainingBlockElement(range);

      // Capture le passage + son paragraphe pour "Demander une explication
      // à AMFI" AVANT de toucher au DOM (la sélection ne survit pas au
      // remplacement de ses propres nœuds par extractContents/insertNode).
      let pendingBubble: Omit<AmfiBubble, "status"> | null = null;
      if (color !== "transparent") {
        const selectedText = selection!.toString().trim();
        if (selectedText) {
          const rect = range.getBoundingClientRect();
          pendingBubble = {
            x: Math.min(Math.max(rect.left + rect.width / 2, 148), window.innerWidth - 148),
            y: rect.bottom + 8,
            selectedText,
            contextText: blockEl?.textContent?.trim() ?? "",
          };
        }
      }

      if (color === "transparent") {
        clearHighlightInRange(range, blockEl);
      } else {
        wrapSelectionWithHighlight(range, color);
      }

      syncBlockFromDom(blockEl);

      if (pendingBubble) {
        setBubble({ ...pendingBubble, status: "idle" });
      }
    };
  }

  async function handleAskAmfi() {
    if (!bubble) return;
    setBubble((b) => (b ? { ...b, status: "loading" } : b));
    try {
      const res = await fetch("/api/lesson/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedText: bubble.selectedText,
          contextText: bubble.contextText,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBubble((b) => (b ? { ...b, status: "done", answer: data.explanation } : b));
    } catch {
      setBubble((b) => (b ? { ...b, status: "error" } : b));
    }
  }

  // Ferme la bulle si on clique ailleurs.
  useEffect(() => {
    if (!bubble) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-amfi-bubble]") && !target.closest("[data-amfi-trigger]")) {
        setBubble(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [bubble]);

  const visibleBlocks = hasFullAccess ? blocks : blocks.slice(0, FREE_BLOCK_LIMIT);
  const lockedBlocks = hasFullAccess ? [] : blocks.slice(FREE_BLOCK_LIMIT);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-ink/10 bg-white px-3 py-2">
        <button
          onMouseDown={applyBoldOrUnderline("bold")}
          className="rounded-md px-2 py-1 text-sm font-bold text-ink/70 hover:bg-ink/5"
          title="Gras"
        >
          B
        </button>
        <button
          onMouseDown={applyBoldOrUnderline("underline")}
          className="rounded-md px-2 py-1 text-sm font-medium text-ink/70 underline hover:bg-ink/5"
          title="Souligné"
        >
          U
        </button>
        <span className="mx-1 h-4 w-px bg-ink/10" />
        <span className="text-xs text-ink/40">Surligner :</span>
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.value}
            data-amfi-trigger
            onMouseDown={handleHighlightClick(c.value)}
            className="h-5 w-5 rounded-full border border-ink/10"
            style={{ backgroundColor: c.value }}
            title={c.label}
          />
        ))}
        <button
          onMouseDown={handleHighlightClick("transparent")}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-ink/20 text-[10px] text-ink/40 hover:bg-ink/5"
          title="Retirer le surlignage"
        >
          ✕
        </button>
        <span className="ml-auto text-xs text-ink/30">
          {saving ? "Enregistrement..." : "Modifications enregistrées"}
        </span>
      </div>

      <div className="rounded-3xl border border-ink/10 bg-white px-8 py-8">
        {visibleBlocks.map((block) => (
          <BlockContent
            key={block.id}
            block={block}
            editable
            onBlur={(html) => handleBlockBlur(block.id, html)}
          />
        ))}

        {lockedBlocks.length > 0 && (
          <UpgradeOverlay message="Débloque la suite de cette leçon avec l'offre payante AMFI.">
            {lockedBlocks.map((block) => (
              <BlockContent key={block.id} block={block} editable={false} onBlur={() => {}} />
            ))}
          </UpgradeOverlay>
        )}
      </div>

      {bubble && (
        <div
          data-amfi-bubble
          className="animate-pop-in fixed z-40 w-72"
          style={{ left: bubble.x - 144, top: bubble.y }}
        >
          <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AmfiMascot className="h-9 w-9 shrink-0" />
              <div className="min-w-0 flex-1">
                {bubble.status === "idle" && (
                  <button
                    onClick={handleAskAmfi}
                    className="text-left text-sm font-semibold text-ink underline decoration-dotted underline-offset-2 hover:text-ink/70"
                  >
                    Demander une explication à AMFI
                  </button>
                )}
                {bubble.status === "loading" && (
                  <p className="text-sm text-ink/50">AMFI réfléchit...</p>
                )}
                {bubble.status === "done" && (
                  <p className="text-sm leading-relaxed text-ink/80">{bubble.answer}</p>
                )}
                {bubble.status === "error" && (
                  <p className="text-sm text-red-600">
                    Oups, je n'ai pas pu générer d'explication. Réessaie.
                  </p>
                )}
              </div>
              <button
                onClick={() => setBubble(null)}
                className="shrink-0 text-ink/30 hover:text-ink/60"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
