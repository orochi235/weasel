import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';

describe('WeaselRenderer stencil requirement', () => {
  it('throws when the injected context has no stencil buffer', () => {
    const { gl } = makeGLRecorder({ contextAttributes: { stencil: false } });
    expect(() => new WeaselRenderer({ gl, width: 100, height: 100, dpr: 1 }))
      .toThrow(/stencil/i);
  });

  it('constructs against a context that has one', () => {
    const { gl } = makeGLRecorder({ contextAttributes: { stencil: true } });
    expect(() => new WeaselRenderer({ gl, width: 100, height: 100, dpr: 1 }))
      .not.toThrow();
  });

  it('constructs when the context reports no attributes at all', () => {
    // A stub that answers `undefined` must not be read as "no stencil": only an
    // explicit `stencil: false` is. Every non-browser harness passes one of these.
    const { gl } = makeGLRecorder({ contextAttributes: undefined });
    const noAnswer = new Proxy(gl, {
      get: (t, p, r) => (p === 'getContextAttributes' ? () => undefined : Reflect.get(t, p, r)),
    });
    expect(() => new WeaselRenderer({ gl: noAnswer, width: 100, height: 100, dpr: 1 }))
      .not.toThrow();
  });

  it('constructs when the context lacks getContextAttributes entirely', () => {
    const { gl } = makeGLRecorder();
    const absent = new Proxy(gl, {
      get: (t, p, r) => (p === 'getContextAttributes' ? undefined : Reflect.get(t, p, r)),
    });
    expect(absent.getContextAttributes).toBeUndefined();
    expect(() => new WeaselRenderer({ gl: absent, width: 100, height: 100, dpr: 1 }))
      .not.toThrow();
  });
});

describe('WeaselRenderer per-frame GL state', () => {
  it('re-establishes blend, depth, cull and clear colour on every render', () => {
    const recorder = makeGLRecorder();
    const r = new WeaselRenderer({ gl: recorder.gl, width: 100, height: 100, dpr: 1 });
    // Constructor state is not the claim — a co-tenant moves all of it between
    // our frames, so the second frame must set it again just like the first.
    r.render([]);
    recorder.reset();
    r.render([]);

    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('blendFunc');
    expect(names).toContain('clearColor');

    const enabled = recorder.calls.filter((c) => c.name === 'enable').map((c) => c.args[0]);
    expect(enabled).toContain(recorder.gl.BLEND);

    const disabled = recorder.calls.filter((c) => c.name === 'disable').map((c) => c.args[0]);
    expect(disabled).toContain(recorder.gl.DEPTH_TEST);
    expect(disabled).toContain(recorder.gl.CULL_FACE);
  });
});

describe('WeaselRenderer.setTarget', () => {
  it('owns the whole buffer by default', () => {
    const recorder = makeGLRecorder({ drawingBufferWidth: 800, drawingBufferHeight: 600 });
    const r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
    r.render([]);

    expect(r.getTarget()).toBeNull();
    const viewport = recorder.calls.filter((c) => c.name === 'viewport').at(-1)!;
    expect(viewport.args).toEqual([0, 0, 800, 600]);
    const disabled = recorder.calls.filter((c) => c.name === 'disable').map((c) => c.args[0]);
    expect(disabled).toContain(recorder.gl.SCISSOR_TEST);
  });

  it('flips the origin to GL bottom-left and scissors to the same rect', () => {
    // Buffer 820x400 CSS at dpr 1; a 380x360 renderer at CSS (420, 20).
    // GL y = 400 - 20 - 360 = 20.
    const recorder = makeGLRecorder({ drawingBufferWidth: 820, drawingBufferHeight: 400 });
    const r = new WeaselRenderer({ gl: recorder.gl, width: 380, height: 360, dpr: 1 });
    r.setTarget({ origin: { x: 420, y: 20 } });
    recorder.reset();
    r.render([]);

    const viewport = recorder.calls.filter((c) => c.name === 'viewport').at(-1)!;
    expect(viewport.args).toEqual([420, 20, 380, 360]);
    const scissor = recorder.calls.filter((c) => c.name === 'scissor').at(-1)!;
    expect(scissor.args).toEqual([420, 20, 380, 360]);
    const enabled = recorder.calls.filter((c) => c.name === 'enable').map((c) => c.args[0]);
    expect(enabled).toContain(recorder.gl.SCISSOR_TEST);
  });

  it('scales origin and size by dpr', () => {
    const recorder = makeGLRecorder({ drawingBufferWidth: 1640, drawingBufferHeight: 800 });
    const r = new WeaselRenderer({ gl: recorder.gl, width: 380, height: 360, dpr: 2 });
    r.setTarget({ origin: { x: 420, y: 20 } });
    recorder.reset();
    r.render([]);

    // GL y = 800 - 40 - 720 = 40.
    const viewport = recorder.calls.filter((c) => c.name === 'viewport').at(-1)!;
    expect(viewport.args).toEqual([840, 40, 760, 720]);
  });

  it('re-applies the target on every frame, not just when it is set', () => {
    const recorder = makeGLRecorder({ drawingBufferWidth: 820, drawingBufferHeight: 400 });
    const r = new WeaselRenderer({ gl: recorder.gl, width: 380, height: 360, dpr: 1 });
    r.setTarget({ origin: { x: 420, y: 20 } });
    r.render([]);
    recorder.reset();
    r.render([]);

    const scissor = recorder.calls.filter((c) => c.name === 'scissor').at(-1)!;
    expect(scissor.args).toEqual([420, 20, 380, 360]);
  });

  it('follows a resize without the target being set again', () => {
    const recorder = makeGLRecorder({ drawingBufferWidth: 820, drawingBufferHeight: 400 });
    const r = new WeaselRenderer({ gl: recorder.gl, width: 380, height: 360, dpr: 1 });
    r.setTarget({ origin: { x: 420, y: 20 } });
    r.resize({ width: 200, height: 100, dpr: 1 });
    recorder.reset();
    r.render([]);

    // GL y = 400 - 20 - 100 = 280.
    const viewport = recorder.calls.filter((c) => c.name === 'viewport').at(-1)!;
    expect(viewport.args).toEqual([420, 280, 200, 100]);
  });

  it('setTarget(null) returns the whole buffer and drops the scissor', () => {
    const recorder = makeGLRecorder({ drawingBufferWidth: 820, drawingBufferHeight: 400 });
    const r = new WeaselRenderer({ gl: recorder.gl, width: 380, height: 360, dpr: 1 });
    r.setTarget({ origin: { x: 420, y: 20 } });
    r.setTarget(null);
    recorder.reset();
    r.render([]);

    expect(r.getTarget()).toBeNull();
    const viewport = recorder.calls.filter((c) => c.name === 'viewport').at(-1)!;
    expect(viewport.args).toEqual([0, 0, 380, 360]);
    const disabled = recorder.calls.filter((c) => c.name === 'disable').map((c) => c.args[0]);
    expect(disabled).toContain(recorder.gl.SCISSOR_TEST);
  });
});
