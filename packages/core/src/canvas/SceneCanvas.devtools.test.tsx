/** A mounted `<SceneCanvas>` answers a devtools panel through `window.__weaselDevtools__`. */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import type { Scene } from 'core/scene/types';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import { DEVTOOLS_PROTOCOL, type PageMessage, type PanelMessage } from '../devtools/protocol';
import { createInPageTransports } from '../devtools/transport';

type D = { color: string };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});
afterEach(() => {
  cleanup();
});

function mount() {
  let scene: Scene<D, L, P> | null = null;
  function Harness() {
    const s = useScene<D, L, P>({
      systemLayers: [{ id: 'main' }],
      initial: [{ id: 'a', kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { color: 'red' } }],
    });
    scene = s;
    return <SceneCanvas features={['draw']} scene={s} width={200} height={200} aria-label="board" />;
  }
  render(<Harness />);
  const hook = window.__weaselDevtools__!;
  const { page, panel } = createInPageTransports();
  const close = hook.connect(page);
  const heard: PageMessage[] = [];
  panel.onMessage((m) => heard.push(m));
  panel.send({ type: 'yo', protocol: DEVTOOLS_PROTOCOL });
  const sup = heard.find((m) => m.type === 'sup');
  if (sup?.type !== 'sup') throw new Error('no sup');
  const rootId = sup.roots.at(-1)!.id;
  let id = 1;
  const result = (body: Record<string, unknown>) => {
    const requestId = id++;
    act(() => { panel.send({ protocol: DEVTOOLS_PROTOCOL, requestId, rootId, ...body } as PanelMessage); });
    const reply = heard.find((m) => (m.type === 'result' || m.type === 'error') && m.requestId === requestId);
    if (reply?.type !== 'result') throw new Error(`expected a result, got ${JSON.stringify(reply)}`);
    return reply.result;
  };
  return { scene: () => scene!, sup, result, close, rootId };
}

describe('SceneCanvas devtools root', () => {
  it('registers with the hook a dev build installs, labeled from aria-label', () => {
    const { sup, close } = mount();
    expect(sup.roots.at(-1)).toMatchObject({ label: 'board', dimension: '2d' });
    close();
  });

  it('serves the scene tree and steers the selection', () => {
    const { result, close } = mount();
    expect(result({ type: 'get-children' })).toMatchObject([{ id: 'a', kind: 'leaf', layer: 'main' }]);
    result({ type: 'select', ids: ['a'] });
    expect(result({ type: 'get-state' })).toMatchObject({ selection: ['a'] });
    close();
  });

  it('serves the trace, empty before any input', () => {
    const { result, close } = mount();
    expect(result({ type: 'get-trace', cursor: 0 })).toMatchObject({ entries: [], live: null });
    close();
  });

  it('lays a panel override onto the overlay config and drops it on bye', () => {
    const { result, close, rootId } = mount();
    expect(result({ type: 'get-state' })).toMatchObject({ overlays: {} });
    result({ type: 'set-overlays', overlays: { bounds: true } });
    expect(result({ type: 'get-state' })).toMatchObject({ overlays: { bounds: true } });
    act(() => { close(); });
    expect(window.__weaselDevtools__!.root(rootId)!.source.overlays()).toBeNull();
  });

  it('leaves the root out when the canvas unmounts', () => {
    const before = window.__weaselDevtools__?.roots().length ?? 0;
    const { close } = mount();
    expect(window.__weaselDevtools__!.roots().length).toBe(before + 1);
    cleanup();
    expect(window.__weaselDevtools__!.roots().length).toBe(before);
    close();
  });
});
