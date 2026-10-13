import { describe, it, expect, beforeEach } from 'vitest';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import type { LayoutRunsOpts } from './layoutOpts';
import type { ResolvedRun } from '../runs/resolveRuns';
import { stubFetch, registerFixture, RUN_PLAIN, RUN_BOLD, RUN_ITALIC } from './testing/fontFixtures';

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

describe('layoutRuns — single line', () => {
  it('returns one group when all runs share the same variant', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].family).toBe('inter');
    expect(out.groups[0].weight).toBe(400);
    expect(out.groups[0].style).toBe('normal');
    expect(out.groups[0].quads).toHaveLength(2);
  });

  it('keeps equal gradients in one group, and two different gradients apart', async () => {
    await registerFixture('inter', [{}]);
    const gradient = (end = '#00f'): ResolvedRun['fill'] => ({
      paint: {
        kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
        stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: end }],
      },
    });
    const opts: LayoutRunsOpts = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' };
    // Paint identity is structural: built separately, equal gradients are one paint.
    const one = layoutAndPaint([{ ...RUN_PLAIN('AB'), fill: gradient() }, { ...RUN_PLAIN('A'), fill: gradient() }], opts);
    expect(one.groups).toHaveLength(1);
    expect(one.groups[0].quads).toHaveLength(3);
    const two = layoutAndPaint([{ ...RUN_PLAIN('AB'), fill: gradient() }, { ...RUN_PLAIN('A'), fill: gradient('#0f0') }], opts);
    expect(two.groups.map((g) => g.quads.length)).toEqual([2, 1]);
  });

  it('emits one group per distinct (family, weight, style, synthetic, fill)', async () => {
    await registerFixture('inter', [{}, { weight: 700 }]);
    const out = layoutAndPaint(
      [RUN_PLAIN('A'), RUN_BOLD('B'), RUN_PLAIN('A')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
    );
    expect(out.groups).toHaveLength(2);
    const regular = out.groups.find((g) => g.weight === 400)!;
    const bold = out.groups.find((g) => g.weight === 700)!;
    expect(regular.quads).toHaveLength(2);
    expect(bold.quads).toHaveLength(1);
  });

  it('marks groups with synthetic flags when the resolver fell back', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([RUN_ITALIC('A')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].synthetic).toEqual({ bold: false, italic: true });
  });

  it('per-run fill forces a separate group even for the same atlas variant', async () => {
    await registerFixture('inter', [{}]);
    const RED: ResolvedRun = { ...RUN_PLAIN('A'), fill: { paint: { kind: 'solid', color: '#f00' } } };
    const out = layoutAndPaint(
      [RUN_PLAIN('A'), RED, RUN_PLAIN('A')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
    );
    expect(out.groups).toHaveLength(2);
  });

  it('returns no groups when the family is unregistered', () => {
    const out = layoutAndPaint(
      [{ ...RUN_PLAIN('A'), fontFamily: 'missing' }],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
    );
    expect(out.groups).toHaveLength(0);
    expect(out.bounds.width).toBe(0);
  });
});

describe('layoutRuns — substituted families', () => {
  // The renderer looks the group's atlas up by `group.family` (exact
  // `getFont`). A group tagged with the *requested* family therefore resolves
  // to nothing and paints nothing, however correct the ResolveResult was.
  it('tags the group with the atlas family it will be looked up by', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint(
      [{ ...RUN_PLAIN('A'), fontFamily: 'ghost' }],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
    );
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].family).toBe('inter');
    expect(out.groups[0].quads).toHaveLength(1);
  });

  it('merges two families substituting to the same atlas into one group', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint(
      [
        { ...RUN_PLAIN('A'), fontFamily: 'ghost' },
        { ...RUN_PLAIN('A'), fontFamily: 'phantom' },
      ],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
    );
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].family).toBe('inter');
    expect(out.groups[0].quads).toHaveLength(2);
  });

  it('keeps a registered family on its own exact-match atlas', async () => {
    await registerFixture('inter', [{}]);
    await registerFixture('slab', [{}]);
    const out = layoutAndPaint(
      [RUN_PLAIN('A'), { ...RUN_PLAIN('A'), fontFamily: 'slab' }],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
    );
    expect(out.groups.map((g) => g.family).sort()).toEqual(['inter', 'slab']);
  });
});
