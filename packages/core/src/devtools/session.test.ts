import { describe, it, expect, vi } from 'vitest';
import { createDispatchTrace, createTraceRing } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import type { CoordTraceEntry } from '../canvas/SceneCanvas/coordTrace';
import { createDevtoolsHook } from './hook';
import { DEVTOOLS_PROTOCOL, type PageMessage, type PanelMessage } from './protocol';
import { createDevtoolsRoot, type DevtoolsRootSource } from './root';
import { createInPageTransports } from './transport';
import { recordHistory } from './history';
import type { DevtoolsHistoryRecord, DevtoolsRegistry } from './protocol';

const P = DEVTOOLS_PROTOCOL;

function setup() {
  const scene = createScene<{ label: string; draw?: () => void }, string>({ systemLayers: [{ id: 'main' }] });
  const group = scene.add({ kind: 'container', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { label: 'g' } });
  const leaf = scene.add({
    kind: 'leaf', layer: 'main', parent: group, locked: true,
    pose: { x: 1, y: 2, width: 3, height: 4 }, data: { label: 'leaf', draw() {} },
  });
  let selection: readonly string[] = [];
  let tool: string | null = 'select';
  const setOverride = vi.fn();
  const trace = createDispatchTrace(10, false);
  const coords = createTraceRing<CoordTraceEntry>(10, false);
  const history = createTraceRing<DevtoolsHistoryRecord>(200, false);
  recordHistory(scene.history, history);
  const registryListeners = new Set<() => void>();
  const registry: DevtoolsRegistry = { tools: [], actions: [], deps: [{ name: 'selection', depth: 0, stacked: 1 }], routingKinds: ['rect'] };
  const source: DevtoolsRootSource = {
    label: () => 'main canvas',
    dimension: '2d',
    scene: () => scene as never,
    selection: () => selection,
    select: (ids) => { selection = ids; },
    view: () => ({ x: 0, y: 0, scale: { x: 2, y: 2 } }),
    activeTool: () => tool,
    tools: () => ['select', 'rect'],
    setTool: (id) => { tool = id; },
    trace,
    coords,
    frame: () => ({ drawCalls: 3 }),
    overlays: () => ({ bounds: true, theme: { bounds: 'red' } }),
    setOverride,
    registry: () => registry,
    subscribeRegistry: (l) => { registryListeners.add(l); return () => { registryListeners.delete(l); }; },
    history,
  };
  const root = createDevtoolsRoot(source);
  let flush: (() => void) | null = null;
  const hook = createDevtoolsHook({ schedule: (f) => { flush = f; } });
  const unregister = hook.register(root);
  const { page, panel } = createInPageTransports();
  const close = hook.connect(page);
  const heard: PageMessage[] = [];
  panel.onMessage((m) => heard.push(m));
  let nextId = 1;
  const ask = (body: Record<string, unknown>) => {
    const requestId = nextId++;
    panel.send({ protocol: P, requestId, rootId: root.id, ...body } as PanelMessage);
    return heard.find((m) => (m.type === 'result' || m.type === 'error') && m.requestId === requestId);
  };
  const result = (body: Record<string, unknown>) => {
    const reply = ask(body);
    if (reply?.type !== 'result') throw new Error(`expected a result, got ${JSON.stringify(reply)}`);
    return reply.result;
  };
  return {
    scene, group, leaf, root, hook, panel, heard, ask, result, close, unregister, trace, coords, setOverride,
    registryChanged: () => { for (const l of registryListeners) l(); },
    flush: () => { const f = flush; flush = null; f?.(); },
    get selection() { return selection; },
    get tool() { return tool; },
  };
}

