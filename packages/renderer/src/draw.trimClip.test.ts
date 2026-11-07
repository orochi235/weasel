/**
 * An animating trim on a stroke too large to batch: the ribbon is built once
 * and clipped in the shader, and its heads are built once and moved, so a
 * tween step builds no mesh.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATH_L, PATH_M, type Path, type PolygonPath } from '@weasel-js/geom';
import type { CommandPaint, CommandStroke } from '@weasel-js/paint';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { _resetStrokeMeshCacheForTests } from './cache/strokeMeshCache';
import { _markerShapesBuiltForTests, _resetMarkerCommandCacheForTests } from './cache/markerCommandCache';

const built: Path[] = [];

vi.mock('@weasel-js/stroke', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weasel-js/stroke')>();
  return {
    ...actual,
    tessellateStroke: (...args: Parameters<typeof actual.tessellateStroke>) => {
      built.push(args[0]);
      return actual.tessellateStroke(...args);
    },
    clipRibbon: (...args: Parameters<typeof actual.clipRibbon>) => {
      built.push(args[0]);
      return actual.clipRibbon(...args);
    },
  };
});

/** A wave through 1,000 anchors. */
function wave(): PolygonPath {
  const n = 1000;
  const commands = new Uint8Array(n).fill(PATH_L);
  commands[0] = PATH_M;
  const coords = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    coords[i * 2] = i * 0.8;
    coords[i * 2 + 1] = 300 + Math.sin(i / 20) * 120;
  }
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

const STROKE: CommandStroke = { width: 6, cap: 'round', paint: { color: '#204080' }, markerEnd: 'arrow' };

type Recorder = ReturnType<typeof makeGLRecorder>;
const named = (rec: Recorder, name: string) => rec.calls.filter((c) => c.name === name);

describe('a trim tween on a 1,000-anchor path', () => {
  let recorder: Recorder;
  let r: WeaselRenderer;

  beforeEach(() => {
    _resetStrokeMeshCacheForTests();
    _resetMarkerCommandCacheForTests();
    built.length = 0;
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
  });

  it('builds its ribbon on the first frame and never again', () => {
    const path = wave();
    const frames = 30;
    const windows: unknown[] = [];
    for (let f = 0; f < frames; f++) {
      recorder.reset();
      const end = (f + 1) / frames;
      r.render([{ kind: 'path', path, stroke: { ...STROKE, trim: { start: end / 3, end } } }]);
      expect(built.filter((p) => p === path), `frame ${f}`).toHaveLength(1);
      // A mesh uploads its data; the batch's ring sizes its buffers, filling a slot a frame at first.
      const uploads = named(recorder, 'bufferData').filter((c) => typeof c.args[1] !== 'number');
      // First sight uploads for the frame, the second keeps it, and from then on nothing is uploaded.
      if (f >= 2) expect(uploads, `frame ${f}`).toHaveLength(0);
      windows.push(named(recorder, 'uniform2f').map((c) => c.args.slice(1)));
    }
    expect(new Set(windows.map((w) => JSON.stringify(w))).size).toBe(frames);
  });

  it('builds nothing after its first frame when translucent, gradient-painted and arrowheaded', () => {
    const path = wave();
    const paint: CommandPaint = {
      kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 800, y: 0 }, units: 'local', opacity: 0.6,
      stops: [{ offset: 0, color: '#2040ff80' }, { offset: 1, color: '#ff4020' }],
    };
    const stroke: CommandStroke = { ...STROKE, paint, markerStart: 'dot' };
    let shapes = 0;
    for (let f = 0; f < 30; f++) {
      recorder.reset();
      const end = (f + 1) / 30;
      r.render([{ kind: 'path', path, stroke: { ...stroke, trim: { start: end / 4, end } } }]);
      expect(built.filter((p) => p === path), `frame ${f}`).toHaveLength(1);
      if (f === 0) shapes = _markerShapesBuiltForTests();
      expect(_markerShapesBuiltForTests(), `frame ${f}`).toBe(shapes);
      // What a frame still uploads is its two cut ends, a few dozen vertices each.
      const uploads = named(recorder, 'bufferData').filter((c) => typeof c.args[1] !== 'number');
      if (f >= 2) for (const u of uploads) expect((u.args[1] as ArrayBufferView).byteLength, `frame ${f}`).toBeLessThan(4096);
    }
    expect(shapes).toBe(2);
  });

  it('builds nothing after its first frame in a stretched view, whose metric it is built in', () => {
    const path = wave();
    const stroke: CommandStroke = { ...STROKE, width: { px: 5 }, paint: { color: '#204080', opacity: 0.5 } };
    const transform = new Float64Array([1.6, 0, 0, 0, 0.7, 0, 0, 0, 1]);
    for (let f = 0; f < 10; f++) {
      const end = (f + 1) / 10;
      r.render([{ kind: 'group', transform, children: [{ kind: 'path', path, stroke: { ...stroke, trim: { start: end / 4, end } } }] }]);
      expect(built.filter((p) => p === path), `frame ${f}`).toHaveLength(1);
    }
  });
});
