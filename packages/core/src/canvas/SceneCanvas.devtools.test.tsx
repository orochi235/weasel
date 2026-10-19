/** A mounted `<SceneCanvas>` answers a devtools panel through `window.__weaselDevtools__`. */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { useState } from 'react';
import { render, act, cleanup } from '@testing-library/react';
import type { DepName } from '@weasel-js/routing';
import { useDepSource } from '@weasel-js/routing/react';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import type { NodeId, Scene } from 'core/scene/types';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import { DEVTOOLS_PROTOCOL, type PageMessage, type PanelMessage } from '../devtools/protocol';
import { createInPageTransports } from '../devtools/transport';
import { DevtoolsLabel } from '../devtools/label';

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

function ExtraDep() {
  useDepSource('clock' as DepName, () => 0 as never);
  return null;
}

function mount() {
  let scene: Scene<D, L, P> | null = null;
  let showChild: (on: boolean) => void = () => {};
  function Harness() {
    const [child, setChild] = useState(false);
    showChild = setChild;
    const s = useScene<D, L, P>({
      systemLayers: [{ id: 'main' }],
      initial: [{ id: 'a' as NodeId, kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { color: 'red' } }],
    });
    scene = s;
    return <SceneCanvas features={['draw']} scene={s} width={200} height={200} aria-label="board">{child && <ExtraDep />}</SceneCanvas>;
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
  return { scene: () => scene!, sup, result, close, rootId, showChild: (on: boolean) => showChild(on) };
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

  it('serves what the canvas registered: its tools with their bindings, its actions, deps and node kinds', () => {
    const { result, close } = mount();
    const registry = result({ type: 'get-registry' }) as {
      tools: { id: string; slot: string; bindings: { actionId: string; routes: string[] }[] }[];
      actions: { id: string }[]; deps: { name: string }[]; routingKinds: string[];
    };
    const select = registry.tools.find((t) => t.id === 'select');
    expect(select).toMatchObject({ slot: 'tool' });
    expect(select!.bindings.some((b) => b.actionId === 'areaSelect' && b.routes.length > 0)).toBe(true);
    expect(registry.tools.find((t) => t.id === 'selection.move')).toMatchObject({ slot: 'contribution' });
    expect(registry.actions.map((a) => a.id)).toEqual(expect.arrayContaining(['undo', 'redo']));
    expect(registry.deps.map((d) => d.name)).toEqual(expect.arrayContaining(['selection']));
    expect(registry.routingKinds.length).toBeGreaterThan(0);
    close();
  });

  it('announces no registry change when only the selection changes', () => {
    const { result, rootId, close } = mount();
    const heard: string[] = [];
    const off = window.__weaselDevtools__!.root(rootId)!.subscribe((area) => heard.push(area));
    result({ type: 'select', ids: ['a'] });
    result({ type: 'select', ids: [] });
    expect(heard).toContain('selection');
    expect(heard).not.toContain('registry');
    off();
    close();
  });

  it('announces a registry change when a dep source comes and goes', () => {
    const { rootId, close, showChild } = mount();
    const heard: string[] = [];
    const off = window.__weaselDevtools__!.root(rootId)!.subscribe((area) => heard.push(area));
    act(() => { showChild(true); });
    expect(heard).toContain('registry');
    heard.length = 0;
    act(() => { showChild(false); });
    expect(heard).toContain('registry');
    off();
    close();
  });

  it('records the scene history steps while connected', () => {
    const { result, scene, close } = mount();
    act(() => { scene().setPose('a' as NodeId, { x: 4, y: 0, width: 10, height: 10 }); });
    act(() => { scene().undo(); });
    expect(result({ type: 'get-history', cursor: 0 })).toMatchObject({
      entries: [
        { step: 'push', entries: [{ ops: [{ targets: ['a'] }] }], position: { index: 1, total: 1 } },
        { step: 'undo', position: { index: 0, total: 1 } },
      ],
      cursor: 2,
      position: { index: 0, total: 1, canUndo: false, canRedo: true },
    });
    close();
  });

  it('takes its label from the nearest labeled ancestor when it has none of its own', () => {
    function Unlabeled() {
      const s = useScene<D, L, P>({ systemLayers: [{ id: 'main' }], initial: [] });
      return <section aria-label="Pan and zoom"><SceneCanvas scene={s} width={50} height={50} /></section>;
    }
    render(<Unlabeled />);
    expect(window.__weaselDevtools__!.roots().map((r) => r.label)).toContain('Pan and zoom');
  });

  it('takes a DevtoolsLabel above it over any labeled ancestor nearer to it', () => {
    function InTrial() {
      const s = useScene<D, L, P>({ systemLayers: [{ id: 'main' }], initial: [] });
      return (
        <DevtoolsLabel value="Trial one">
          <div role="group" aria-label="Content"><SceneCanvas scene={s} width={50} height={50} /></div>
        </DevtoolsLabel>
      );
    }
    render(<InTrial />);
    const labels = window.__weaselDevtools__!.roots().map((r) => r.label);
    expect(labels).toContain('Trial one');
    expect(labels).not.toContain('Content');
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
