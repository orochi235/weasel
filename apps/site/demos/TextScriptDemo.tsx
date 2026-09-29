import { useEffect, useState, useSyncExternalStore } from 'react';
import { SceneCanvas, useScene, textCommandFromRuns, solid } from '@weasel-js/core';
import type { FillStyle, SceneViewDrawOne } from '@weasel-js/core';
import { glyphGeneration, subscribeGlyphReady } from '@weasel-js/font';
import { DEFAULT_TEXT_STYLE, scriptMetricsFor } from '@weasel-js/text';
import type { StyledRun, TextStyle } from '@weasel-js/text';
import styles from './TextScriptDemo.module.css';

const W = 620, H = 320;

interface NodeData { runs: StyledRun[]; style: TextStyle; fill: FillStyle }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const INK = solid('#1a1a1a');
const ACCENT = solid('#c0392b');

/** One row per node, so every line is an ordinary scene leaf the default
 *  machinery moves, picks and redraws — no per-row bookkeeping here. */
const row = (id: string, y: number, fontSize: number, runs: StyledRun[]) => ({
  id: id as never,
  kind: 'leaf' as const,
  layer: 'default' as const,
  pose: { x: 24, y, width: W - 48, height: fontSize * 1.6 },
  data: { runs, style: { fontSize } as TextStyle, fill: INK },
});

/** The row the sliders drive: the bare preset until a slider overrides a half. */
const liveRuns = (shift?: number, scale?: number): StyledRun[] => [
  { text: 'live ' },
  {
    text: 'shifted', script: 'super', fill: ACCENT,
    ...(shift !== undefined ? { baselineShift: shift } : {}),
    ...(scale !== undefined ? { fontScale: scale } : {}),
  },
  { text: ' run' },
];

const ROWS = [
  // The pair `script` exists for: a formula and an exponent, each one run
  // list with no positioning arithmetic at the call site.
  row('chem', 16, 32, [
    { text: 'H' }, { text: '2', script: 'sub' },
    { text: 'SO' }, { text: '4', script: 'sub' },
    { text: '   x' }, { text: 'n+1', script: 'super' },
    { text: '   E = mc' }, { text: '2', script: 'super' },
  ]),

  // Ordinals — the other everyday superscript, and the one where the size
  // scale carries more of the look than the rise does.
  row('ordinals', 68, 26, [
    { text: '1' }, { text: 'st', script: 'super' },
    { text: ', 2' }, { text: 'nd', script: 'super' },
    { text: ', 3' }, { text: 'rd', script: 'super' },
    { text: '   footnote' }, { text: '7', script: 'super', fill: ACCENT },
  ]),

  // All three decorations at once, so their offsets read against each other
  // rather than one at a time.
  row('rules', 112, 26, [
    { text: 'underline', underline: true },
    { text: '   ' },
    { text: 'strikethrough', strikethrough: true },
    { text: '   ' },
    { text: 'overline', overline: true },
  ]),

  // A shifted run carries its own rules with it: they hang off its displaced
  // baseline, not the line's.
  row('rules-shifted', 156, 24, [
    { text: 'a decorated ' },
    { text: 'superscript', script: 'super', underline: true, overline: true },
    { text: ' takes its rules along' },
  ]),

  // Three sizes on one baseline. Before the line sank a single baseline deep
  // enough for all of them, each run hung from the line *top* at its own
  // ascent, and the small ones floated up level with the big one's cap.
  row('mixed', 196, 40, [
    { text: 'big ' },
    { text: 'small ', fontScale: 0.4 },
    { text: 'medium', fontScale: 0.7 },
  ]),

  row('live', 252, 34, liveRuns()),
];

const drawOne: SceneViewDrawOne<NodeData, LayerId, Pose> = (node, pose) => [
  textCommandFromRuns(
    pose.x, pose.y, node.data.runs, node.data.style,
    undefined, undefined, undefined, { fill: node.data.fill },
  ),
];

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
  // The preset is the face's own OS/2 metrics once its atlas has loaded, and
  // the kit defaults before then, so read it again when a face lands.
  useSyncExternalStore(subscribeGlyphReady, glyphGeneration);
  const preset = scriptMetricsFor(DEFAULT_TEXT_STYLE.fontFamily, 400, 'normal').super;
  const [shiftOverride, setShift] = useState<number>();
  const [scaleOverride, setScale] = useState<number>();
  const shift = shiftOverride ?? preset.shift;
  const scale = scaleOverride ?? preset.size;

  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: ROWS,
  });

  // The sliders edit the scene, not a render-time shortcut — the row is an
  // ordinary node and this is the ordinary way to change one.
  useEffect(() => {
    const node = scene.get('live' as never);
    if (!node) return;
    scene.update('live' as never, {
      data: { ...node.data, runs: liveRuns(shiftOverride, scaleOverride) },
    });
  }, [scene, shiftOverride, scaleOverride]);

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
        {(preset.size * 100).toFixed(1)}% size,{' '}
        {(preset.shift * 100).toFixed(1)}% rise, read from the font&apos;s{' '}
        <code>OS/2</code> table.
      </p>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        backgroundFill={{ color: '#ffffff' }}
        scene={scene}
        layers={{ scene: { drawOne } }}
      />
    </div>
  );
}
