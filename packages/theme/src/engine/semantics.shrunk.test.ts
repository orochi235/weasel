/** Counterexamples `derive.malformed.pbt.test.ts` shrank to for semantic rules, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { axisDependencies } from './deps';
import { derive } from './derive';

const loaded = (json: string) => JSON.parse(json) as ThemeDefinition;

describe('a semantic rule whose fields have the wrong types', () => {
  it('reports a check with no surfaces list, rather than throwing', () => {
    expect(derive(loaded('{"name":"t","semantics":{"surface":{"check":{}}}}')).issues).toEqual([
      { kind: 'invalid', path: 'semantics.surface', message: 'check needs a number contrast and a list of names against' },
    ]);
  });

  it('reports a ref that names no token, and a contrast rule whose against is not a list', () => {
    const { issues } = derive(loaded('{"name":"t","semantics":{"a":{"ref":3},"b":{"ramp":"g","contrast":{"min":3,"against":"a"}}}}'));
    expect(issues.map((i) => i.kind === 'invalid' && i.path)).toEqual(['semantics.a', 'semantics.b']);
  });

  it('leaves a rule that is not an object out of the axis dependencies, which derive reports', () => {
    expect(axisDependencies(loaded('{"name":"t","semantics":{"surface":0,"line":{"ref":"surface"}}}'))).toEqual({
      surface: { own: [], all: [] },
      line: { own: [], all: [] },
    });
  });
});
