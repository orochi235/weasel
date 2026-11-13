import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeaselRenderer, type ShaderProgramHandle } from '@weasel-js/renderer';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import { createScene } from '../../core/scene/scene';
import { asNodeId, type RectPose, type Scene } from '../../core/scene/types';
import { createFrameWriter } from './frameWriter';
import type { FromWorker, ToWorker } from './protocol';
import { registerNodeShape } from '../NodeShape';
import { hostSceneRender, type RenderPort } from './serveSceneRender';
import type { WorkerAnimation } from './workerAnimations';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** A worker host on a port the test speaks for the page, painting through a recorded context. */
function host(animations: Record<string, WorkerAnimation> = {}, shaders?: readonly ShaderProgramHandle[]) {
  const recorder = makeGLRecorder();
  const canvas = Object.assign(new EventTarget(), {
    width: 0, height: 0, getContext: () => recorder.gl,
  }) as unknown as OffscreenCanvas;
  let listener: (e: MessageEvent) => void = () => {};
  const out: FromWorker[] = [];
  const port: RenderPort = {
    postMessage: (m) => { out.push(m as FromWorker); },
    addEventListener: (_type, fn) => { listener = fn; },
  };
  hostSceneRender(port, { animations, ...(shaders ? { shaders } : {}) });
  const send = (msg: ToWorker) => listener({ data: msg } as MessageEvent);
  send({ type: 'init', canvas, width: 20, height: 20, dpr: 1 });
  const scene = createScene<object, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: [{ id: asNodeId('a'), kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 5, height: 5 }, data: {} }],
  });
  const writer = createFrameWriter();
  const frame = (extra: Partial<Extract<ToWorker, { type: 'frame' }>> = {}) => send({
    ...writer.write({ scene: scene as unknown as Scene<unknown, string, unknown>, view: VIEW, width: 20, height: 20, dpr: 1 }),
    at: { time: 0 }, ...extra,
  });
  return { send, frame, out, canvas };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('hostSceneRender', () => {
  it('paints a frame whose animator calls name a program nothing registered, and runs the calls after it', () => {
    const render = vi.spyOn(WeaselRenderer.prototype, 'render');
    const played = vi.fn();
    const { frame, out } = host({ glow: () => { played(); } });
    frame({ animations: [{ op: 'play', id: 1, key: 'nope' }, { op: 'play', id: 2, key: 'glow' }] });
    expect(played).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(1);
    expect(out).toContainEqual({ type: 'drawn' });
    expect(out).toContainEqual({ type: 'error', message: expect.stringMatching(/nope/) });
  });

  it('reports every animator call in a frame that failed, not only the first', () => {
    const { frame, out } = host();
    frame({ animations: [{ op: 'play', id: 1, key: 'nope' }, { op: 'play', id: 2, key: 'gone' }] });
    expect(out.filter((m) => m.type === 'error')).toEqual([
      { type: 'error', message: expect.stringMatching(/nope/) },
      { type: 'error', message: expect.stringMatching(/gone/) },
    ]);
  });

  it('answers a snapshot it could not take with nothing', async () => {
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('lost')));
    const { send, out, canvas } = host();
    Object.assign(canvas, { width: 20, height: 20 });
    send({ type: 'snapshot', id: 3 });
    await new Promise((r) => setTimeout(r, 0));
    vi.unstubAllGlobals();
    expect(out).toContainEqual({ type: 'snapshot', id: 3, bitmap: null });
  });

  it('answers an id read that threw with no ids', () => {
    vi.spyOn(WeaselRenderer.prototype, 'renderIds').mockImplementation(() => { throw new Error('lost'); });
    const { send, frame, out } = host();
    frame();
    send({ type: 'readIds', id: 4, rect: { x: 0, y: 0, width: 2, height: 2 } });
    expect(out).toContainEqual({ type: 'ids', id: 4, ids: expect.objectContaining({ width: 0, height: 0 }) });
  });

  it('paints without a shader that will not register, as the page does', () => {
    vi.spyOn(WeaselRenderer.prototype, 'registerProgram').mockImplementation(() => { throw new Error('bad glsl'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const render = vi.spyOn(WeaselRenderer.prototype, 'render');
    const { frame } = host({}, [{ id: 'broken' } as ShaderProgramHandle]);
    frame();
    expect(render).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('broken'), expect.any(Error));
  });

  it('asks for one more frame after a paint that threw, as the page loop retries one, and not for a second', () => {
    let throws = 2;
    vi.spyOn(WeaselRenderer.prototype, 'render').mockImplementation(() => {
      if (throws-- > 0) throw new Error('bad node');
    });
    const { frame, out } = host();
    const dirties = () => out.filter((m) => m.type === 'dirty').length;
    frame();
    expect(out).toContainEqual({ type: 'error', message: 'bad node' });
    expect(dirties()).toBe(1);
    frame();
    expect(dirties()).toBe(1);
    frame();
    throws = 1;
    frame();
    expect(dirties()).toBe(2);
  });

  it('asks for a frame when a node shape registers in the worker after it started painting', () => {
    const { frame, out } = host();
    frame();
    const before = out.filter((m) => m.type === 'dirty').length;
    const off = registerNodeShape({ id: 'test:late', matches: () => false, paint: () => [] });
    off();
    expect(out.filter((m) => m.type === 'dirty').length).toBe(before + 2);
  });
});
