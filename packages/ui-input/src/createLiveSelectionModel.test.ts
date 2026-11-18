import { describe, expect, it } from 'vitest';
import { createLiveSelectionModel } from './createLiveSelectionModel';
import { createSelectionModel, soloSweepFrom, sweepFrom, type SelectionModel } from './selection';

const VALUES = ['a', 'b', 'c'] as const;

/** A component holding a list, which re-renders its model only when `render` is called. */
function holder(initial: string[]) {
  let value = initial;
  const seen: { reported: string[]; heldThen: string[] }[] = [];
  const build = (): SelectionModel => {
    const held = value;
    return createSelectionModel<string>({ mode: 'multiple', value: held, onChange: (next) => { seen.push({ reported: next, heldThen: held }); value = next; } }, VALUES);
  };
  let model = build();
  return { current: () => model, render: () => { model = build(); }, seen, value: () => value };
}

describe('createLiveSelectionModel', () => {
  it('reports each step through the model rendered since the last, so the handler sees what it holds', () => {
    const h = holder([]);
    const run = sweepFrom(createLiveSelectionModel(h.current, () => VALUES.length), 0);
    run.reach(0);
    h.render();
    run.reach(1);
    expect(h.seen).toEqual([{ reported: ['a'], heldThen: [] }, { reported: ['a', 'b'], heldThen: ['a'] }]);
  });

  it('continues from what it last reported when the component has not rendered in between', () => {
    const h = holder([]);
    const run = sweepFrom(createLiveSelectionModel(h.current, () => VALUES.length), 0);
    run.reach(0);
    run.reach(1);
    expect(h.value()).toEqual(['a', 'b']);
  });

  it('solos from the press-time states across renders, and puts them back on revert', () => {
    const h = holder(['a', 'b', 'c']);
    const run = soloSweepFrom(createLiveSelectionModel(h.current, () => VALUES.length), 1, VALUES.length);
    run.reach(1);
    h.render();
    run.reach(2);
    expect(h.value()).toEqual(['b', 'c']);
    h.render();
    run.revert();
    expect([...h.value()].sort()).toEqual(['a', 'b', 'c']);
  });

  it('puts back a single selection\'s press-time value on revert, null or off the list included', () => {
    for (const [initial, allowDeselect] of [[null, false], [null, true], ['z', false], ['z', true]] as const) {
      let value: string | null = initial;
      const build = () => createSelectionModel<string>({ value, allowDeselect, onChange: (next) => { value = next; } }, VALUES);
      let model = build();
      const run = sweepFrom(createLiveSelectionModel(() => model, () => VALUES.length), 0);
      run.reach(1);
      model = build();
      run.reach(2);
      expect(value).toBe('c');
      run.revert();
      expect(value).toBe(initial);
    }
  });
});
