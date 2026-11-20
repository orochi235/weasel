/**
 * The layer op kinds address a layer by id, as the node ones address a node:
 * a replay onto a scene whose stack has drifted takes out the layer it names
 * or throws, and never one that happens to sit where the payload says.
 */
import { describe, expect, it } from 'vitest';
import { createScene } from './scene';

type L = 'main' | 'x' | 'y';
const make = () => createScene<unknown, L>({ systemLayers: [{ id: 'main' }] });
const ids = (s: ReturnType<typeof make>) => s.layers.map((l) => l.id);
const userRecord = (id: L) => ({ kind: 'user', id, name: id, visible: true, locked: false });

describe('layer ops replayed onto a drifted stack', () => {
  it('kit:removeLayer takes out the layer it names, wherever it sits', () => {
    const s = make();
    s.addLayer({ id: 'y', name: 'y' });
    s.addLayer({ id: 'x', name: 'x' });
    // Recorded where the stack was [main, x, y]: x at 1.
    s.replay([{ name: 'kit:removeLayer', args: { record: userRecord('x'), index: 1 } }]);
    expect(ids(s)).toEqual(['main', 'y']);
  });

  it('kit:removeLayer throws for a layer the scene does not hold', () => {
    const s = make();
    s.addLayer({ id: 'y', name: 'y' });
    expect(() => s.replay([{ name: 'kit:removeLayer', args: { record: userRecord('x'), index: 1 } }])).toThrow(/unknown layer "x"/);
    expect(ids(s)).toEqual(['main', 'y']);
  });

  it('undoing kit:addLayer takes out the layer it added after another moved in front of it', () => {
    const s = make();
    s.addLayer({ id: 'x', name: 'x' });
    s.untracked(() => s.addLayer({ id: 'y', name: 'y', index: 1 }));
    expect(ids(s)).toEqual(['main', 'y', 'x']);
    s.undo();
    expect(ids(s)).toEqual(['main', 'y']);
  });
});
