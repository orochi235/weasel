import { describe, expect, it } from 'vitest';
import { mainChain, skipDecisions } from './mainChain';
import { ADJACENT, LANDS_ON_DECISION, SKIP, w } from './skipFixture';

describe('mainChain', () => {
  it('is the longest path over data wires', () => {
    expect(mainChain(SKIP)).toEqual(['src', 'q', 'blur', 'mix', 'out']);
  });

  it('does not follow a control wire', () => {
    expect(mainChain(SKIP)).not.toContain('osc');
  });

  it('ends on a pipeline with a feedback wire', () => {
    const loop = { ...SKIP, wires: [...SKIP.wires, w(['mix', 'out'], ['blur', 'in'])] };
    const line = mainChain(loop);
    expect(line[0]).toBe('src');
    expect(new Set(line).size).toBe(line.length);
  });

  it('finds the longest path past a feedback loop, whatever order the stages are listed in', () => {
    const st = (id: string) => ({ id, title: id, inputs: [{ id: 'in', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] });
    const wire = (a: string, b: string) => ({ from: { stage: a, port: 'out' }, to: { stage: b, port: 'in' } });
    const wires = [wire('A', 'B'), wire('B', 'C'), wire('C', 'A'), wire('C', 'D')];
    expect(mainChain({ stages: ['C', 'A', 'B', 'D'].map(st), wires })).toEqual(['A', 'B', 'C', 'D']);
    expect(mainChain({ stages: ['A', 'B', 'C', 'D'].map(st), wires })).toEqual(['A', 'B', 'C', 'D']);
    const into = [wire('A', 'B'), wire('B', 'C'), wire('C', 'A'), wire('D', 'B')];
    expect(mainChain({ stages: ['A', 'B', 'C', 'D'].map(st), wires: into })).toEqual(['D', 'B', 'C', 'A']);
  });

  it('answers a dense loop of many stages', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `s${i}`);
    const stages = ids.map((id) => ({ id, title: id, inputs: [{ id: 'in', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] }));
    const wires = ids.flatMap((a) => ids.filter((b) => b !== a).map((b) => ({ from: { stage: a, port: 'out' }, to: { stage: b, port: 'in' } })));
    expect(mainChain({ stages, wires }).length).toBeGreaterThan(1);
  });

  it('is empty for an empty pipeline', () => {
    expect(mainChain({ stages: [], wires: [] })).toEqual([]);
  });
});

describe('skipDecisions', () => {
  it('finds a decision whose one exit goes on and whose other skips ahead', () => {
    const [skip] = skipDecisions(SKIP, mainChain(SKIP));
    expect(skip!.decision.id).toBe('q');
    expect(skip!.through.wire.to.stage).toBe('blur');
    expect(skip!.skip.wire.to.stage).toBe('mix');
    expect(skip!.into.wire.from.stage).toBe('src');
  });

  it('leaves two adjacent skip-ahead decisions alone', () => {
    expect(mainChain(ADJACENT)).toEqual(['src', 'q1', 'q2', 'mix', 'blur', 'out']);
    expect(skipDecisions(ADJACENT, mainChain(ADJACENT))).toEqual([]);
  });

  it('leaves a decision whose skip lands on another decision alone', () => {
    expect(mainChain(LANDS_ON_DECISION)).toEqual(['src', 'q', 'a', 'd', 'out']);
    expect(skipDecisions(LANDS_ON_DECISION, mainChain(LANDS_ON_DECISION))).toEqual([]);
  });

  it('leaves a decision with a second input alone', () => {
    const steered = { ...SKIP, stages: SKIP.stages.map((s) => (s.id === 'q'
      ? { ...s, inputs: [...s.inputs!, { id: 'when', type: 'number' }] } : s)) };
    expect(skipDecisions(steered, mainChain(steered))).toEqual([]);
  });
});
