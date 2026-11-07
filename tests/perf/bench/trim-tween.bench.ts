/**
 * One frame of a trim tween on a 1,000-anchor stroke, through the renderer
 * against a recording GL context: the CPU a step costs, with nothing timed
 * on a GPU.
 *
 * Each frame moves the trim, so a cache keyed on it misses every time.
 * "clipped" is the renderer as it stands. "rebuilt" is what it did before a
 * trim was clipped in the shader and its heads were moved rather than built:
 * the ribbon rebuilt trimmed (the `trimClip` variant off) and each head drawn
 * as a fresh placed path, as `markerDrawCommands` builds it.
 */
import { PATH_L, PATH_M, type PolygonPath } from '@weasel-js/geom';
import type { CommandPaint, CommandStroke } from '@weasel-js/paint';
import { markerDrawCommands, WeaselRenderer, type DrawCommand } from '@weasel-js/renderer';
import { resolveStrokeWidth } from '@weasel-js/stroke';
import { makeGLRecorder } from '../../../packages/renderer/src/testing/glRecorder';
import { group } from './group';

function wave(n: number): PolygonPath {
  const commands = new Uint8Array(n).fill(PATH_L);
  commands[0] = PATH_M;
  const coords = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    coords[i * 2] = i * (800 / n);
    coords[i * 2 + 1] = 300 + Math.sin(i / 20) * 120;
  }
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

const GRADIENT: CommandPaint = {
  kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 800, y: 0 }, units: 'local', opacity: 0.6,
  stops: [{ offset: 0, color: '#2040ff' }, { offset: 1, color: '#ff4020' }],
};

const CASES: [string, CommandStroke][] = [
  ['translucent gradient, arrowheaded', { width: 6, cap: 'round', paint: GRADIENT, markerStart: 'dot', markerEnd: 'arrow' }],
  ['opaque solid, arrowheaded', { width: 6, cap: 'round', paint: { color: '#204080' }, markerEnd: 'arrow' }],
];

const FRAMES = 60;

function tween(stroke: CommandStroke, rebuilt: boolean): () => void {
  const path = wave(1000);
  const recorder = makeGLRecorder();
  const r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
  if (rebuilt) Object.defineProperty(r._batchVariants(), 'trimClip', { value: false });
  let f = 0;
  return () => {
    recorder.reset();
    const end = 0.2 + 0.8 * ((f++ % FRAMES) + 1) / FRAMES;
    const trimmed: CommandStroke = { ...stroke, trim: { start: end / 4, end } };
    const commands: DrawCommand[] = rebuilt
      ? [
          { kind: 'path', path, stroke: { ...trimmed, markerStart: undefined, markerEnd: undefined } },
          ...markerDrawCommands(path, trimmed, resolveStrokeWidth(stroke.width ?? 1, 1), undefined),
        ]
      : [{ kind: 'path', path, stroke: trimmed }];
    r.render(commands);
  };
}

for (const [name, stroke] of CASES) {
  group(`trim tween step — 1,000 anchors, ${name}`, (bench) => {
    bench('clipped', tween(stroke, false));
    bench('rebuilt', tween(stroke, true));
  });
}

group('trim tween step — 40 anchors, which the batch takes and rebuilds', (bench) => {
  const path = wave(40);
  const recorder = makeGLRecorder();
  const r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
  let f = 0;
  bench('rebuilt', () => {
    recorder.reset();
    const end = 0.2 + 0.8 * ((f++ % FRAMES) + 1) / FRAMES;
    r.render([{ kind: 'path', path, stroke: { ...CASES[0][1], trim: { start: end / 4, end } } }]);
  });
});
