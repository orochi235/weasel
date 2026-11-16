// #region gem-kind
import { defineTool, solid, type InsertNodeFactory, type NodeShapeEntry, type RectPose } from '@weasel-js/core';
import { pathFromD } from '@weasel-js/geom';
import { INSERT_DRAG_MODS, INSERT_REPOSITION_BINDING } from '@weasel-js/editing';

export interface GemData { gem: { color: string; facets: number } }

export const GEM_BLUE = '#3a7bd5';

export const isGem = (data: unknown): data is GemData =>
  typeof data === 'object' && data !== null && 'gem' in data;

/** The gem's outline: a polygon of `facets` corners inscribed in the pose box, the first at the top. */
export function gemOutline(pose: RectPose, facets: number) {
  const corners = Array.from({ length: facets }, (_, i) => {
    const turn = (i / facets) * 2 * Math.PI;
    return `${pose.x + (pose.width / 2) * (1 + Math.sin(turn))} ${pose.y + (pose.height / 2) * (1 - Math.cos(turn))}`;
  });
  return pathFromD(`M${corners.join(' L')} Z`);
}

// Paints the gem, and picks it by its outline rather than its pose box.
export const gemShape: NodeShapeEntry<unknown, RectPose> = {
  id: 'app:gem',
  matches: (node) => isGem(node.data),
  paint: (node, pose) => {
    const { gem } = node.data as GemData;
    return [{ kind: 'path', path: gemOutline(pose, gem.facets), fill: { paint: solid(gem.color) } }];
  },
  silhouette: (node, pose) => gemOutline(pose, (node.data as GemData).gem.facets),
};

// The data an insert of kind `gem` gets; the insert dep adds the id, layer, pose, and undo.
export const gemInsert: InsertNodeFactory = () => ({ data: { gem: { color: GEM_BLUE, facets: 4 } } satisfies GemData });

// A declarative shell over `insert`: the binding's `params.kind` names the factory.
export const gemTool = defineTool({
  id: 'gem',
  keybinding: { key: 'J' },
  capabilities: ['creates-shapes'],
  cursor: 'crosshair',
  presentation: { label: 'Gem', group: 'shape' },
  bindings: [
    { spec: { kind: 'drag', mods: INSERT_DRAG_MODS }, actionId: 'insert', opts: { params: { kind: 'gem' } } },
    INSERT_REPOSITION_BINDING,
  ],
});
// #endregion gem-kind
