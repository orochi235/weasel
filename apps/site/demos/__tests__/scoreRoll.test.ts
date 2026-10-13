import { describe, it, expect } from 'vitest';
import { scoreBar, scoreCues, scoreParams } from '@weasel-js/audio';
import type { DrawCommand } from '@weasel-js/core';
import { ROLL_PITCHES, scoreRoll } from '../score/scoreRoll';

const SIZE = { width: 320, height: 144 };

type RectCommand = Extract<DrawCommand, { kind: 'path' }> & {
  path: { kind: 'rect'; x: number; y: number; width: number; height: number };
};
const notes = (commands: readonly DrawCommand[]): RectCommand['path'][] =>
  commands
    .filter((c): c is RectCommand => c.kind === 'path' && c.path.kind === 'rect')
    .map((c) => c.path);

const barOf = (cue: string, bar: number) =>
  scoreBar(scoreParams(scoreCues.find((c) => c.name === cue)!.mood), bar);

describe('scoreRoll', () => {
  it('draws one bar per note, a step wide per step of its length', () => {
    const bars = notes(scoreRoll([{ step: 4, length: 2, pitch: { midi: 60 } }], SIZE));
    expect(bars).toHaveLength(1);
    expect(bars[0].x).toBeCloseTo(80);
    expect(bars[0].width).toBeCloseTo(40 - 2);
  });

  it('puts a higher note higher, and keeps every cue inside the roll', () => {
    const [low, high] = notes(scoreRoll([
      { step: 0, pitch: { midi: 48 } }, { step: 0, pitch: { midi: 72 } },
    ], SIZE));
    expect(high.y).toBeLessThan(low.y);
    expect(low.y - high.y).toBeCloseTo((24 / (ROLL_PITCHES.high - ROLL_PITCHES.low)) * SIZE.height);
    for (const cue of scoreCues) {
      for (const bar of notes(scoreRoll(barOf(cue.name, 8), SIZE))) {
        expect(bar.y, cue.name).toBeGreaterThanOrEqual(0);
        expect(bar.y + bar.height, cue.name).toBeLessThanOrEqual(SIZE.height);
      }
    }
  });

  it('shows dread as held tones and urgency as sixteenths', () => {
    const dread = notes(scoreRoll(barOf('dread', 8), SIZE));
    expect(dread.every((bar) => bar.x === 0 && bar.width > SIZE.width - 4)).toBe(true);
    const urgency = notes(scoreRoll(barOf('urgency', 0), SIZE));
    expect(new Set(urgency.map((bar) => bar.x)).size).toBe(16);
  });
});
