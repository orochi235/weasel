import { describe, expect, it } from 'vitest';
import { diagramScene, type DiagramSpec } from '../fromData';
import { NO_VALUE } from './draw';
import { nodeGraph } from './nodeGraph';
import { rack } from './rack';
import { costText, paintRun } from './run';
import type { EffectPipeline, EffectRun } from './types';

/** `src` into a decision that sends the signal to `soft` or `hard`. */
const PIPELINE: EffectPipeline = {
  stages: [
    { id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
    {
      id: 'pick', title: 'Pick', kind: 'decision',
      inputs: [{ id: 'in', type: 'image' }],
      outputs: [{ id: 'a', label: 'soft', type: 'image' }, { id: 'b', label: 'hard', type: 'image' }],
    },
    { id: 'soft', title: 'Soften', inputs: [{ id: 'in', type: 'image' }], outputs: [{ id: 'out', label: 'result', type: 'image' }] },
    { id: 'hard', title: 'Harden', inputs: [{ id: 'in', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] },
  ],
  wires: [
    { from: { stage: 'src', port: 'out' }, to: { stage: 'pick', port: 'in' } },
    { from: { stage: 'pick', port: 'a' }, to: { stage: 'soft', port: 'in' } },
    { from: { stage: 'pick', port: 'b' }, to: { stage: 'hard', port: 'in' } },
  ],
};

/** `src` reached `pick`, which chose `soft`; `hard` never ran. */
const RUN: EffectRun = {
  stages: {
    src: { cost: 0.42, values: { out: '512×512' } },
    pick: { taken: 'a' },
    soft: { cost: 1234.5, values: { out: '0.75' } },
  },
};

const built = (look = nodeGraph) => {
  const drawn = look(PIPELINE, { showValues: true });
  return diagramScene(drawn.data, drawn.scene);
};
const byId = (specs: readonly DiagramSpec[], id: string) => specs.find((s) => s.id === id)!;
const opacity = (spec: DiagramSpec, part: 'fill' | 'stroke') =>
  (spec.data as Record<string, { paint?: { opacity?: number } } | undefined>)[part]?.paint?.opacity;
const wireFrom = (specs: readonly DiagramSpec[], stage: string, port: string) => specs.find((s) => {
  const d = (s.data as { diagram?: { from?: { port?: string } } }).diagram;
  return Array.isArray(s.dependsOn) && s.dependsOn[0] === stage && d?.from?.port === port;
})!;

describe('paintRun', () => {
  it('changes nothing without a run', () => {
    const specs = built();
    expect(paintRun(PIPELINE, specs, undefined)).toEqual(specs);
  });

  it('moves nothing: every spec it had keeps its pose', () => {
    const specs = built();
    const painted = paintRun(PIPELINE, specs, RUN);
    for (const spec of specs) expect(byId(painted, spec.id as string).pose).toEqual(spec.pose);
  });

  it('fades a stage the run never reached, with its rows and its wires', () => {
    const specs = built();
    const painted = paintRun(PIPELINE, specs, RUN);
    expect(opacity(byId(painted, 'hard'), 'fill')).toBeLessThan(1);
    expect(opacity(byId(painted, 'hard'), 'stroke')).toBeLessThan(1);
    const rows = painted.filter((s) => s.parent === 'hard' && (s.data as { text?: string }).text !== undefined);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(opacity(row, 'fill')).toBeLessThan(1);
    expect(opacity(byId(painted, 'soft'), 'fill')).toBeUndefined();
  });

  it('fades a decision\'s wire to an output it did not take, and its label, and not the one it took', () => {
    const specs = built();
    const painted = paintRun(PIPELINE, specs, RUN);
    const skipped = wireFrom(painted, 'pick', 'b');
    expect(opacity(skipped, 'stroke')).toBeLessThan(1);
    expect(opacity(byId(painted, `${skipped.id as string}/label`), 'fill')).toBeLessThan(1);
    expect(opacity(wireFrom(painted, 'pick', 'a'), 'stroke')).toBeUndefined();
  });

  it('writes each output\'s value into the row kept for it, and a dash where the run has none', () => {
    const painted = paintRun(PIPELINE, built(), RUN);
    const text = (id: string) => (byId(painted, id).data as { text: string }).text;
    expect(text('src/value:out')).toBe('out: 512×512');
    expect(text('soft/value:out')).toBe('result: 0.75');
    expect(text('hard/value:out')).toBe(`out: ${NO_VALUE}`);
  });

  it('writes a stage\'s cost just above its top-right corner', () => {
    const painted = paintRun(PIPELINE, built(), RUN);
    const box = byId(painted, 'soft').pose as { x: number; y: number; width: number };
    const cost = byId(painted, 'soft/cost');
    const at = cost.pose as { x: number; y: number; width: number; height: number };
    expect((cost.data as { text: string }).text).toBe('1235 ms');
    expect(at.x + at.width).toBeCloseTo(box.x + box.width);
    expect(at.y + at.height).toBeLessThanOrEqual(box.y);
    expect(painted.some((s) => s.id === 'hard/cost')).toBe(false);
  });

  it('works the same over the rack look, whose wires are labeled differently', () => {
    const painted = paintRun(PIPELINE, built(rack), RUN);
    expect(opacity(byId(painted, 'hard'), 'fill')).toBeLessThan(1);
    expect(opacity(wireFrom(painted, 'pick', 'b'), 'stroke')).toBeLessThan(1);
    expect((byId(painted, 'soft/value:out').data as { text: string }).text).toBe('result: 0.75');
  });
});

describe('costText', () => {
  it('gives three figures, and whole milliseconds from 100 up', () => {
    expect([costText(0.4213), costText(12.345), costText(1234.5)]).toEqual(['0.421 ms', '12.3 ms', '1235 ms']);
  });
});
