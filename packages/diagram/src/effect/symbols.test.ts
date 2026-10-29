import { describe, expect, it } from 'vitest';
import { BRANCH_SYMBOLS, branchNode, symbolNameFor, thrownToSecond } from './symbols';
import type { EffectPipeline, EffectStage } from './types';

const P: EffectPipeline = { stages: [], wires: [], types: { bool: { control: true } } };
const yesNo: EffectStage = {
  id: 'q', title: 'high?', kind: 'decision',
  inputs: [{ id: 'in', type: 'image' }, { id: 'when', type: 'bool' }],
  outputs: [{ id: 'yes', type: 'image' }, { id: 'no', type: 'image' }],
};
const bands: EffectStage = {
  id: 'b', title: 'Band', kind: 'decision',
  inputs: [{ id: 'x', type: 'number' }],
  outputs: [{ id: 'low', type: 'number' }, { id: 'mid', type: 'number' }, { id: 'high', type: 'number' }],
  split: { input: 'x', at: [0.2, 0.8] },
};
const ids = (stage: EffectStage, choice?: Parameters<typeof branchNode>[2]) =>
  (branchNode(stage, P, choice).ports ?? []).map((p) => p.id).sort();
const port = (stage: EffectStage, id: string, choice?: Parameters<typeof branchNode>[2]) =>
  branchNode(stage, P, choice).ports!.find((p) => p.id === id)!;

