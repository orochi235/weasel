/**
 * `readEffectDoc` against what a file can hold: every shipped sample reads back as itself, and any value, or a
 * sample with one field swapped for anything, is either read or refused with an `EffectDocShapeError`. What it reads
 * the pipeline checker and the looks then take without throwing.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkPipeline } from './check';
import { EffectDocShapeError, readEffectDoc } from './docShape';
import { SAMPLES } from './lab/samples';
import { EFFECT_LOOKS } from './looks';
import type { EffectDoc } from './types';

const docs: EffectDoc[] = Object.values(SAMPLES).map((pipeline) => ({
  pipeline,
  places: Object.fromEntries(pipeline.stages.map((s, i) => [s.id, { x: i * 10, y: 0 }])),
}));

/** `value` with the field at a random path through it replaced by `swap`. */
function poke(value: unknown, path: readonly number[], swap: unknown): unknown {
  if (path.length === 0 || typeof value !== 'object' || value === null) return swap;
  const keys = Object.keys(value);
  if (keys.length === 0) return swap;
  const key = keys[path[0]! % keys.length]!;
  const copy: Record<string, unknown> = Array.isArray(value) ? [...value] as unknown as Record<string, unknown> : { ...value };
  copy[key] = poke((value as Record<string, unknown>)[key], path.slice(1), swap);
  return copy;
}

const reads = (value: unknown): EffectDoc | null => {
  try {
    return readEffectDoc(value);
  } catch (err) {
    expect(err).toBeInstanceOf(EffectDocShapeError);
    return null;
  }
};

describe('readEffectDoc', () => {
  it('reads every sample as itself', () => {
    for (const doc of docs) expect(readEffectDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it.each([
    ['a stage that is null', { pipeline: { stages: [null], wires: [] }, places: {} }, 'doc.pipeline.stages[0]'],
    ['a wire with no from', { pipeline: { stages: [], wires: [{ to: { stage: 'a', port: 'b' } }] }, places: {} }, 'doc.pipeline.wires[0].from'],
    ['a place that is a number', { pipeline: { stages: [], wires: [] }, places: { a: 3 } }, 'doc.places.a'],
  ])('refuses %s, naming where', (_, value, path) => {
    expect(() => readEffectDoc(value)).toThrow(expect.objectContaining({ path }));
  });

  it('refuses anything that is not a document with its own error', () => {
    fc.assert(fc.property(fc.anything(), (value) => { reads(value); }));
  });

  it('reads or refuses a sample with any one field swapped, and what it reads every look draws', () => {
    fc.assert(fc.property(
      fc.constantFrom(...docs), fc.array(fc.nat(), { maxLength: 6 }), fc.anything({ maxDepth: 2 }),
      (doc, path, swap) => {
        const read = reads(poke(doc, path, swap));
        if (!read) return;
        checkPipeline(read.pipeline);
        for (const look of Object.values(EFFECT_LOOKS)) look(read.pipeline);
      },
    ), { numRuns: 300 });
  });
});
