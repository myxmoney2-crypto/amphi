"use client";

import { FREE_MINDMAP_BRANCHES, type MindMapNode } from "@/lib/types";
import UpgradeOverlay from "@/components/ui/UpgradeOverlay";

const NODE_WIDTH = 190;
const X_GAP = 240;
const PADDING = 30;
const GAP = 14;
const MIN_NODE_HEIGHT = 46;
const LINE_HEIGHT = 16;
const CHAR_WIDTH = 6.2;
const MAX_LINES = 3;

/**
 * Estime le nombre de lignes qu'un texte occupera dans une bulle de largeur
 * fixe, pour donner à chaque nœud une hauteur qui lui correspond — c'est ce
 * qui évite les chevauchements avec ses voisins quand un titre est long.
 */
function estimateNodeHeight(text: string): number {
  const usableWidth = NODE_WIDTH - 40; // padding + marge pour l'icône des branches
  const charsPerLine = Math.max(8, Math.floor(usableWidth / CHAR_WIDTH));
  const lines = Math.min(MAX_LINES, Math.max(1, Math.ceil(text.length / charsPerLine)));
  return Math.max(MIN_NODE_HEIGHT, lines * LINE_HEIGHT + 22);
}

interface PositionedNode {
  title: string;
  x: number;
  y: number;
  height: number;
  level: 0 | 1 | 2;
  branchIndex?: number;
}

interface Edge {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

function layout(root: MindMapNode, colorOffset: number) {
  const nodes: PositionedNode[] = [];
  const edges: Edge[] = [];
  let cursorY = 0;

  const branches = root.children ?? [];
  const branchCenters: number[] = [];

  branches.forEach((branch, branchIndex) => {
    const leaves = branch.children ?? [];
    const leafCenters: number[] = [];

    if (leaves.length === 0) {
      const h = estimateNodeHeight(branch.title);
      leafCenters.push(cursorY + h / 2);
      cursorY += h + GAP;
    } else {
      for (const leaf of leaves) {
        const h = estimateNodeHeight(leaf.title);
        const centerY = cursorY + h / 2;
        cursorY += h + GAP;
        nodes.push({
          title: leaf.title,
          x: X_GAP * 2,
          y: centerY,
          height: h,
          level: 2,
          branchIndex: branchIndex + colorOffset,
        });
        leafCenters.push(centerY);
      }
    }

    const branchCenterY = leafCenters.reduce((a, b) => a + b, 0) / leafCenters.length;
    branchCenters.push(branchCenterY);
    const branchHeight = estimateNodeHeight(branch.title);
    nodes.push({
      title: branch.title,
      x: X_GAP,
      y: branchCenterY,
      height: branchHeight,
      level: 1,
      branchIndex: branchIndex + colorOffset,
    });

    if (leaves.length) {
      for (const leafY of leafCenters) {
        edges.push({ from: { x: X_GAP + NODE_WIDTH, y: branchCenterY }, to: { x: X_GAP * 2, y: leafY } });
      }
    }
  });

  const rootY = branchCenters.length
    ? branchCenters.reduce((a, b) => a + b, 0) / branchCenters.length
    : MIN_NODE_HEIGHT / 2;
  const rootHeight = estimateNodeHeight(root.title);
  nodes.unshift({ title: root.title, x: 0, y: rootY, height: rootHeight, level: 0 });

  for (const branchY of branchCenters) {
    edges.push({ from: { x: NODE_WIDTH, y: rootY }, to: { x: X_GAP, y: branchY } });
  }

  // Recale tout le diagramme pour que le nœud le plus haut touche
  // exactement le padding du haut — sans ça, une racine plus grande que la
  // moyenne de ses branches peut remonter au-dessus de y=0 et chevaucher le
  // bord du SVG (le bug signalé).
  const minTop = Math.min(...nodes.map((n) => n.y - n.height / 2));
  if (minTop !== 0) {
    for (const n of nodes) n.y -= minTop;
    for (const e of edges) {
      e.from.y -= minTop;
      e.to.y -= minTop;
    }
  }

  const totalHeight = Math.max(...nodes.map((n) => n.y + n.height / 2)) + PADDING * 2;
  const totalWidth = X_GAP * 2 + NODE_WIDTH + PADDING * 2;

  return { nodes, edges, totalWidth, totalHeight };
}

// Dégradé rose → violet → bleu, une teinte par branche principale.
function branchColor(index: number, total: number) {
  const hueStart = 336; // rose
  const hueEnd = 232; // bleu
  const t = total > 1 ? index / (total - 1) : 0;
  const hue = hueStart + (hueEnd - hueStart) * t;
  return {
    bg: `hsl(${hue} 80% 95%)`,
    accent: `hsl(${hue} 70% 58%)`,
    text: `hsl(${hue} 45% 30%)`,
  };
}

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      {children}
    </svg>
  );
}

