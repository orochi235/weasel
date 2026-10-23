import { describe, expect, it } from 'vitest';
import { canEnter, homeDock, moveBar, resolveLayout, type DockBar, type DockSpec, type FloatPlace, type ToolbarLayout } from './layout';

const docks: DockSpec[] = [
  { id: 'top', edge: 'top' },
  { id: 'left', edge: 'left' },
];
const bar = (id: string, extra: Partial<DockBar> = {}): DockBar => ({
  id,
  label: id,
  docks: ['top', 'left'],
  vertical: true,
  render: () => null,
  ...extra,
});
const place: FloatPlace = { x: 10, y: 20, anchor: null, orientation: 'horizontal' };

describe('resolveLayout', () => {
  it('puts every bar in its first allowed dock, in bar order, when there is no layout', () => {
    const out = resolveLayout(docks, [bar('a'), bar('b', { docks: ['left'] }), bar('c')], undefined);
    expect(out).toEqual({ docks: { top: [['a', 'c']], left: [['b']] }, floating: {} });
  });

  it('keeps a valid stored layout', () => {
    const stored: ToolbarLayout = { docks: { top: [['b'], ['a']], left: [] }, floating: {} };
    const out = resolveLayout(docks, [bar('a'), bar('b')], stored);
    expect(out.docks).toEqual({ top: [['b'], ['a']], left: [] });
  });

  it('returns a new object and never mutates its input', () => {
    const stored: ToolbarLayout = { docks: { top: [['a'], []], left: [] }, floating: {} };
    const copy = structuredClone(stored);
    const out = resolveLayout(docks, [bar('a')], stored);
    expect(out).not.toBe(stored);
    expect(out.docks.top).not.toBe(stored.docks.top);
    expect(stored).toEqual(copy);
  });

  it('lists dock keys in declaration order', () => {
    const stored: ToolbarLayout = { docks: { left: [['b']], top: [['a']] }, floating: {} };
    const out = resolveLayout(docks, [bar('a'), bar('b')], stored);
    expect(Object.keys(out.docks)).toEqual(['top', 'left']);
  });

  it('drops unknown bar ids and unknown docks', () => {
    const stored: ToolbarLayout = {
      docks: { top: [['ghost', 'a']], nowhere: [['b']] },
      floating: { ghost: place },
    };
    const out = resolveLayout(docks, [bar('a'), bar('b')], stored);
    expect(out.docks).toEqual({ top: [['a', 'b']], left: [] });
    expect(out.floating).toEqual({});
  });

  it('removes empty rows', () => {
    const stored: ToolbarLayout = { docks: { top: [[], ['a'], ['ghost']], left: [] }, floating: {} };
    expect(resolveLayout(docks, [bar('a')], stored).docks.top).toEqual([['a']]);
  });

  it('places a bar once even when the layout lists it twice', () => {
    const stored: ToolbarLayout = { docks: { top: [['a']], left: [['a']] }, floating: { a: place } };
    const out = resolveLayout(docks, [bar('a', { float: true })], stored);
    expect(out).toEqual({ docks: { top: [['a']], left: [] }, floating: {} });
  });

  it('moves a bar in a dock it no longer allows to its first allowed dock, last row', () => {
    const stored: ToolbarLayout = { docks: { top: [['a']], left: [['x'], ['b']] }, floating: {} };
    const bars = [bar('a'), bar('b', { docks: ['top'] }), bar('x', { docks: ['left'] })];
    const out = resolveLayout(docks, bars, stored);
    expect(out.docks).toEqual({ top: [['a', 'b']], left: [['x']] });
  });

  it('puts a bar absent from the layout at the end of its first allowed dock last row', () => {
    const stored: ToolbarLayout = { docks: { top: [['a'], ['b']], left: [] }, floating: {} };
    const out = resolveLayout(docks, [bar('a'), bar('b'), bar('c')], stored);
    expect(out.docks.top).toEqual([['a'], ['b', 'c']]);
  });

  it('docks a floating bar whose float is no longer true', () => {
    const stored: ToolbarLayout = { docks: {}, floating: { a: place } };
    const out = resolveLayout(docks, [bar('a')], stored);
    expect(out).toEqual({ docks: { top: [['a']], left: [] }, floating: {} });
  });

  it('takes a bar’s first allowed dock in the bar’s own order, not the order the docks are declared in', () => {
    const bars = [bar('a', { docks: ['left', 'top'] }), bar('b', { docks: ['gone', 'left', 'top'] })];
    expect(resolveLayout(docks, bars, undefined)).toEqual({ docks: { top: [], left: [['a', 'b']] }, floating: {} });
    const stored: ToolbarLayout = { docks: {}, floating: { a: place } };
    expect(resolveLayout(docks, [bar('a', { docks: ['left', 'top'] })], stored).docks).toEqual({ top: [], left: [['a']] });
  });

  it('keeps a floating bar that may still float', () => {
    const stored: ToolbarLayout = { docks: {}, floating: { a: place } };
    const out = resolveLayout(docks, [bar('a', { float: true })], stored);
    expect(out.floating).toEqual({ a: place });
    expect(out.docks).toEqual({ top: [], left: [] });
  });

  it('floats a bar that may not run vertical horizontally, whatever orientation was stored', () => {
    const stored: ToolbarLayout = { docks: {}, floating: { a: { ...place, orientation: 'vertical' }, b: { ...place, orientation: 'vertical' } } };
    const out = resolveLayout(docks, [bar('a', { float: true, vertical: undefined }), bar('b', { float: true })], stored);
    expect(out.floating.a.orientation).toBe('horizontal');
    expect(out.floating.b.orientation).toBe('vertical');
  });

  it('coerces a stored floating place: a non-finite x or y to 0, an unknown anchor to null', () => {
    const bad = { x: Number.NaN, y: Infinity, anchor: 'middle', orientation: 'horizontal' } as unknown as FloatPlace;
    const out = resolveLayout(docks, [bar('a', { float: true })], { docks: {}, floating: { a: bad } });
    expect(out.floating.a).toEqual({ x: 0, y: 0, anchor: null, orientation: 'horizontal' });
    const good = { ...place, anchor: 'bottom-right' as const };
    expect(resolveLayout(docks, [bar('a', { float: true })], { docks: {}, floating: { a: good } }).floating.a).toEqual(good);
  });
});

