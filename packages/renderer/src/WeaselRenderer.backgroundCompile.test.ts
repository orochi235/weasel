import { describe, it, expect, beforeEach } from 'vitest';
import { rectPath } from '@weasel-js/geom';
import { createGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';

const COMPLETION_STATUS_KHR = 0x91b1;
const LINK_STATUS = 0x8b82;

/** A recording context offering `KHR_parallel_shader_compile`, whose links finish when `done` says. */
function parallelContext() {
  const recorder = createGLRecorder();
  const state = { done: false };
  const gl = new Proxy(recorder.gl, {
    get(target, prop) {
      if (prop === 'getExtension') {
        return (name: string) => (name === 'KHR_parallel_shader_compile' ? { COMPLETION_STATUS_KHR } : null);
      }
      if (prop === 'getProgramParameter') {
        return (p: WebGLProgram, pname: number) => {
          recorder.calls.push({ name: 'getProgramParameter', args: [p, pname], result: undefined });
          return pname === COMPLETION_STATUS_KHR ? state.done : true;
        };
      }
      return Reflect.get(target, prop);
    },
  });
  return { recorder, state, gl };
}

describe('WeaselRenderer where programs compile in the background', () => {
  let ctx: ReturnType<typeof parallelContext>;
  beforeEach(() => {
    ctx = parallelContext();
  });
  const linkWaits = () => ctx.recorder.calls.filter((c) => c.name === 'getProgramParameter' && c.args[1] === LINK_STATUS);

  it('starts the batch program and its text build at construction without waiting on either', () => {
    new WeaselRenderer({ gl: ctx.gl, width: 100, height: 100, dpr: 1 });
    expect(ctx.recorder.calls.filter((c) => c.name === 'linkProgram')).toHaveLength(2);
    expect(linkWaits()).toHaveLength(0);
  });

  it('reports its programs ready once the driver says they are', () => {
    const renderer = new WeaselRenderer({ gl: ctx.gl, width: 100, height: 100, dpr: 1 });
    expect(renderer.programsReady()).toBe(false);
    ctx.state.done = true;
    expect(renderer.programsReady()).toBe(true);
  });

  it('draws a frame asked for before then, waiting for the program it draws with', () => {
    const renderer = new WeaselRenderer({ gl: ctx.gl, width: 100, height: 100, dpr: 1 });
    renderer.render([{ kind: 'path', path: rectPath(10, 10, 50, 50), fill: { paint: { kind: 'solid', color: '#f00' } } }]);
    expect(ctx.recorder.calls.some((c) => c.name === 'drawElements')).toBe(true);
    expect(linkWaits().length).toBeGreaterThan(0);
  });
});