const BRANCH_ICONS: (() => React.ReactNode)[] = [
  () => (
    <IconWrap>
      <path d="M9 2.5a4.5 4.5 0 00-2.7 8.1c.5.4.8 1 .8 1.7v.7h3.8v-.7c0-.7.3-1.3.8-1.7A4.5 4.5 0 009 2.5z" />
      <path d="M7.2 15.5h3.6M7.6 13.5h2.8" />
    </IconWrap>
  ),
  () => (
    <IconWrap>
      <path d="M3 4c0-.6.4-1 1-1h4v11H4c-.6 0-1-.4-1-1V4z" />
      <path d="M15 4c0-.6-.4-1-1-1H9.5v11H14c.6 0 1-.4 1-1V4z" />
    </IconWrap>
  ),
  () => (
    <IconWrap>
      <path d="M9 2.5l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6L9 2.5z" />
    </IconWrap>
  ),
  () => (
    <IconWrap>
      <path d="M4.5 2v14" />
      <path d="M4.5 3h8.5l-2 3 2 3H4.5" />
    </IconWrap>
  ),
  () => (
    <IconWrap>
      <path d="M3 4.5h12v7.5H8l-3 3v-3H3V4.5z" />
    </IconWrap>
  ),
  () => (
    <IconWrap>
      <circle cx="9" cy="9" r="6.5" />
      <path d="M11.3 6.7L9.6 9.6 6.7 11.3 8.4 8.4z" />
    </IconWrap>
  ),
];

const LEVEL0_CLASS = "bg-ink text-cream font-bold shadow-md";

function MindMapCanvas({
  data,
  colorOffset = 0,
  totalBranches,
}: {
  data: MindMapNode;
  colorOffset?: number;
  totalBranches?: number;
}) {
  const { nodes, edges, totalWidth, totalHeight } = layout(data, colorOffset);
  const branchTotal = totalBranches ?? (data.children?.length || 1) + colorOffset;

  return (
    <div className="overflow-x-auto rounded-3xl border border-ink/10 bg-white p-4">
      <svg width={totalWidth} height={totalHeight} viewBox={`0 0 ${totalWidth} ${totalHeight}`} className="block">
        <g transform={`translate(${PADDING}, ${PADDING})`}>
          {edges.map((edge, i) => {
            const midX = (edge.from.x + edge.to.x) / 2;
            return (
              <path
                key={i}
                d={`M ${edge.from.x} ${edge.from.y} C ${midX} ${edge.from.y}, ${midX} ${edge.to.y}, ${edge.to.x} ${edge.to.y}`}
                fill="none"
                stroke="#0E0E10"
                strokeOpacity={0.15}
                strokeWidth={2}
              />
            );
          })}
          {nodes.map((node, i) => {
            const color =
              node.level > 0 && node.branchIndex !== undefined
                ? branchColor(node.branchIndex, branchTotal)
                : null;
            const Icon = color && node.level === 1 ? BRANCH_ICONS[node.branchIndex! % BRANCH_ICONS.length] : null;

            return (
              <foreignObject
                key={i}
                x={node.x}
                y={node.y - node.height / 2}
                width={NODE_WIDTH}
                height={node.height}
              >
                {node.level === 0 ? (
                  <div className={`flex h-full items-center rounded-2xl px-4 py-2 text-xs leading-snug ${LEVEL0_CLASS}`}>
                    <span className="line-clamp-3">{node.title}</span>
                  </div>
                ) : node.level === 1 ? (
                  <div
                    className="flex h-full items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold leading-snug shadow-sm"
                    style={{ background: color!.bg, color: color!.text }}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: color!.accent }}
                    >
                      {Icon && <Icon />}
                    </span>
                    <span className="line-clamp-3">{node.title}</span>
                  </div>
                ) : (
                  <div
                    className="flex h-full items-center rounded-2xl border-l-4 bg-white px-3 py-2 text-xs leading-snug text-ink/90 shadow-sm"
                    style={{ borderLeftColor: color!.accent }}
                  >
                    <span className="line-clamp-3">{node.title}</span>
                  </div>
                )}
              </foreignObject>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export default function MindMap({
  data,
  hasFullAccess,
}: {
  data: MindMapNode;
  hasFullAccess: boolean;
}) {
  if (!data?.title) {
    return <p className="text-sm text-ink/50">Aucune carte mentale disponible pour ce cours.</p>;
  }

  const allBranches = data.children ?? [];

  if (hasFullAccess || allBranches.length <= FREE_MINDMAP_BRANCHES) {
    return <MindMapCanvas data={data} totalBranches={allBranches.length} />;
  }

  const visibleTree: MindMapNode = {
    title: data.title,
    children: allBranches.slice(0, FREE_MINDMAP_BRANCHES),
  };
  const lockedTree: MindMapNode = {
    title: data.title,
    children: allBranches.slice(FREE_MINDMAP_BRANCHES),
  };

  return (
    <div>
      <MindMapCanvas data={visibleTree} totalBranches={allBranches.length} />
      <UpgradeOverlay message="Débloque les branches restantes de cette carte mentale avec l'offre payante AMFI.">
        <MindMapCanvas
          data={lockedTree}
          colorOffset={FREE_MINDMAP_BRANCHES}
          totalBranches={allBranches.length}
        />
      </UpgradeOverlay>
    </div>
  );
}
