import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { warmPrograms, _resetWarmProgramsForTests } from './warmPrograms';
import { FIRST_FRAME_SPECS } from './shaders/builtinPrograms';

const COMPLETION_STATUS_KHR = 0x91b1;

/** A recording context offering `KHR_parallel_shader_compile` when `parallel`, whose links finish when `done` says. */
function context(parallel: boolean) {
  const recorder = createGLRecorder();
  const state = { done: false, lost: false };
  const gl = new Proxy(recorder.gl, {
    get(target, prop) {
      if (prop === 'getExtension') {
        return (name: string) => {
          if (name === 'KHR_parallel_shader_compile') return parallel ? { COMPLETION_STATUS_KHR } : null;
          if (name === 'WEBGL_lose_context') return { loseContext: () => { state.lost = true; } };
          return null;
        };
      }
      if (prop === 'getProgramParameter') return (_p: WebGLProgram, pname: number) => (pname === COMPLETION_STATUS_KHR ? state.done : true);
      return Reflect.get(target, prop);
    },
  });
  return { recorder, state, gl };
}

/** The fragment source of every program `recorder` linked, in order. */
function linkedFragments(recorder: ReturnType<typeof createGLRecorder>): string[] {
  const sources = recorder.calls.filter((c) => c.name === 'shaderSource').map((c) => c.args[1] as string);
  return sources.filter((_s, i) => i % 2 === 1);
}

describe('warmPrograms', () => {
  beforeEach(() => {
    _resetWarmProgramsForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts the same programs a renderer starts, and lets its context go once they finish', () => {
    const warm = context(true);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(warm.gl as unknown as RenderingContext);
    warmPrograms();
    expect(warm.recorder.calls.filter((c) => c.name === 'linkProgram')).toHaveLength(FIRST_FRAME_SPECS.length);
    vi.advanceTimersByTime(200);
    expect(warm.state.lost).toBe(false);
    warm.state.done = true;
    vi.advanceTimersByTime(100);
    expect(warm.state.lost).toBe(true);

    const own = context(true);
    new WeaselRenderer({ gl: own.gl, width: 10, height: 10, dpr: 1 });
    expect(linkedFragments(own.recorder).sort()).toEqual(linkedFragments(warm.recorder).sort());
  });

  it('compiles nothing where the context would compile in the foreground', () => {
    const warm = context(false);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(warm.gl as unknown as RenderingContext);
    warmPrograms();
    expect(warm.recorder.calls.some((c) => c.name === 'linkProgram')).toBe(false);
    expect(warm.state.lost).toBe(true);
  });

  it('runs once however often it is called', () => {
    const warm = context(true);
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(warm.gl as unknown as RenderingContext);
    warmPrograms();
    warmPrograms();
    expect(getContext).toHaveBeenCalledTimes(1);
  });

  it('lets its context go when building a program throws', () => {
    const warm = context(true);
    const gl = new Proxy(warm.gl, {
      get(target, prop) {
        if (prop === 'createProgram') return () => { throw new Error('lost'); };
        return Reflect.get(target, prop);
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl as unknown as RenderingContext);
    warmPrograms();
    expect(warm.state.lost).toBe(true);
  });
});
