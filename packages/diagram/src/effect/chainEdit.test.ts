import { describe, expect, it } from 'vitest';
import { canMoveInChain, chainLinks, moveInChain, moveRunInChain } from './chainEdit';
import { mainChain } from './mainChain';
import type { EffectDoc, EffectPipeline, EffectStage, EffectWire } from './types';

const img = (id: string, extra: Partial<EffectStage> = {}): EffectStage => ({
  id, title: id, inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }], ...extra,
});
const wire = (id: string, from: string, fromPort: string, to: string, toPort: string): EffectWire =>
  ({ id, from: { stage: from, port: fromPort }, to: { stage: to, port: toPort } });

/** src → a → b → c → out on images, a mask fed into b from the side, a control number into c. */
const PIPELINE: EffectPipeline = {
  stages: [
    { id: 'src', title: 'src', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
    img('a'),
    img('b', { inputs: [{ id: 'image', type: 'image' }, { id: 'mask', type: 'mask' }] }),
    img('c', { inputs: [{ id: 'image', type: 'image' }, { id: 'amount', type: 'number' }] }),
    { id: 'out', title: 'out', kind: 'sink', inputs: [{ id: 'in', type: 'image' }] },
    { id: 'm', title: 'm', kind: 'source', outputs: [{ id: 'out', type: 'mask' }] },
    { id: 'ctl', title: 'ctl', kind: 'source', outputs: [{ id: 'out', type: 'number' }] },
  ],
  wires: [
    wire('w1', 'src', 'out', 'a', 'image'),
    wire('w2', 'a', 'out', 'b', 'image'),
    wire('w3', 'b', 'out', 'c', 'image'),
    wire('w4', 'c', 'out', 'out', 'in'),
    wire('w5', 'm', 'out', 'b', 'mask'),
    wire('w6', 'ctl', 'out', 'c', 'amount'),
  ],
  types: { number: { control: true } },
};
const DOC: EffectDoc = { pipeline: PIPELINE, places: {} };

const ends = (d: EffectDoc | null) =>
  (d?.pipeline.wires ?? []).map((w) => `${w.from.stage}.${w.from.port}>${w.to.stage}.${w.to.port}`).sort();

describe('chainLinks', () => {
  it('names each chain stage’s main input and output, and the wire between neighbors', () => {
    const links = chainLinks(PIPELINE, mainChain(PIPELINE));
    expect(Object.fromEntries(links.mainIn)).toEqual({ a: 'image', b: 'image', c: 'image', out: 'in' });
    expect(Object.fromEntries(links.mainOut)).toEqual({ src: 'out', a: 'out', b: 'out', c: 'out' });
    expect(links.between).toEqual([0, 1, 2, 3]);
  });
});

describe('moveInChain', () => {
  it('splices a stage forward, wiring its old neighbors to each other', () => {
    const next = moveInChain(DOC, 'a', 4);
    expect(mainChain(next!.pipeline)).toEqual(['src', 'b', 'c', 'a', 'out']);
    expect(ends(next)).toEqual([
      'a.out>out.in', 'b.out>c.image', 'c.out>a.image', 'ctl.out>c.amount', 'm.out>b.mask', 'src.out>b.image',
    ]);
  });

  it('splices a stage back', () => {
    const next = moveInChain(DOC, 'c', 1);
    expect(mainChain(next!.pipeline)).toEqual(['src', 'c', 'a', 'b', 'out']);
  });

  it('keeps side and control wires, and every wire id unique', () => {
    const next = moveInChain(DOC, 'c', 1)!;
    expect(next.pipeline.wires).toContainEqual(PIPELINE.wires[4]);
    expect(next.pipeline.wires).toContainEqual(PIPELINE.wires[5]);
    const ids = next.pipeline.wires.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('moves a stage to the end of a chain with no sink', () => {
    const open: EffectDoc = { ...DOC, pipeline: { ...PIPELINE, wires: PIPELINE.wires.filter((w) => w.id !== 'w4') } };
    const next = moveInChain(open, 'a', 4);
    expect(mainChain(next!.pipeline)).toEqual(['src', 'b', 'c', 'a']);
  });

  it('moves a stage to the front of a chain with no source', () => {
    const bare: EffectDoc = {
      places: {},
      pipeline: { stages: [img('a'), img('b'), img('c')], wires: [wire('w1', 'a', 'out', 'b', 'image'), wire('w2', 'b', 'out', 'c', 'image')] },
    };
    const next = moveInChain(bare, 'c', 0);
    expect(mainChain(next!.pipeline)).toEqual(['c', 'a', 'b']);
    expect(ends(next)).toEqual(['a.out>b.image', 'c.out>a.image']);
  });

  it('refuses a splice that would wire unlike types', () => {
    const mixed: EffectDoc = {
      places: {},
      pipeline: {
        stages: [
          { id: 'src', title: 'src', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
          { id: 'measure', title: 'measure', inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'n', type: 'num' }] },
          { id: 'scale', title: 'scale', inputs: [{ id: 'n', type: 'num' }], outputs: [{ id: 'n', type: 'num' }] },
        ],
        wires: [wire('w1', 'src', 'out', 'measure', 'image'), wire('w2', 'measure', 'n', 'scale', 'n')],
      },
    };
    expect(moveInChain(mixed, 'scale', 1)).toBeNull();
    expect(canMoveInChain(mixed, 'scale', 1)).toBe(false);
  });

  it('refuses a stage in front of a source, which has no input', () => {
    expect(moveInChain(DOC, 'a', 0)).toBeNull();
  });

  it('refuses a move to where the stage already is, and a stage off the line', () => {
    expect(moveInChain(DOC, 'b', 2)).toBeNull();
    expect(moveInChain(DOC, 'b', 3)).toBeNull();
    expect(moveInChain(DOC, 'm', 1)).toBeNull();
    expect(canMoveInChain(DOC, 'a', 4)).toBe(true);
  });
});

describe('moveRunInChain', () => {
  it('moves a run of stages as one, keeping the wires inside it', () => {
    const next = moveRunInChain(DOC, 'a', 'b', 4)!;
    expect(mainChain(next.pipeline)).toEqual(['src', 'c', 'a', 'b', 'out']);
    expect(ends(next)).toEqual([
      'a.out>b.image', 'b.out>out.in', 'c.out>a.image', 'ctl.out>c.amount', 'm.out>b.mask', 'src.out>c.image',
    ]);
    expect(next.pipeline.wires.find((w) => w.id === 'w2')).toEqual(PIPELINE.wires[1]);
  });

  it('moves a run back', () => {
    expect(mainChain(moveRunInChain(DOC, 'b', 'c', 1)!.pipeline)).toEqual(['src', 'b', 'c', 'a', 'out']);
  });

  it('refuses a gap inside the run, at either end of it, and a run given backward', () => {
    expect(moveRunInChain(DOC, 'a', 'c', 2)).toBeNull();
    expect(moveRunInChain(DOC, 'a', 'c', 3)).toBeNull();
    expect(moveRunInChain(DOC, 'a', 'c', 1)).toBeNull();
    expect(moveRunInChain(DOC, 'a', 'c', 4)).toBeNull();
    expect(moveRunInChain(DOC, 'c', 'a', 0)).toBeNull();
  });

  it('moves a run that ends the chain back', () => {
    const open: EffectDoc = { ...DOC, pipeline: { ...PIPELINE, wires: PIPELINE.wires.filter((w) => w.id !== 'w4') } };
    const next = moveRunInChain(open, 'b', 'c', 1)!;
    expect(mainChain(next.pipeline)).toEqual(['src', 'b', 'c', 'a']);
    expect(ends(next)).toEqual(['b.out>c.image', 'c.out>a.image', 'ctl.out>c.amount', 'm.out>b.mask', 'src.out>b.image']);
  });

  it('moves a run that starts the chain to the last gap, and refuses that gap past a sink', () => {
    const bare: EffectDoc = {
      places: {},
      pipeline: { stages: [img('a'), img('b'), img('c')], wires: [wire('w1', 'a', 'out', 'b', 'image'), wire('w2', 'b', 'out', 'c', 'image')] },
    };
    const next = moveRunInChain(bare, 'a', 'b', 3)!;
    expect(mainChain(next.pipeline)).toEqual(['c', 'a', 'b']);
    expect(ends(next)).toEqual(['a.out>b.image', 'c.out>a.image']);
    expect(moveRunInChain(DOC, 'a', 'b', 5)).toBeNull();
  });

  it('is moveInChain for a run of one', () => {
    expect(moveRunInChain(DOC, 'a', 'a', 4)).toEqual(moveInChain(DOC, 'a', 4));
  });
});
