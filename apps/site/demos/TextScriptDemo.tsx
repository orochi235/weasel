import { useMemo, useState } from 'react';
import { DrawCanvas, textCommandFromRuns, solid } from '@weasel-js/core';
import { SCRIPT_METRICS } from '@weasel-js/text';
import type { StyledRun, TextStyle } from '@weasel-js/text';
import styles from './TextScriptDemo.module.css';

const W = 620, H = 320;

const INK = solid('#1a1a1a');
const ACCENT = solid('#c0392b');

interface Row { y: number; fontSize: number; runs: StyledRun[] }

const row = (y: number, fontSize: number, runs: StyledRun[]): Row => ({ y, fontSize, runs });

/** The row the sliders drive, built from the current shift and scale. */
const liveRuns = (shift: number, scale: number): StyledRun[] => [
  { text: 'live ' },
  { text: 'shifted', script: 'super', baselineShift: shift, fontScale: scale, fill: ACCENT },
  { text: ' run' },
];

const ROWS = [
  // The pair `script` exists for: a formula and an exponent, each one run
  // list with no positioning arithmetic at the call site.
  row(16, 32, [
    { text: 'H' }, { text: '2', script: 'sub' },
    { text: 'SO' }, { text: '4', script: 'sub' },
    { text: '   x' }, { text: 'n+1', script: 'super' },
    { text: '   E = mc' }, { text: '2', script: 'super' },
  ]),

  // Ordinals — the other everyday superscript, and the one where the size
  // scale carries more of the look than the rise does.
  row(68, 26, [
    { text: '1' }, { text: 'st', script: 'super' },
    { text: ', 2' }, { text: 'nd', script: 'super' },
    { text: ', 3' }, { text: 'rd', script: 'super' },
    { text: '   footnote' }, { text: '7', script: 'super', fill: ACCENT },
  ]),

  // All three decorations at once, so their offsets read against each other
  // rather than one at a time.
  row(112, 26, [
    { text: 'underline', underline: true },
    { text: '   ' },
    { text: 'strikethrough', strikethrough: true },
    { text: '   ' },
    { text: 'overline', overline: true },
  ]),

  // A shifted run carries its own rules with it: they hang off its displaced
  // baseline, not the line's.
  row(156, 24, [
    { text: 'a decorated ' },
    { text: 'superscript', script: 'super', underline: true, overline: true },
    { text: ' takes its rules along' },
  ]),

  // Three sizes on one baseline. Before the line sank a single baseline deep
  // enough for all of them, each run hung from the line *top* at its own
  // ascent, and the small ones floated up level with the big one's cap.
  row(196, 40, [
    { text: 'big ' },
    { text: 'small ', fontScale: 0.4 },
    { text: 'medium', fontScale: 0.7 },
  ]),

];

const LIVE_Y = 252, LIVE_SIZE = 34;

const drawRow = ({ y, fontSize, runs }: Row) => textCommandFromRuns(
  24, y, runs, { fontSize } as TextStyle, undefined, undefined, undefined, { fill: INK },
);

/**
 * Superscript, subscript, and the two primitives underneath them.
 *
 * `script: 'super' | 'sub'` is a preset, not a mechanism of its own: it
 * supplies a `baselineShift` and a `fontScale`. The sliders override each half
 * on the last row while leaving the other alone, which is the whole of what
 * overriding half a preset means.
 *
 * Watch the *other* rows while you drag. They do not move: a shift displaces
 * its own run and deliberately does not feed back into the line's baseline or
 * its height, so a superscript rides the line rather than reflowing it.
 */
export function TextScriptDemo() {
  const [shift, setShift] = useState(SCRIPT_METRICS.super.shift);
  const [scale, setScale] = useState(SCRIPT_METRICS.super.size);

  const commands = useMemo(
    () => [...ROWS, row(LIVE_Y, LIVE_SIZE, liveRuns(shift, scale))].map(drawRow),
    [shift, scale],
  );

  return (
    <div className={styles.demo}>
      <div className={styles.controls}>
        <label className={styles.control}>
          Baseline shift
          <input
            type="range" min={-0.8} max={0.8} step={0.001} value={shift}
            className={styles.slider}
            data-testid="shift"
            onChange={(e) => setShift(Number(e.target.value))}
          />
          <span className={styles.readout}>{(shift * 100).toFixed(1)}%</span>
        </label>
        <label className={styles.control}>
          Font scale
          <input
            type="range" min={0.2} max={1.5} step={0.001} value={scale}
            className={styles.slider}
            data-testid="scale"
            onChange={(e) => setScale(Number(e.target.value))}
          />
          <span className={styles.readout}>{(scale * 100).toFixed(1)}%</span>
        </label>
      </div>
      <p className={styles.hint}>
        Both start at the <code>script: &apos;super&apos;</code> preset —{' '}
        {(SCRIPT_METRICS.super.size * 100).toFixed(1)}% size,{' '}
        {(SCRIPT_METRICS.super.shift * 100).toFixed(1)}% rise.
      </p>
      <DrawCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        background={{ fill: 'solid', color: '#ffffff' }}
        draw={commands}
      />
    </div>
  );
}
