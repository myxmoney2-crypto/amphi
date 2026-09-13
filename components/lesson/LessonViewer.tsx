"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FREE_BLOCK_LIMIT, type LessonBlock } from "@/lib/types";
import UpgradeOverlay from "@/components/ui/UpgradeOverlay";

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

  // onMouseDown + preventDefault (plutôt que onClick) pour que le clic sur
  // le bouton ne fasse pas perdre la sélection de texte en cours avant que
  // execCommand ne s'applique.
  function applyFormat(command: string, value?: string) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand(command, false, value);
    };
  }

  const visibleBlocks = hasFullAccess ? blocks : blocks.slice(0, FREE_BLOCK_LIMIT);
  const lockedBlocks = hasFullAccess ? [] : blocks.slice(FREE_BLOCK_LIMIT);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-ink/10 bg-white px-3 py-2">
        <button
          onMouseDown={applyFormat("bold")}
          className="rounded-md px-2 py-1 text-sm font-bold text-ink/70 hover:bg-ink/5"
          title="Gras"
        >
          B
        </button>
        <button
          onMouseDown={applyFormat("underline")}
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
            onMouseDown={applyFormat("hiliteColor", c.value)}
            className="h-5 w-5 rounded-full border border-ink/10"
            style={{ backgroundColor: c.value }}
            title={c.label}
          />
        ))}
        <button
          onMouseDown={applyFormat("hiliteColor", "transparent")}
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
    </div>
  );
}
