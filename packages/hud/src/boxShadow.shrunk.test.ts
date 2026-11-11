/** Counterexamples `boxShadow.pbt.test.ts` shrank to, kept as plain cases. */
import { describe, expect, it } from 'vitest';
import { pointInPath, type Path } from '@weasel-js/geom';
import { boxShadowCommands } from './boxShadow';

const pathsOf = (cmd: unknown): Path[] => (cmd as { children: { path: Path }[] }).children.map((c) => c.path);

describe('boxShadow counterexamples', () => {
  it('keeps the corners of a square box square under a spread', () => {
    const [outer] = pathsOf(boxShadowCommands({ x: 0, y: 0, w: 1, h: 1 }, 0,
      [{ inset: false, x: 4, y: -8, blur: 0, spread: 11, color: '#000' }], 'black').under[0]);
    expect(pointInPath(outer!, 0.5, -18.5)).toBe(true);
    const [ring] = pathsOf(boxShadowCommands({ x: 0, y: 0, w: 1, h: 11 }, 0,
      [{ inset: true, x: 3, y: 9, blur: 0, spread: -5, color: '#000' }], 'black').over[0]);
    expect(pointInPath(ring!, 0.5, 4.5)).toBe(false);
  });
});
