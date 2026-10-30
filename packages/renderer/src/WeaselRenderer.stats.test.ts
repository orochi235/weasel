import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';

const rect = (x: number): DrawCommand => ({
  kind: 'path',
  path: { kind: 'rect', x, y: 0, width: 10, height: 10 },
  fill: { paint: { kind: 'solid', color: '#f00' } },
});

/** An even-odd fill never joins the solid batch, so it draws where it stands,
 *  through the stencil — and closes any run staged before it. */
const ownDrawFill = {
  kind: 'path',
  path: {
    kind: 'polygon',
    commands: new Uint8Array([0, 1, 1, 3]),
    coords: new Float32Array([0, 0, 10, 0, 0, 10]),
    fillRule: 'evenodd',
  },
  fill: { paint: { color: '#f00' } },
} as unknown as DrawCommand;

function drawCallsIn(rec: ReturnType<typeof makeGLRecorder>): number {
  return rec.calls.filter((c) => c.name === 'drawElements' || c.name === 'drawArrays').length;
}

describe('WeaselRenderer frame stats', () => {
  it('counts every GL draw the frame issued', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1 });
    rec.reset();
    r.render([rect(0), ownDrawFill, rect(20)]);
    const drawn = drawCallsIn(rec);
    expect(drawn).toBeGreaterThan(1);
    expect(r.lastFrameStats().drawCalls).toBe(drawn);
    expect(r.lastFrameStats().ms).toBeGreaterThanOrEqual(0);
  });

  it('starts every frame from zero', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1 });
    r.render([rect(0), ownDrawFill]);
    rec.reset();
    r.render([rect(0)]);
    expect(r.lastFrameStats().drawCalls).toBe(drawCallsIn(rec));
  });

  it('splits the count across spans, a staged run counting toward the span that closes it', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1 });
    rec.reset();
    r.render([rect(0), ownDrawFill, rect(20)], undefined, {
      spans: [
        { id: 'staged', start: 0, end: 1 },
        { id: 'closer', start: 1, end: 2 },
        { id: 'tail', start: 2, end: 3 },
      ],
    });
    const stats = r.lastFrameStats();
    const byId = Object.fromEntries(stats.spans.map((s) => [s.id, s.drawCalls]));
    // The rect only stages; the fill flushes it and then draws itself.
    expect(byId.staged).toBe(0);
    expect(byId.closer).toBeGreaterThanOrEqual(2);
    // The last rect is drawn by the end-of-stream flush, inside the last span.
    expect(byId.tail).toBe(1);
    expect(byId.staged + byId.closer + byId.tail).toBe(stats.drawCalls);
  });

  it('reports no spans when none were asked for', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1 });
    r.render([rect(0)]);
    expect(r.lastFrameStats().spans).toEqual([]);
  });
});
