import { describe, it, expect, vi } from 'vitest';
import type { CanvasExtensionApi, CanvasInspection, ContributionDepReader, DebugFlags } from '@weasel-js/core';
import { createDispatchTrace } from '@weasel-js/routing';
import { createScene } from '@weasel-js/core';
import { canvasRoot } from './attach';
import { historySlice } from './history';
import { isPanelMessage } from './messageShape';
import { DEVTOOLS_PROTOCOL } from './protocol';

const api = { element: null, getView: () => null, subscribeView: () => () => {}, getDebug: () => null } as unknown as CanvasExtensionApi;

function withInspection() {
  const setDebugOverride = vi.fn<(flags: DebugFlags | null) => void>();
  const inspection = { setDebugOverride, subscribe: () => () => {}, deps: () => ({}) } as unknown as CanvasInspection;
  const deps: ContributionDepReader = { get: ((name: string) => (name === 'inspection' ? inspection : undefined)) as ContributionDepReader['get'] };
  return { root: canvasRoot(api, deps).root, setDebugOverride };
}

describe('canvasRoot', () => {
  it('lays only feature flags and the highlight over the canvas debug config', () => {
    const t = withInspection();
    t.root.source.setOverride({ overlays: { bounds: true, highlight: true, theme: true } as never, highlight: [] });
    expect(t.setDebugOverride).toHaveBeenLastCalledWith({ bounds: true });
    t.root.source.setOverride({ overlays: { fps: false }, highlight: ['a'] });
    expect(t.setDebugOverride).toHaveBeenLastCalledWith({ fps: false, highlight: ['a'] });
  });
});

/** A canvas whose `dispatchTrace` and scene can be swapped, telling the root through its registry and inspection. */
function swappable() {
  const deps: Record<string, unknown> = { dispatchTrace: createDispatchTrace(10, false) };
  const registryListeners = new Set<() => void>();
  const inspectionListeners = new Set<(change: string) => void>();
  const inspection = {
    setDebugOverride: () => {},
    coords: () => undefined,
    deps: () => ({ subscribe: (l: () => void) => { registryListeners.add(l); return () => registryListeners.delete(l); } }),
    subscribe: (l: (change: string) => void) => { inspectionListeners.add(l); return () => inspectionListeners.delete(l); },
  } as unknown as CanvasInspection;
  deps.inspection = inspection;
  const reader: ContributionDepReader = { get: ((name: string) => deps[name]) as ContributionDepReader['get'] };
  const { root } = canvasRoot(api, reader);
  return {
    root,
    deps,
    republish(name: string, value: unknown) {
      deps[name] = value;
      for (const l of registryListeners) l();
    },
    swapScene(scene: unknown) {
      deps.scene = scene;
      for (const l of inspectionListeners) l('scene');
    },
  };
}

const record = (mode: string) => ({ kind: 'mode' as const, ts: 0, mode, from: null, to: null });

describe('a root over a canvas whose dispatcher republishes its trace', () => {
  it('records into, and reads, the trace published now', () => {
    const t = swappable();
    const release = t.root.source.trace.watch();
    const heard = vi.fn();
    const off = t.root.source.trace.subscribe(heard);
    const old = t.deps.dispatchTrace as ReturnType<typeof createDispatchTrace>;
    old.push(record('a'));
    const { cursor } = t.root.source.trace.since(0);
    const next = createDispatchTrace(10, false);
    t.republish('dispatchTrace', next);
    expect(next.recording()).toBe(true);
    expect(old.recording()).toBe(false);
    next.push(record('b'));
    expect(heard).toHaveBeenCalled();
    expect(t.root.source.trace.since(cursor).entries).toEqual([record('b')]);
    release();
    expect(next.recording()).toBe(false);
    off();
  });
});

describe('a root over a canvas whose scene is swapped', () => {
  it('reports only the new scene\'s history steps', () => {
    const t = swappable();
    const first = createScene({ systemLayers: [{ id: 'main' }] });
    t.swapScene(first);
    const release = t.root.source.history!.watch();
    first.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} });
    const { cursor } = t.root.source.history!.since(0);
    expect(cursor).toBe(1);
    const second = createScene({ systemLayers: [{ id: 'main' }] });
    t.swapScene(second);
    second.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} });
    expect(historySlice(t.root as never, 0, false).entries).toHaveLength(1);
    expect(t.root.source.history!.since(cursor).entries).toHaveLength(1);
    release();
  });
});

describe('set-overlays', () => {
  const msg = (overlays: unknown) => ({ type: 'set-overlays', protocol: DEVTOOLS_PROTOCOL, requestId: 1, rootId: 'r', overlays });
  it('accepts debug features only', () => {
    expect(isPanelMessage(msg({ bounds: true, fps: false }))).toBe(true);
    expect(isPanelMessage(msg({ highlight: true }))).toBe(false);
    expect(isPanelMessage(msg({ theme: true }))).toBe(false);
  });
});
