import { createScene, type RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { DIVIDER_HEIGHT } from './body';
import { relayoutBodies, type RelayoutScene } from './bodyRelayout';
import { withDiagramRegistry } from './edge';
import { diagramScene, type DiagramData } from './fromData';
import type { DiagramNode } from './types';

type Box = { x: number; y: number; width: number; height: number };

const DATA: DiagramData = {
  nodes: [{
    id: 'c', at: { x: 0, y: 0 }, width: 120, padding: 8, gap: 4, verticalAlign: 'top',
    rows: [{ kind: 'label', text: 'Name' }, { kind: 'divider' }, { kind: 'label', text: 'x' }],
  }],
  edges: [],
};

function setup() {
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }], initial: diagramScene(DATA) as never, registry: withDiagramRegistry(),
  });
  const box = (id: string) => scene.get(id as never)!.pose as Box;
  const trait = () => (scene.get('c' as never)!.data as { diagram: DiagramNode }).diagram;
  return { scene, box, trait };
}

describe('laying out a body with a divider again', () => {
  it('keeps the divider in its place and records the new row heights', () => {
    const { scene, box, trait } = setup();
    const [nameRow, xRow] = scene.childrenOf('c' as never);
    scene.update(nameRow as never, { data: { ...(scene.get(nameRow as never)!.data as object), style: { fontFamily: 'sans-serif', fontSize: 30 } } });
    relayoutBodies(scene as unknown as RelayoutScene, ['c'], (_text, s) => ({ width: 10, height: s.fontSize ?? 10 }));
    expect(trait().body!.heights).toEqual([30, DIVIDER_HEIGHT, 12]);
    expect(trait().body!.dividers).toEqual([{ index: 1 }]);
    expect(box(xRow!).y).toBe(box('c').y + 8 + 30 + 4 + DIVIDER_HEIGHT + 4);
  });

  it('leaves the trait alone when no row changed height', () => {
    const { scene, trait } = setup();
    const before = trait();
    relayoutBodies(scene as unknown as RelayoutScene, ['c'], (_text, s) => ({ width: 10, height: Math.ceil((s.fontSize ?? 12) * 1.4) }));
    expect(trait()).toBe(before);
  });
});
