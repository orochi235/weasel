/** Counterexamples the `.lbx` writer's second-pass properties shrank to. */
import { describe, expect, it } from 'vitest';
import { parseLbx } from 'bil-lbx';
import type { DrawCommand } from '@weasel-js/renderer';
import { tapeForWidthMm } from '../tape';
import { writeLbx } from './writeLbx';

const t = tapeForWidthMm(12)!;
const rect = (stroke?: number, x = 0): DrawCommand => ({
  kind: 'path', path: { kind: 'rect', x, y: 0, width: 10, height: 5 }, fill: { paint: { color: '#000000' } },
  ...(stroke !== undefined ? { stroke: { paint: { color: '#000000' }, width: stroke } } : {}),
});

describe('shrunk counterexamples', () => {
  it('writes no object at a position no number can say', async () => {
    const pages: DrawCommand[][] = [
      [rect(Infinity)],
      [{ kind: 'group', transform: Float32Array.of(Number.NaN, 0, 0, 0, Number.NaN, 0, 0, 0, 1) as never, children: [rect()] }],
      [{ kind: 'group', transform: [1e200, 0, 0, 0, 1e200, 0, 0, 0, 1] as never, children: [rect(undefined, 1e200)] }],
    ];
    for (const commands of pages) {
      const { bytes, config, skipped } = await writeLbx({ length: 100, tape: t, commands });
      expect(config.objects).toEqual([]);
      expect(skipped).toHaveLength(1);
      expect((await parseLbx(bytes)).objects).toEqual([]);
    }
  });
});

describe('shrunk counterexamples: length', () => {
  it('refuses a label length that is not a positive finite number', async () => {
    for (const length of [Number.NaN, Infinity, 0, -5]) {
      await expect(writeLbx({ length, tape: t, commands: [] })).rejects.toThrow(RangeError);
    }
  });
});
