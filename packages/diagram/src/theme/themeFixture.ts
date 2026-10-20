import { createScene, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from '../edge';
import { diagramScene, edgeIdOf, type DiagramData } from '../fromData';

export const AB = edgeIdOf({ from: 'a', to: 'b', label: 'yes' });
export const BC = edgeIdOf({ from: 'b', to: 'c' });

/** Three shapes, `a` in the accent role and `b` with its fill set by hand, joined by two
 *  connectors, the first labeled, inside a titled group. */
export const THEMED: DiagramData = {
  nodes: [
    { id: 'a', lines: ['a'], style: 'accent' },
    { id: 'b', rows: [{ kind: 'label', text: 'b' }, { kind: 'field', label: 'k', value: 'v' }] },
    { id: 'c', lines: ['c'] },
  ],
  edges: [{ from: 'a', to: 'b', label: 'yes' }, { from: 'b', to: 'c' }],
  groups: [{ id: 'g', members: ['a', 'b'], label: 'Group' }],
};

type Data = Record<string, unknown> & { diagram?: Record<string, unknown> };

/** {@link THEMED} as a live scene with no history, `b`'s fill marked as the author's. */
export function themedScene() {
  const specs = diagramScene(THEMED).map((spec) => {
    if (spec.id !== 'b') return spec;
    const data = spec.data as Data;
    return { ...spec, data: { ...data, fill: { paint: { color: '#123456' } }, diagram: { ...data.diagram, ownStyle: ['fill'] } } };
  });
  return createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }], initial: specs as never, registry: withDiagramRegistry(),
  });
}

/** The color a node's fill or stroke paints, by id. */
export const colorOf = (scene: { get(id: never): { data: unknown } | undefined }, id: string, key: 'fill' | 'stroke') =>
  ((scene.get(id as never)!.data as Record<string, { paint: { color: string } } | undefined>)[key])?.paint.color;
