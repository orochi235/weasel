import { describe, expect, it } from 'vitest';
import { BRANCH_SYMBOLS, branchNode, symbolNameFor } from './symbols';
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
