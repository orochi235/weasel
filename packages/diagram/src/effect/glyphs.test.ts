import { describe, expect, it } from 'vitest';
import { diagramScene } from '../fromData';
import { outlinePolyline } from '../onOutline';
import { BRANCH_SYMBOLS, branchNode, symbolNameFor, type BranchChoice, type BranchNode } from './symbols';
import type { EffectPipeline, EffectStage } from './types';

const P: EffectPipeline = { stages: [], wires: [], types: { bool: { control: true } } };
const yesNo: EffectStage = {
  id: 'q', title: 'high?', kind: 'decision',
  inputs: [{ id: 'in', type: 'image' }, { id: 'when', type: 'bool' }],
  outputs: [{ id: 'yes', type: 'image' }, { id: 'no', type: 'image' }],
};
const bands: EffectStage = {
  id: 'b', title: 'Band', kind: 'decision',
  inputs: [{ id: 'x', type: 'number' }, { id: 'gate', type: 'bool' }],
  outputs: [{ id: 'low', type: 'number' }, { id: 'mid', type: 'number' }, { id: 'high', type: 'number' }],
  split: { input: 'x', at: [0.2, 0.8] },
};
const threshold: EffectStage = {
  id: 't', title: 'Loud?', kind: 'decision',
  inputs: [{ id: 'level', type: 'number' }],
  outputs: [{ id: 'quiet', type: 'number' }, { id: 'loud', type: 'number' }],
  split: { input: 'level', at: [0.5] },
};

const NEW = ['hexagon', 'step', 'comparator', 'crossover', 'fork'] as const;
/** A stage each new symbol can draw. */
const FOR: Record<(typeof NEW)[number], EffectStage> = {
  hexagon: yesNo, step: bands, comparator: yesNo, crossover: bands, fork: yesNo,
};
const at = (node: BranchNode, id: string) => node.ports!.find((p) => p.id === id)!.at;

/** The distance from (x, y) to the nearest point on a closed polyline. */
function offOutline(poly: readonly number[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i + 3 < poly.length; i += 2) {
    const [ax, ay, bx, by] = [poly[i]!, poly[i + 1]!, poly[i + 2]!, poly[i + 3]!];
    const len = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len));
    best = Math.min(best, Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))));
  }
  return best;
}

