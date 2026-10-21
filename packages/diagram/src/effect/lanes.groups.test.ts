import { describe, expect, it } from 'vitest';
import { DEFAULT_GROUP_INSET } from '../cluster';
import { built, P } from './lanesFixture';
import { laneTypeOf } from './lanes';
import type { EffectGroup, EffectPipeline } from './types';

const RANK_GAP = 40;
const withGroups = (groups: EffectGroup[]): EffectPipeline => ({ ...P, groups });

/** Every stage outside `members` sits clear of the group's box across x, by at least the rank gap. */
function expectBlock(p: EffectPipeline, group: string, members: readonly string[]) {
  const { drawn, box } = built(p);
  const g = box(group);
  const outsiders = drawn.data.nodes.filter((n) => laneTypeOf(n.id) === undefined && !members.includes(n.id));
  expect(outsiders.length).toBeGreaterThan(0);
  for (const n of outsiders) {
    const b = box(n.id);
    const before = g.x - (b.x + b.width);
    const after = b.x - (g.x + g.width);
    expect(Math.max(before, after), `${n.id} beside ${group}`).toBeGreaterThanOrEqual(RANK_GAP - 1e-6);
  }
  for (const m of members) {
    const b = box(m);
    expect(b.x, m).toBeGreaterThan(g.x);
    expect(b.x + b.width, m).toBeLessThan(g.x + g.width);
  }
}

describe('lanes groups', () => {
  it('puts no outsider in a column a group holds', () => {
    const p = withGroups([{ id: 'g', label: 'Soften', members: ['blur', 'osc'] }]);
    const { drawn, box } = built(p);
    const g = box('g');
    for (const n of drawn.data.nodes.filter((n) => !['blur', 'osc'].includes(n.id) && laneTypeOf(n.id) === undefined)) {
      const b = box(n.id);
      expect(b.x + b.width <= g.x || b.x >= g.x + g.width, n.id).toBe(true);
    }
  });

  it('keeps a group box clear of its neighbors', () => {
    expectBlock(withGroups([{ id: 'g', label: 'Soften', members: ['blur', 'osc'] }]), 'g', ['blur', 'osc']);
  });

  it('widens a group to fit a long title, and keeps it clear of its neighbors', () => {
    const p = withGroups([{ id: 'g', label: 'A very long group title indeed, longer than its stages', members: ['blur'] }]);
    const { box } = built(p);
    expect(box('g').width).toBeGreaterThanOrEqual(box('g/label').width + 2 * DEFAULT_GROUP_INSET - 1e-6);
    expectBlock(p, 'g', ['blur']);
  });

  it('keeps nested groups each a block, the inner inside the outer', () => {
    const p = withGroups([
      { id: 'outer', label: 'Finish', members: ['inner', 'mix'] },
      { id: 'inner', label: 'Soften', members: ['blur', 'osc'] },
    ]);
    expectBlock(p, 'outer', ['blur', 'osc', 'mix']);
    expectBlock(p, 'inner', ['blur', 'osc']);
    const { box } = built(p);
    const [o, i] = [box('outer'), box('inner')];
    expect(i.x).toBeGreaterThan(o.x);
    expect(i.x + i.width).toBeLessThan(o.x + o.width);
  });

  it('draws a group with no stage on the main line as a block', () => {
    expectBlock(withGroups([{ id: 'g', label: 'Controls', members: ['osc', 'cut'] }]), 'g', ['osc', 'cut']);
  });

  it('keeps an unlabeled group a block', () => {
    expectBlock(withGroups([{ id: 'g', members: ['q', 'blur'] }]), 'g', ['q', 'blur']);
  });

  it('still puts each stage right of every stage that feeds it', () => {
    const p = withGroups([{ id: 'g', label: 'Soften', members: ['blur', 'cut'] }]);
    const { box } = built(p);
    for (const wire of p.wires) expect(box(wire.to.stage).x, `${wire.from.stage} > ${wire.to.stage}`).toBeGreaterThan(box(wire.from.stage).x);
  });
});
