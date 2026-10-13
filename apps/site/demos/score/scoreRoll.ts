import { SCORE_BAR_STEPS, toFrequency, type PatternNote } from '@weasel-js/audio';
import { PATH_L, PATH_M, type DrawCommand } from '@weasel-js/core';

/** The MIDI range the roll's height spans: every note `scoreBar` can write. */
export const ROLL_PITCHES = { low: 20, high: 112 };

const NOTE = '#7fb069';
const BEAT = '#4a3c2e';
const GAP = 2;
const ROW = 5;

const midiOf = (note: PatternNote): number => 69 + 12 * Math.log2(toFrequency(note.pitch) / 440);

/** One bar of score as a piano roll: a line on each beat, and a bar per note,
 *  as long as its gate and as opaque as its level against the loudest. */
export function scoreRoll(
  notes: readonly PatternNote[],
  size: { width: number; height: number },
): DrawCommand[] {
  const stepWidth = size.width / SCORE_BAR_STEPS;
  const span = ROLL_PITCHES.high - ROLL_PITCHES.low;
  const loudest = Math.max(0, ...notes.map((n) => n.gain ?? 1));
  const commands: DrawCommand[] = [];
  for (let step = 4; step < SCORE_BAR_STEPS; step += 4) {
    commands.push({
      kind: 'path',
      path: {
        kind: 'polygon',
        commands: new Uint8Array([PATH_M, PATH_L]),
        coords: new Float32Array([step * stepWidth, 0, step * stepWidth, size.height]),
        fillRule: 'nonzero',
      },
      stroke: { paint: { color: BEAT }, width: 1 },
    });
  }
  for (const note of notes) {
    const level = loudest > 0 ? (note.gain ?? 1) / loudest : 1;
    commands.push({
      kind: 'path',
      path: {
        kind: 'rect',
        x: note.step * stepWidth,
        y: (1 - (midiOf(note) - ROLL_PITCHES.low) / span) * size.height - ROW / 2,
        width: (note.length ?? 1) * stepWidth - GAP,
        height: ROW,
      },
      fill: { paint: { color: NOTE, opacity: 0.35 + 0.65 * level } },
    });
  }
  return commands;
}