describe('a bar that may not run vertical', () => {
  const flat = (id: string, extra: Partial<DockBar> = {}) => bar(id, { vertical: undefined, ...extra });

  it('may enter only the docks it lists, and a left or right one only with vertical', () => {
    expect(canEnter(bar('a'), { id: 'left', edge: 'left' })).toBe(true);
    expect(canEnter(flat('a'), { id: 'left', edge: 'left' })).toBe(false);
    expect(canEnter(flat('a', { docks: ['side'] }), { id: 'side', edge: 'right' })).toBe(false);
    expect(canEnter(flat('a'), { id: 'top', edge: 'top' })).toBe(true);
    expect(canEnter(bar('a'), { id: 'bottom', edge: 'bottom' })).toBe(false);
  });

  it('is moved out of a left dock a stored layout put it in, to its home dock', () => {
    const stored: ToolbarLayout = { docks: { top: [['b']], left: [['a', 'v']] }, floating: {} };
    const out = resolveLayout(docks, [flat('a'), bar('b'), bar('v')], stored);
    expect(out.docks).toEqual({ top: [['b', 'a']], left: [['v']] });
  });

  it('skips a left dock it lists first when finding its home dock', () => {
    const a = flat('a', { docks: ['left', 'top'] });
    expect(homeDock(docks, a)?.id).toBe('top');
    expect(resolveLayout(docks, [a], undefined).docks).toEqual({ top: [['a']], left: [] });
  });

  it('floats, if it may, when every dock it lists runs vertical', () => {
    const out = resolveLayout(docks, [flat('a', { docks: ['left'], float: true })], undefined);
    expect(out).toEqual({ docks: { top: [], left: [] }, floating: { a: { x: 0, y: 0, anchor: null, orientation: 'horizontal' } } });
  });

  it('is still moved into a left dock by moveBar, which checks nothing', () => {
    const layout: ToolbarLayout = { docks: { top: [['a']], left: [] }, floating: {} };
    expect(moveBar(layout, 'a', { dock: 'left', row: 0, index: 0 }).docks).toEqual({ top: [], left: [['a']] });
  });
});

describe('moveBar', () => {
  const layout: ToolbarLayout = { docks: { top: [['a', 'b'], ['c']], left: [] }, floating: {} };

  it('moves within a row', () => {
    expect(moveBar(layout, 'a', { dock: 'top', row: 0, index: 1 }).docks.top).toEqual([['b', 'a'], ['c']]);
  });

  it('moves across rows', () => {
    expect(moveBar(layout, 'a', { dock: 'top', row: 1, index: 0 }).docks.top).toEqual([['b'], ['a', 'c']]);
  });

  it('appends a new row when the row index is the row count', () => {
    expect(moveBar(layout, 'b', { dock: 'top', row: 2, index: 0 }).docks.top).toEqual([['a'], ['c'], ['b']]);
  });

  it('inserts a new row at the row index when asked for one', () => {
    expect(moveBar(layout, 'b', { dock: 'top', row: 0, index: 0, newRow: true }).docks.top).toEqual([['b'], ['a'], ['c']]);
    expect(moveBar(layout, 'a', { dock: 'top', row: 1, index: 0, newRow: true }).docks.top).toEqual([['b'], ['a'], ['c']]);
  });

  it('appends to a row when the index is past its end', () => {
    expect(moveBar(layout, 'a', { dock: 'top', row: 1, index: 9 }).docks.top).toEqual([['b'], ['c', 'a']]);
  });

  it('removes rows the move leaves empty', () => {
    expect(moveBar(layout, 'c', { dock: 'left', row: 0, index: 0 }).docks).toEqual({ top: [['a', 'b']], left: [['c']] });
  });

  it('moves into floating', () => {
    const out = moveBar(layout, 'a', { float: place });
    expect(out.docks.top).toEqual([['b'], ['c']]);
    expect(out.floating).toEqual({ a: place });
  });

  it('moves from floating into a dock', () => {
    const floating: ToolbarLayout = { docks: { top: [['b']] }, floating: { a: place } };
    const out = moveBar(floating, 'a', { dock: 'top', row: 0, index: 0 });
    expect(out).toEqual({ docks: { top: [['a', 'b']] }, floating: {} });
  });

  it('does not mutate its input', () => {
    const copy = structuredClone(layout);
    moveBar(layout, 'a', { dock: 'left', row: 0, index: 0 });
    expect(layout).toEqual(copy);
  });
});
