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
