import { describe, expect, it } from 'vitest';
import { liveSelection } from './liveSelection';
import { selection, soloSweepFrom, sweepFrom, type SelectionModel } from './selection';

const VALUES = ['a', 'b', 'c'] as const;

/** A component holding a list, which re-renders its model only when `render` is called. */
function holder(initial: string[]) {
  let value = initial;
  const seen: { reported: string[]; heldThen: string[] }[] = [];
  const build = (): SelectionModel => {
    const held = value;
    return selection<string>({ mode: 'multiple', value: held, onChange: (next) => { seen.push({ reported: next, heldThen: held }); value = next; } }, VALUES);
  };
  let model = build();
  return { current: () => model, render: () => { model = build(); }, seen, value: () => value };
}

describe('liveSelection', () => {
  it('reports each step through the model rendered since the last, so the handler sees what it holds', () => {
    const h = holder([]);
    const run = sweepFrom(liveSelection(h.current, () => VALUES.length), 0);
    run.reach(0);
    h.render();
    run.reach(1);
    expect(h.seen).toEqual([{ reported: ['a'], heldThen: [] }, { reported: ['a', 'b'], heldThen: ['a'] }]);
  });

  it('continues from what it last reported when the component has not rendered in between', () => {
    const h = holder([]);
    const run = sweepFrom(liveSelection(h.current, () => VALUES.length), 0);
    run.reach(0);
    run.reach(1);
    expect(h.value()).toEqual(['a', 'b']);
  });

  it('solos from the press-time states across renders, and puts them back on revert', () => {
    const h = holder(['a', 'b', 'c']);
    const run = soloSweepFrom(liveSelection(h.current, () => VALUES.length), 1, VALUES.length);
    run.reach(1);
    h.render();
    run.reach(2);
    expect(h.value()).toEqual(['b', 'c']);
    h.render();
    run.revert();
    expect([...h.value()].sort()).toEqual(['a', 'b', 'c']);
  });
});