describe('devtools session', () => {
  it('answers yo with sup naming the roots', () => {
    const t = setup();
    t.panel.send({ type: 'yo', protocol: P });
    expect(t.heard[0]).toMatchObject({
      type: 'sup', protocol: P, roots: [{ id: t.root.id, label: 'main canvas', dimension: '2d' }],
    });
  });

  it('refuses requests before yo, and any message in another protocol', () => {
    const t = setup();
    expect(t.ask({ type: 'get-state' })).toMatchObject({ type: 'error', message: /yo/ });
    t.panel.send({ type: 'yo', protocol: P + 1 });
    expect(t.heard.at(-1)).toMatchObject({ type: 'error', requestId: null, message: /protocol mismatch/ });
    expect(t.heard.some((m) => m.type === 'sup')).toBe(false);
  });

  it('walks the scene tree a level at a time and serializes a node', () => {
    const t = setup();
    t.panel.send({ type: 'yo', protocol: P });
    expect(t.result({ type: 'get-children' })).toEqual([
      { id: t.group, kind: 'container', layer: 'main', childCount: 1, hidden: false, locked: false, pickable: true },
    ]);
    expect(t.result({ type: 'get-children', nodeId: t.group })).toMatchObject([{ id: t.leaf, locked: true }]);
    expect(t.result({ type: 'get-node', nodeId: t.leaf })).toMatchObject({
      parent: t.group, pose: { x: 1, y: 2, width: 3, height: 4 }, data: { label: 'leaf', draw: 'ƒ draw' },
    });
    expect(t.ask({ type: 'get-node', nodeId: 'nope' })).toMatchObject({ type: 'error', message: 'no node "nope"' });
    expect(t.ask({ type: 'get-state', rootId: 'root-x' })).toMatchObject({ type: 'error', message: 'no root "root-x"' });
  });

  it('reports state, frame stats and probes', () => {
    const t = setup();
    t.root.probes.set('answer', () => 42);
    t.panel.send({ type: 'yo', protocol: P });
    expect(t.result({ type: 'get-state' })).toEqual({
      selection: [], view: { x: 0, y: 0, scale: { x: 2, y: 2 } }, activeTool: 'select',
      tools: ['select', 'rect'], overlays: { bounds: true }, probes: { answer: 42 },
    });
    expect(t.result({ type: 'get-frame' })).toEqual({ drawCalls: 3 });
  });

  it('turns tracing on while connected, and hands back what was traced since a cursor', () => {
    const t = setup();
    t.trace.recordModeSwitch('m', null, 'a');
    expect(t.trace.since(0).entries).toEqual([]);
    t.panel.send({ type: 'yo', protocol: P });
    t.trace.recordModeSwitch('m', 'a', 'b');
    t.coords.push({ ts: 1, clientX: 0, clientY: 0, rect: null, view: null, world: { x: 0, y: 0 }, fallback: true });
    const first = t.result({ type: 'get-trace', cursor: 0, coordCursor: 0 }) as { cursor: number };
    expect(first).toMatchObject({ entries: [{ kind: 'mode', to: 'b' }], cursor: 1, live: null, coords: { cursor: 1 } });
    expect(t.result({ type: 'get-trace', cursor: first.cursor })).toEqual({ entries: [], cursor: 1, live: null });
    t.panel.send({ type: 'bye', protocol: P });
    t.trace.recordModeSwitch('m', 'b', 'c');
    expect(t.trace.since(1).entries).toEqual([]);
  });

  it('coalesces change notices into one per root per frame, with versions', () => {
    const t = setup();
    t.panel.send({ type: 'yo', protocol: P });
    t.root.notify('selection');
    t.root.notify('selection');
    t.scene.setPose(t.group as NodeId, { x: 9, y: 9, width: 10, height: 10 });
    expect(t.heard.filter((m) => m.type === 'changed')).toEqual([]);
    t.flush();
    expect(t.heard.filter((m) => m.type === 'changed')).toEqual([
      { type: 'changed', protocol: P, rootId: t.root.id, areas: { selection: 2, scene: expect.any(Number), history: 1 } },
    ]);
  });

  it('steers selection and tool, and refuses a tool that is not registered', () => {
    const t = setup();
    t.panel.send({ type: 'yo', protocol: P });
    expect(t.result({ type: 'select', ids: [t.leaf] })).toBeNull();
    expect(t.selection).toEqual([t.leaf]);
    t.result({ type: 'set-tool', toolId: 'rect' });
    expect(t.tool).toBe('rect');
    expect(t.ask({ type: 'set-tool', toolId: 'lasso' })).toMatchObject({ type: 'error', message: 'no tool "lasso"' });
  });

  it('lays overlays and highlight over the canvas, and drops them when the panel leaves', () => {
    const t = setup();
    t.panel.send({ type: 'yo', protocol: P });
    t.result({ type: 'set-overlays', overlays: { hitboxes: true } });
    t.result({ type: 'highlight', ids: [t.leaf] });
    t.result({ type: 'set-overlays', overlays: { fps: true } });
    expect(t.setOverride).toHaveBeenLastCalledWith({ overlays: { hitboxes: true, fps: true }, highlight: [t.leaf] });
    t.close();
    expect(t.setOverride).toHaveBeenLastCalledWith(null);
  });

  it('announces roots that come and go after the handshake', () => {
    const t = setup();
    t.panel.send({ type: 'yo', protocol: P });
    t.unregister();
    expect(t.heard.at(-1)).toEqual({ type: 'root-removed', protocol: P, rootId: t.root.id });
    t.hook.register(t.root);
    expect(t.heard.at(-1)).toMatchObject({ type: 'root-added', root: { id: t.root.id } });
  });

  it('describes what the root has registered, and says when that changes', () => {
    const t = setup();
    t.panel.send({ type: 'yo', protocol: P });
    expect(t.result({ type: 'get-registry' })).toEqual({
      tools: [], actions: [], deps: [{ name: 'selection', depth: 0, stacked: 1 }], routingKinds: ['rect'],
    });
    t.registryChanged();
    t.flush();
    expect(t.heard.filter((m) => m.type === 'changed')).toEqual([
      { type: 'changed', protocol: P, rootId: t.root.id, areas: { registry: 1 } },
    ]);
  });

  it('refuses get-registry and get-history for a root that serves neither', () => {
    const t = setup();
    const bare = createDevtoolsRoot({ ...t.root.source, registry: undefined, history: undefined });
    t.hook.register(bare);
    t.panel.send({ type: 'yo', protocol: P });
    const ask = (type: string) => {
      t.panel.send({ protocol: P, requestId: 99, rootId: bare.id, type, cursor: 0 } as PanelMessage);
      return t.heard.at(-1);
    };
    expect(ask('get-registry')).toMatchObject({ type: 'error', message: 'this root serves no registry' });
    expect(ask('get-history')).toMatchObject({ type: 'error', message: 'no history to read' });
  });

  it('records history steps while connected, and hands back what was recorded since a cursor', () => {
    const t = setup();
    t.scene.setPose(t.group as NodeId, { x: 1, y: 0, width: 10, height: 10 });
    t.panel.send({ type: 'yo', protocol: P });
    expect(t.result({ type: 'get-history', cursor: 0 })).toEqual({
      entries: [], cursor: 0, position: { index: 3, total: 3, canUndo: true, canRedo: false },
    });
    t.scene.setPose(t.group as NodeId, { x: 7, y: 2, width: 10, height: 10 });
    t.scene.undo();
    t.flush();
    expect(t.heard.filter((m) => m.type === 'changed').at(-1)).toMatchObject({ areas: { history: 2 } });
    const slice = t.result({ type: 'get-history', cursor: 0, checkpoints: true }) as {
      entries: { step: string; entries: { label: string; ops: { targets: string[] }[] }[] }[];
      cursor: number; position: unknown; checkpoints: { label: string }[];
    };
    expect(slice.entries.map((r) => r.step)).toEqual(['push', 'undo']);
    expect(slice.entries[0]!.entries[0]!.ops[0]!.targets).toEqual([t.group]);
    expect(slice).toMatchObject({ cursor: 2, position: { index: 3, total: 4, canUndo: true, canRedo: true } });
    expect(slice.checkpoints).toHaveLength(4);
    expect(t.result({ type: 'get-history', cursor: slice.cursor })).toMatchObject({ entries: [], cursor: 2 });
    t.panel.send({ type: 'bye', protocol: P });
    t.scene.redo();
    expect((t.root.source.history!.since(2)).entries).toEqual([]);
  });
});