describe('more branch symbols', () => {
  it('gives every new symbol a port for each of the stage\'s ports, carrying its type', () => {
    for (const choice of NEW) {
      const stage = FOR[choice];
      const node = branchNode(stage, P, choice);
      const want = [...(stage.inputs ?? []), ...(stage.outputs ?? [])];
      expect(node.ports!.map((p) => p.id).sort(), choice).toEqual(want.map((p) => p.id).sort());
      for (const p of want) expect(node.ports!.find((q) => q.id === p.id)!.type, choice).toBe(p.type);
    }
  });

  it('puts every port, at its anchor and at each site, on the outline it draws', () => {
    for (const choice of NEW) {
      for (const controlSide of ['top', 'bottom'] as const) {
        const node = branchNode(FOR[choice], P, choice, { controlSide });
        const box = { x: 0, y: 0, width: node.width ?? 120, height: node.height ?? 48 };
        const poly = outlinePolyline(node.outline ?? 'rect', box);
        for (const port of node.ports!) {
          for (const a of [port.at, ...(port.sites ?? [])]) {
            expect(offOutline(poly, a.u * box.width, a.v * box.height), `${choice} ${controlSide} ${port.id}`).toBeLessThan(1e-3);
          }
        }
      }
    }
  });

  it('falls back to the diamond where a new symbol cannot draw the stage', () => {
    expect(symbolNameFor(yesNo, 'step')).toBe('diamond');
    expect(symbolNameFor(yesNo, 'crossover')).toBe('diamond');
    expect(symbolNameFor(bands, 'comparator')).toBe('diamond');
    expect(BRANCH_SYMBOLS.step(yesNo, P)).toEqual(BRANCH_SYMBOLS.diamond(yesNo, P));
    expect(BRANCH_SYMBOLS.crossover(yesNo, P)).toEqual(BRANCH_SYMBOLS.diamond(yesNo, P));
    expect(BRANCH_SYMBOLS.comparator(bands, P)).toEqual(BRANCH_SYMBOLS.diamond(bands, P));
    for (const choice of ['hexagon', 'fork'] as const) expect(symbolNameFor(bands, choice)).toBe(choice);
  });

  it('brings control inputs in on the control side', () => {
    for (const choice of NEW) {
      const top = branchNode(FOR[choice], P, choice);
      const bottom = branchNode(FOR[choice], P, choice, { controlSide: 'bottom' });
      const id = FOR[choice] === bands ? 'gate' : 'when';
      expect(at(top, id).v, choice).toBeLessThan(0.5);
      expect(at(bottom, id).v, choice).toBeGreaterThan(0.5);
    }
  });

  it('stacks a step\'s and a crossover\'s exits lowest band at the bottom, as a bar does', () => {
    for (const choice of ['step', 'crossover'] as const) {
      const node = branchNode(bands, P, choice);
      expect(at(node, 'low').v).toBeGreaterThan(at(node, 'mid').v);
      expect(at(node, 'mid').v).toBeGreaterThan(at(node, 'high').v);
      expect(at(node, 'low').u).toBe(1);
    }
  });

  it('writes the cut values on a step and a crossover', () => {
    for (const choice of ['step', 'crossover'] as const) {
      const texts = branchNode(bands, P, choice).marks!.flatMap((m) => ('text' in m ? [m.text] : []));
      expect(texts, choice).toEqual(expect.arrayContaining(['0.2', '0.8', 'Band']));
    }
  });

  it('sends a comparator\'s high band out above its low one, and a plain decision\'s first exit above', () => {
    const split = branchNode(threshold, P, 'comparator');
    expect(at(split, 'loud').v).toBeLessThan(at(split, 'quiet').v);
    expect(split.marks!.some((m) => 'text' in m && m.text === '0.5')).toBe(true);
    const plain = branchNode(yesNo, P, 'comparator');
    expect(at(plain, 'yes').v).toBeLessThan(at(plain, 'no').v);
  });

  it('draws a fork as a dot every exit leaves from, with nothing written inside it', () => {
    const node = branchNode(yesNo, P, 'fork');
    expect(node.lines).toEqual([]);
    expect(at(node, 'yes')).toEqual(at(node, 'no'));
    expect(node.width).toBe(node.height);
  });

  it('writes a hexagon\'s title inside it', () => {
    expect(branchNode(yesNo, P, 'hexagon').lines).toEqual(['high?']);
    // The named outline, whose content box stops short of the points; a custom path's is its whole box.
    expect(branchNode(yesNo, P, 'hexagon').outline).toBe('hexagon');
  });

  it('draws the new symbols\' marks in the node style\'s text color', () => {
    const ink = { fill: '#000', stroke: '#111', text: '#123456' };
    for (const choice of NEW) {
      const node = branchNode(FOR[choice], P, choice, { style: ink, tints: ['#abcdef'] });
      const colors = new Set((node.marks ?? []).flatMap((m) =>
        ('d' in m ? [m.stroke, m.fill] : [m.color]).filter((c): c is string => c !== undefined)));
      for (const c of colors) expect(['#123456', '#abcdef'], choice).toContain(c);
    }
  });

  it('draws marks whose path data parses', () => {
    for (const choice of NEW) {
      for (const stage of [yesNo, bands, threshold]) {
        expect(() => diagramScene({ nodes: [{ id: 'n', ...branchNode(stage, P, choice) }], edges: [] }), choice).not.toThrow();
      }
    }
  });

  it('names every symbol in BranchChoice', () => {
    const names: BranchChoice[] = [...NEW];
    expect(Object.keys(BRANCH_SYMBOLS)).toEqual(expect.arrayContaining(names));
  });
});
