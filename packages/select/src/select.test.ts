import { describe, expect, it } from 'vitest';
import { intentOf, rangeOf, select, type Selection } from './select';

const none = { shift: false, meta: false, ctrl: false };
const shift = { ...none, shift: true };
const meta = { ...none, meta: true };
const ctrl = { ...none, ctrl: true };

describe('intentOf', () => {
  it('replaces in single mode whatever is held', () => {
    expect(intentOf({ shift: true, meta: true, ctrl: true }, { mode: 'single', toggle: 'shift', range: 'meta' })).toBe('replace');
  });

  it('toggles on the toggle key and replaces without it', () => {
    const policy = { mode: 'multi', toggle: 'shift' } as const;
    expect(intentOf(shift, policy)).toBe('toggle');
    expect(intentOf(meta, policy)).toBe('replace');
    expect(intentOf(none, policy)).toBe('replace');
  });

  it('accepts several toggle keys', () => {
    const policy = { mode: 'multi', toggle: ['meta', 'ctrl'] } as const;
    expect(intentOf(meta, policy)).toBe('toggle');
    expect(intentOf(ctrl, policy)).toBe('toggle');
    expect(intentOf(shift, policy)).toBe('replace');
  });

  it('ranges on the range key, which wins over the toggle key', () => {
    const policy = { mode: 'multi', toggle: ['meta', 'ctrl'], range: 'shift' } as const;
    expect(intentOf(shift, policy)).toBe('range');
    expect(intentOf({ ...none, shift: true, meta: true }, policy)).toBe('range');
  });
});

describe('rangeOf', () => {
  const order = ['a', 'b', 'c', 'd', 'e'];

  it('walks either direction, ends included', () => {
    expect(rangeOf(order, 'b', 'd')).toEqual(['b', 'c', 'd']);
    expect(rangeOf(order, 'd', 'b')).toEqual(['b', 'c', 'd']);
    expect(rangeOf(order, 'c', 'c')).toEqual(['c']);
  });

  it('leaves out what is forced single', () => {
    expect(rangeOf(order, 'a', 'e', (id) => id === 'c')).toEqual(['a', 'b', 'd', 'e']);
  });

  it('is empty when either end is not in the order', () => {
    expect(rangeOf(order, 'a', 'z')).toEqual([]);
    expect(rangeOf(order, 'z', 'a')).toEqual([]);
  });
});

describe('select', () => {
  const order = ['a', 'b', 'c', 'd', 'e'];
  const state = (ids: string[], anchor: string | null = null): Selection<string> => ({ ids, anchor });

  it('replace selects the one id and anchors there', () => {
    expect(select(state(['a', 'b'], 'a'), 'd', 'replace')).toEqual({ ids: ['d'], anchor: 'd' });
  });

  it('toggle adds or removes the id and anchors there', () => {
    expect(select(state(['a'], 'a'), 'c', 'toggle')).toEqual({ ids: ['a', 'c'], anchor: 'c' });
    expect(select(state(['a', 'c'], 'a'), 'a', 'toggle')).toEqual({ ids: ['c'], anchor: 'a' });
  });

  it('single selects the one id and anchors there, whatever is selected', () => {
    expect(select(state(['a', 'b'], 'a'), 'd', 'single', { order })).toEqual({ ids: ['d'], anchor: 'd' });
  });

  it('toggle on a forced-single id selects it alone', () => {
    const locked = (id: string) => id === 'c';
    expect(select(state(['a', 'b'], 'a'), 'c', 'toggle', { forceSingle: locked })).toEqual({ ids: ['c'], anchor: 'c' });
  });

  it('toggle drops forced-single ids already selected', () => {
    const locked = (id: string) => id === 'c';
    expect(select(state(['c'], 'c'), 'a', 'toggle', { forceSingle: locked })).toEqual({ ids: ['a'], anchor: 'a' });
  });

  it('range selects from the anchor to the id and keeps the anchor', () => {
    expect(select(state(['b'], 'b'), 'd', 'range', { order })).toEqual({ ids: ['b', 'c', 'd'], anchor: 'b' });
    expect(select(state(['b', 'c', 'd'], 'b'), 'a', 'range', { order })).toEqual({ ids: ['a', 'b'], anchor: 'b' });
  });

  it('range skips forced-single ids it walks past', () => {
    expect(select(state([], 'a'), 'e', 'range', { order, forceSingle: (id) => id === 'c' }))
      .toEqual({ ids: ['a', 'b', 'd', 'e'], anchor: 'a' });
  });

  it('range on a forced-single id selects it alone and anchors there', () => {
    expect(select(state(['a'], 'a'), 'c', 'range', { order, forceSingle: (id) => id === 'c' }))
      .toEqual({ ids: ['c'], anchor: 'c' });
  });

  it('range from a forced-single anchor leaves the anchor out', () => {
    expect(select(state(['b'], 'b'), 'd', 'range', { order, forceSingle: (id) => id === 'b' }))
      .toEqual({ ids: ['c', 'd'], anchor: 'b' });
  });

  it('returns the same selection when a press changes nothing', () => {
    const one = { ids: ['a'], anchor: 'a' };
    expect(select(one, 'a', 'replace')).toBe(one);
    const span = { ids: ['a', 'b', 'c'], anchor: 'a' };
    expect(select(span, 'c', 'range', { order })).toBe(span);
  });

  it('returns a new selection when only the anchor moves', () => {
    const before = { ids: ['a'], anchor: null };
    expect(select(before, 'a', 'replace')).toEqual({ ids: ['a'], anchor: 'a' });
  });

  it('range takes what `between` gives for the anchor and the id, ahead of the order', () => {
    const between = (from: string, to: string) => (from === 'a' && to === 'e' ? ['a', 'c', 'e'] : []);
    expect(select(state(['a'], 'a'), 'e', 'range', { order, between })).toEqual({ ids: ['a', 'c', 'e'], anchor: 'a' });
  });

  it('range through `between` skips forced-single ids and replaces when it gives nothing', () => {
    const between = () => ['a', 'b', 'c'];
    expect(select(state([], 'a'), 'c', 'range', { between, forceSingle: (id) => id === 'b' }))
      .toEqual({ ids: ['a', 'c'], anchor: 'a' });
    expect(select(state(['a'], 'a'), 'c', 'range', { between: () => [] })).toEqual({ ids: ['c'], anchor: 'c' });
  });

  it('range replaces when there is no anchor, no order, or an end outside the order', () => {
    expect(select(state(['a']), 'c', 'range', { order })).toEqual({ ids: ['c'], anchor: 'c' });
    expect(select(state(['a'], 'a'), 'c', 'range')).toEqual({ ids: ['c'], anchor: 'c' });
    expect(select(state(['a'], 'z'), 'c', 'range', { order })).toEqual({ ids: ['c'], anchor: 'c' });
  });
});
