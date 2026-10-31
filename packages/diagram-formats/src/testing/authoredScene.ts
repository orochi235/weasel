/** A chart authored as a user draws one: a diagram type, one page, and stencils placed from its groups. */
import { PAGES_DOC_KEY, createScene, defaultCommitAdapter, type Op, type RectPose } from '@weasel-js/core';
import {
  DIAGRAM_THEME_KEY, DIAGRAM_TYPES, DIAGRAM_TYPE_DOC_KEY, STENCIL_GROUPS, commitEdgeToScene, containerBuild, diagramTypeDocValue,
  diagramTypeEdgeStroke, diagramTypeOf, isContainerStencil, lanesOf, stencilBuild, withDiagramRegistry, type ContainerStencil, type DiagramStencil,
} from '@weasel-js/diagram';
import type { DiagramDocument } from '../document';
import { documentFromScene } from '../fromScene';
import { DIAGRAM_MERMAID } from '../mermaid/format';
import { MEASURE, THEME, type DocScene } from './docScene';

/** A stencil by id, from any shipped group. */
export function stencilById(id: string): DiagramStencil | ContainerStencil {
  for (const group of Object.values(STENCIL_GROUPS)) {
    const found = group.stencils.find((s) => s.id === id);
    if (found !== undefined) return found;
  }
  throw new Error(`no stencil "${id}"`);
}

/** A stencil to place: its id, where its center goes, and what its body goes in: an earlier placement by index, or a
 *  lane of one, `at` then in that container's frame. */
export interface Placement { stencil: string; at: { x: number; y: number }; parent?: number | { pool: number; lane: number } }

/** A one-page scene of diagram type `type`, each placement inserted as its stencil's tool inserts it. Returns
 *  the scene and each placement's new id, in order. */
export function authoredScene(type: string, placements: readonly Placement[] = []): { scene: DocScene; ids: string[] } {
  const scene = createScene<unknown, string, RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withDiagramRegistry(),
    doc: {
      [PAGES_DOC_KEY]: { pages: [{ id: 'p', width: 2000, height: 1400 }] },
      [DIAGRAM_THEME_KEY]: THEME.id,
      [DIAGRAM_TYPE_DOC_KEY]: diagramTypeDocValue(type),
    },
  });
  let n = 0;
  const ids: string[] = [];
  const parentOf = (p: Placement): string | null => {
    if (p.parent === undefined) return null;
    if (typeof p.parent === 'number') return ids[p.parent]!;
    return lanesOf(scene as never, ids[p.parent.pool]!)[p.parent.lane]!;
  };
  for (const p of placements) {
    const stencil = stencilById(p.stencil);
    const bounds = { ...p.at, width: 0, height: 0 };
    const common = { layer: 'main', newId: () => `${p.stencil}-${++n}`, parent: parentOf(p) };
    const { id, ops } = isContainerStencil(stencil)
      ? containerBuild(stencil, bounds, common)
      : stencilBuild(stencil, bounds, { ...common, measure: MEASURE });
    scene.applyBatch(ops as Op[], `Insert ${stencil.label}`, defaultCommitAdapter(scene));
    ids.push(id);
  }
  return { scene, ids };
}

/** A connector from `from` to `to`, body to body, as the connector tool draws one in the scene's diagram type. */
export function connect(scene: DocScene, from: string, to: string): void {
  const type = diagramTypeOf(scene, DIAGRAM_TYPES);
  const end = (nodeId: string) => ({ kind: 'body' as const, nodeId, point: { x: 0, y: 0 } });
  const ctx = { deps: { scene } } as unknown as Parameters<typeof commitEdgeToScene>[1];
  commitEdgeToScene({ from: end(from), to: end(to), router: type.edge?.router ?? 'straight' }, ctx, { stroke: diagramTypeEdgeStroke(THEME, type) });
}

/** The scene as a document, as Mermaid, and that Mermaid read back. */
export function mermaidRoundTrip(scene: DocScene): { written: DiagramDocument; text: string; back: DiagramDocument } {
  const written = documentFromScene(scene);
  const { text } = DIAGRAM_MERMAID.write!(written);
  const back = (DIAGRAM_MERMAID.read!(text) as { document: DiagramDocument }).document;
  return { written, text, back };
}
