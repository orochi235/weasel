import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { registerTexture } from './textures/registerTexture';
import type { DrawCommand } from './DrawCommand';
import { SOLID_RING_SIZE as IMAGE_RING_SIZE } from './drawBatch';

describe('WeaselRenderer.render — color matrix on text + image', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(async () => {
    _resetFontRegistryForTests();
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);
    await registerFont('inter', {}, '/fonts/inter.json', '/fonts/inter.png');

    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('sets NEAREST mag filter for sampling:"nearest" image draws', () => {
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    const cmd: DrawCommand = {
      kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 64, h: 64, sampling: 'nearest',
    };
    r.render([cmd]);
    const magCalls = recorder.calls.filter(
      (c) => c.name === 'texParameteri' && c.args[1] === recorder.gl.TEXTURE_MAG_FILTER,
    );
    expect(magCalls.at(-1)?.args[2]).toBe(recorder.gl.NEAREST);
  });

  it('restores LINEAR for an unsampled draw following a nearest one', () => {
    // The first render warms GLImageCache, whose upload() emits its own
    // MAG_FILTER call. Resetting after it leaves only the per-draw calls, so
    // this fails if drawImage stops setting the filter — which the naive
    // version of this test could not detect.
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    r.render([{ kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 64, h: 64 }]);
    recorder.reset();

    r.render([
      { kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 64, h: 64, sampling: 'nearest' },
      { kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 64, h: 64 },
    ]);
    expect(recorder.calls.filter((c) => c.name === 'drawElements').map((c) => c.args[1])).toEqual([6, 6]);
    const magFilters = recorder.calls
      .filter((c) => c.name === 'texParameteri' && c.args[1] === recorder.gl.TEXTURE_MAG_FILTER)
      .map((c) => c.args[2]);
    expect(magFilters).toEqual([recorder.gl.NEAREST, recorder.gl.LINEAR]);
  });

  it('does not re-assert a MAG_FILTER the texture already carries', () => {
    // Filtering is state on the texture object, and re-writing it is a write to
    // a live texture. A consumer's 122MB sheet is where that stops being free.
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;

    // Four image flushes at one filter: a pattern breaks the run each time (a
    // gradient or per-vertex colors no longer do), so the count is flushes and
    // not commands.
    const breaker = {
      kind: 'path' as const,
      path: { kind: 'rect' as const, x: 0, y: 0, width: 8, height: 8 },
      fill: { paint: { kind: 'texture' as const, texture: registerTexture({ width: 4, height: 4 } as ImageBitmap) } },
    } as unknown as DrawCommand;
    const img = {
      kind: 'image' as const, image: fakeBitmap, x: 0, y: 0, w: 64, h: 64,
      sampling: 'nearest' as const,
    };
    // Warm the bitmap's cache first: its upload writes a MAG_FILTER of its own,
    // which this test would otherwise count as a filter change.
    r.render([{ kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 64, h: 64 }, breaker]);
    recorder.reset();

    r.render([img, breaker, img, breaker, img, breaker, img]);

    expect(recorder.calls.filter((c) => c.name === 'drawElements')).toHaveLength(7);
    const magFilters = recorder.calls
      .filter((c) => c.name === 'texParameteri' && c.args[1] === recorder.gl.TEXTURE_MAG_FILTER)
      .map((c) => c.args[2]);
    // Once, on the first flush that wanted NEAREST — not once per flush.
    expect(magFilters).toEqual([recorder.gl.NEAREST]);
  });

  it('gives each flush its own ring slot', () => {
    // One bitmap at two filters, which is the break a second bitmap is not:
    // MAG_FILTER is state on the texture object, so one draw cannot have it
    // both ways however many slots the run has left.
    const a = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    r.render([
      { kind: 'image', image: a, x: 0, y: 0, w: 16, h: 16, sampling: 'nearest' },
      { kind: 'image', image: a, x: 0, y: 0, w: 16, h: 16, sampling: 'linear' },
    ]);
    // Replayed rather than counted: creating a slot binds its VAO too, so the
    // bind that matters is whichever was live when the draw went out.
    const bound: unknown[] = [];
    let live: unknown = null;
    for (const c of recorder.calls) {
      if (c.name === 'bindVertexArray') live = c.args[0];
      else if (c.name === 'drawElements') bound.push(live);
    }
    expect(bound).toHaveLength(2);
    // Same slot twice in a row is the stall this ring exists to avoid.
    expect(bound[0]).not.toBe(bound[1]);
  });

  // The quad geometry is a persistent ring rather than a per-draw VAO and two
  // buffers, which cost 5.4 us a draw. See tests/perf/image-quad.spec.ts.
  it('mints no GL objects for an image draw once every ring slot exists', () => {
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    const img = { kind: 'image' as const, image: fakeBitmap, x: 0, y: 0, w: 16, h: 16 };
    // Slots are created on first use and sized in tiers, so warming means a
    // full turn at each run length this test then draws. Nothing about it is
    // per-frame — it stops after one turn.
    for (let i = 0; i <= IMAGE_RING_SIZE; i++) r.render([img, img, img]);
    recorder.reset();

    r.render([img, img, img]);
    const named = (name: string) => recorder.calls.filter((c) => c.name === name);
    expect(named('createVertexArray')).toHaveLength(0);
    expect(named('createBuffer')).toHaveLength(0);
    expect(named('deleteVertexArray')).toHaveLength(0);
    expect(named('deleteBuffer')).toHaveLength(0);
  });

  it('frees the ring slots it took on dispose', () => {
    const a = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    r.render([
      { kind: 'image', image: a, x: 0, y: 0, w: 16, h: 16, sampling: 'nearest' },
      { kind: 'image', image: a, x: 0, y: 0, w: 16, h: 16, sampling: 'linear' },
    ]);
    recorder.reset();

    r.dispose();
    const deletedVaos = recorder.calls.filter((c) => c.name === 'deleteVertexArray');
    expect(deletedVaos.length).toBeGreaterThan(1);
  });
});
