/**
 * An animating trim on a stroke too large to batch: the ribbon is built once
 * and clipped in the shader, so a tween step builds no mesh and uploads none.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATH_L, PATH_M, type Path, type PolygonPath } from '@weasel-js/geom';
import type { CommandStroke } from '@weasel-js/paint';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { _resetStrokeMeshCacheForTests } from './cache/strokeMeshCache';

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

  it('rebuilds a translucent one trimmed each frame, which the clip would darken inside its turns', () => {
    const path = wave();
    for (let f = 0; f < 3; f++) {
      r.render([{ kind: 'path', path, stroke: { ...STROKE, paint: { color: '#204080', opacity: 0.5 }, trim: { end: 0.2 + f * 0.1 } } }]);
    }
    expect(built.filter((p) => p === path)).toHaveLength(3);
  });
});