describe('branch symbols', () => {
  it('gives every symbol a port for each of the stage\'s ports, carrying its type', () => {
    for (const choice of ['diamond', 'demux', 'switch'] as const) {
      expect(ids(yesNo, choice)).toEqual(['in', 'no', 'when', 'yes']);
      expect(port(yesNo, 'when', choice).type).toBe('bool');
    }
    expect(ids(bands, 'bar')).toEqual(['high', 'low', 'mid', 'x']);
  });

  it('picks the bar for a split and the diamond otherwise', () => {
    expect(symbolNameFor(bands)).toBe('bar');
    expect(symbolNameFor(yesNo)).toBe('diamond');
  });

  it('falls back to the diamond where a symbol cannot draw the stage', () => {
    expect(symbolNameFor(yesNo, 'bar')).toBe('diamond');
    expect(symbolNameFor(bands, 'switch')).toBe('diamond');
    expect(symbolNameFor({ ...bands, split: { input: 'x', at: [0.8, 0.2] } }, 'bar')).toBe('diamond');
    expect(symbolNameFor({ ...bands, split: { input: 'x', at: [0.5] } })).toBe('diamond');
  });

  it('draws a diamond when a symbol is called on a stage it cannot draw', () => {
    expect(BRANCH_SYMBOLS.bar(yesNo, P).outline).toBe('diamond');
    expect(BRANCH_SYMBOLS.bar({ ...bands, split: { input: 'x', at: [0.8, 0.2] } }, P).outline).toBe('diamond');
    expect(BRANCH_SYMBOLS.switch(bands, P)).toEqual(BRANCH_SYMBOLS.diamond(bands, P));
    expect(BRANCH_SYMBOLS.switch(yesNo, P).outline).toBe('rect');
  });

  it('puts a diamond\'s control input on top and its two exits right and bottom', () => {
    expect(port(yesNo, 'in', 'diamond').at).toEqual({ u: 0, v: 0.5 });
    expect(port(yesNo, 'when', 'diamond').at).toEqual({ u: 0.5, v: 0 });
    expect(port(yesNo, 'yes', 'diamond').at).toEqual({ u: 1, v: 0.5 });
    expect(port(yesNo, 'no', 'diamond').at).toEqual({ u: 0.5, v: 1 });
  });

  it('puts control inputs on the bottom when told to', () => {
    const bottom = (stage: EffectStage, id: string, choice: Parameters<typeof branchNode>[2]) =>
      branchNode(stage, P, choice, { controlSide: 'bottom' }).ports!.find((p) => p.id === id)!.at;
    for (const choice of ['demux', 'switch'] as const) expect(bottom(yesNo, 'when', choice).v).toBe(1);
    const steered = { ...bands, inputs: [{ id: 'x', type: 'number' }, { id: 'sig', type: 'number' }] };
    expect(bottom(steered, 'x', 'bar').v).toBe(1);
  });

  it('runs down a column under direction: down, its control input on the side it is told', () => {
    const down = (side: 'left' | 'right') => branchNode(yesNo, P, 'diamond', { direction: 'down', controlSide: side });
    const at = (side: 'left' | 'right', id: string) => down(side).ports!.find((p) => p.id === id)!;
    expect(at('left', 'in').at).toEqual({ u: 0.5, v: 0 });
    expect(at('left', 'when').at).toEqual({ u: 0, v: 0.5 });
    expect(at('left', 'yes').at).toEqual({ u: 0.5, v: 1 });
    expect(at('left', 'no').at).toEqual({ u: 1, v: 0.5 });
    expect(at('right', 'when').at).toEqual({ u: 0.75, v: 0.25 });
    expect(at('right', 'no').sites).toEqual([{ u: 0, v: 0.5 }]);
    const sw = branchNode(yesNo, P, 'switch', { direction: 'down', controlSide: 'right' });
    expect(sw.ports!.find((p) => p.id === 'when')!.at).toEqual({ u: 1, v: 0.5 });
    expect(sw.marks!.find((m) => 'text' in m)).toMatchObject({ at: { u: 0, v: 0.5 }, self: { u: 1, v: 0.5 } });
  });

  it('turns a symbol\'s box and outline with it, keeping a diamond\'s name', () => {
    const bar = branchNode(bands, P, 'bar', { direction: 'down' });
    const along = branchNode(bands, P, 'bar');
    expect([bar.width, bar.height]).toEqual([along.height, along.width]);
    expect(branchNode(yesNo, P, 'diamond', { direction: 'down' }).outline).toBe('diamond');
    expect(typeof branchNode(yesNo, P, 'demux', { direction: 'down' }).outline).toBe('object');
  });

  it('sets a turned step\'s title out past its cut labels, which share its side, and leaves the row form alone', () => {
    const fine = { ...bands, split: { input: 'x', at: [0.125, 0.875] } };
    const texts = (node: ReturnType<typeof branchNode>) => node.marks!.flatMap((m) => ('text' in m ? [m] : []));
    const turned = texts(branchNode(fine, P, 'step', { direction: 'down' }));
    const name = turned.find((m) => m.text === 'Band')!;
    expect(name.self).toEqual({ u: 0, v: 0.5 });
    for (const cut of turned.filter((m) => m !== name)) {
      expect(cut.self).toEqual({ u: 0, v: 0.5 });
      // Six pixels a character at the labels' 10px size: wider than a digit in any UI face.
      expect(cut.offset!.x + 6 * cut.text.length).toBeLessThan(name.offset!.x);
    }
    expect(texts(branchNode(fine, P, 'step')).find((m) => m.text === 'Band')!.offset).toEqual({ x: 0, y: 18 });
  });

  it('throws a switch turned down a column to its second exit, as it does along a row', () => {
    const marks = branchNode(yesNo, P, 'switch', { direction: 'down' }).marks!.flatMap((m) => ('d' in m ? [m.d] : []));
    expect(marks.filter((d) => thrownToSecond(d) !== undefined)).toHaveLength(3);
  });

  it('keeps a diamond\'s second exit on the bottom vertex when control comes from below', () => {
    // On the vertex, the exit would have to leave by the top, and its wire to a stage below
    // would cross the diamond.
    const node = branchNode(yesNo, P, 'diamond', { controlSide: 'bottom' });
    const at = (id: string) => node.ports!.find((p) => p.id === id)!;
    expect(at('when').at).toEqual({ u: 0.25, v: 0.75 });
    expect(at('no').at).toEqual({ u: 0.5, v: 1 });
    expect(at('no').sites).toEqual([{ u: 0.5, v: 0 }]);
  });

  it('moves a symbol\'s title above it when control comes from below, clear of the control port', () => {
    for (const choice of ['demux', 'switch'] as const) {
      const titles = (side: 'top' | 'bottom') => branchNode(yesNo, P, choice, { controlSide: side }).marks!
        .filter((m) => 'text' in m && m.text === yesNo.title);
      expect(titles('top')[0]).toMatchObject({ at: { v: 1 } });
      expect(titles('bottom')[0]).toMatchObject({ at: { v: 0 }, self: { v: 1 } });
    }
  });

  it('draws a symbol\'s marks in its node style\'s text color, and a bypassed one dim', () => {
    const colors = (node: ReturnType<typeof branchNode>) => new Set(node.marks!.flatMap((m) =>
      ('d' in m ? [m.stroke, m.fill] : [m.color]).filter((c): c is string => c !== undefined)));
    const ink = { fill: '#000', stroke: '#111', text: '#123456' };
    expect(colors(branchNode(yesNo, P, 'switch', { style: ink }))).toEqual(new Set(['#123456']));
    const bypassed = colors(branchNode({ ...bands, bypassed: true }, P, 'bar'));
    expect(bypassed.has('#dbe7f2')).toBe(false);
    expect([...colors(branchNode(bands, P, 'bar', { style: ink, tints: ['#abcdef'] }))].sort()).toEqual(['#123456', '#abcdef']);
  });

  it('stacks a bar\'s bands lowest at the bottom, with a tick and its value at each cut', () => {
    const node = branchNode(bands, P, 'bar');
    expect(port(bands, 'low', 'bar').at.v).toBeCloseTo(5 / 6, 6);
    expect(port(bands, 'high', 'bar').at.v).toBeCloseTo(1 / 6, 6);
    const ticks = node.marks!.filter((m) => 'd' in m && m.stroke !== undefined);
    const heights = ticks.map((m) => Number(('d' in m ? m.d : '').match(/^M-0\.25 (\S+) H1\.25$/)![1]));
    expect(heights).toHaveLength(2);
    expect(heights[0]).toBeCloseTo(2 / 3, 6);
    expect(heights[1]).toBeCloseTo(1 / 3, 6);
    expect(node.marks!.filter((m) => 'text' in m).map((m) => 'text' in m && m.text)).toEqual(['0.2', '0.8', 'Band']);
  });

  it('draws a demux as a trapezoid with its exits down the wide side', () => {
    const node = branchNode(yesNo, P, 'demux');
    expect(node.outline).toBe('trapezoid');
    expect(port(yesNo, 'yes', 'demux').at.u).toBe(1);
    expect(port(yesNo, 'when', 'demux').at.v).toBe(0);
  });
});
