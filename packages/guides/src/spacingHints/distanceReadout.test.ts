import { describe, expect, it, vi } from 'vitest';
import { createScene, createSnapOutcomeStore, type ActionDeps, type CanvasExtensionApi, type NodeId } from '@weasel-js/core';
import { distanceReadout } from './distanceReadout';

type Pose = { x: number; y: number; width: number; height: number };

function fixture(opts?: Parameters<typeof distanceReadout>[0]) {
  const scene = createScene<object, 'main', Pose>({ systemLayers: [{ id: 'main', visible: true, locked: false }] });
  const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
  const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 30, y: 0, width: 10, height: 10 }, data: {} });
  const c = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 30, y: 40, width: 10, height: 10 }, data: {} });
  let selected: NodeId[] = [a];
  const nodeAtPoint = vi.fn((p: { x: number; y: number }, exclude?: Iterable<NodeId>) => {
    const ex = new Set(exclude);
    if (p.x >= 30 && p.y >= 40 && !ex.has(c)) return c;
    if (p.x >= 30 && !ex.has(b)) return b;
    if (p.x < 10 && !ex.has(a)) return a;
    return null;
  });
  const store = createSnapOutcomeStore();
  const deps = {
    scene,
    snapReadout: { store },
    nodeAtPoint,
    selection: { get: () => selected },
  } as unknown as ActionDeps;
  const r = distanceReadout(opts);
  const heard = vi.fn();
  store.subscribe(heard);
  const el = document.createElement('div');
  const detach = r.attach!({ element: el } as unknown as CanvasExtensionApi, {} as never);
  const run = (params: Record<string, unknown>) => r.actions![0].invoker!.timing === 'immediate'
    && (r.actions![0].invoker as { run: (d: ActionDeps, p: unknown) => void }).run(deps, params);
  return { r, run, store, heard, el, detach, select: (ids: NodeId[]) => { selected = ids; }, a, b };
}

describe('distanceReadout', () => {
  it('shows the distance from the selection to the shape under the pointer while the modifier is held', () => {
    const { r, run, store, heard } = fixture();
    run({ show: true, worldX: 35, worldY: 5 });
    expect(r.read().gaps).toEqual([{ axis: 'x', min: 10, max: 30, at: 5 }]);
    expect(store.get()).toEqual([{ kind: 'distance', from: { x: 10, y: 5 }, to: { x: 30, y: 5 }, value: 20 }]);
    expect(heard).toHaveBeenCalledTimes(1);
    run({ show: false, worldX: 35, worldY: 5 });
    expect(r.read().gaps).toEqual([]);
    expect(store.get()).toEqual([]);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('shows nothing over empty canvas, over the selection itself, or with nothing selected', () => {
    const { r, run, select, heard } = fixture();
    run({ show: true, worldX: 20, worldY: 5 });
    run({ show: true, worldX: 5, worldY: 5 });
    expect(r.read().gaps).toEqual([]);
    select([]);
    run({ show: true, worldX: 35, worldY: 5 });
    expect(r.read().gaps).toEqual([]);
    expect(heard).not.toHaveBeenCalled();
  });

  it('hides on a press', () => {
    const { r, run, el, store } = fixture();
    run({ show: true, worldX: 35, worldY: 5 });
    el.dispatchEvent(new Event('pointerdown'));
    expect(r.read().gaps).toEqual([]);
    expect(store.get()).toEqual([]);
  });

  it('binds a hover with the modifier held, one without it, and the pointer leaving', () => {
    const { r } = fixture();
    expect(r.bindings!.map((b) => [b.spec, b.opts?.params])).toEqual([
      [{ kind: 'hover', mods: { alt: true, ctrl: 'optional', meta: 'optional', shift: 'optional' } }, { show: true }],
      [{ kind: 'hover', mods: { alt: false, ctrl: 'optional', meta: 'optional', shift: 'optional' } }, { show: false }],
      [{ kind: 'hover', motion: 'leave' }, { show: false }],
    ]);
  });

  it('mounts no layer of its own', () => {
    expect(fixture().r.overlay).toBeUndefined();
  });

  it('writes a leader to a shape it shares no range with as a line mark', () => {
    const { run, store } = fixture();
    run({ show: true, worldX: 35, worldY: 45 });
    expect(store.get()).toEqual([
      { kind: 'distance', from: { x: 10, y: 5 }, to: { x: 30, y: 5 }, value: 20 },
      { kind: 'distance', from: { x: 5, y: 10 }, to: { x: 5, y: 40 }, value: 30 },
      { kind: 'line', from: { x: 30, y: 5 }, to: { x: 30, y: 40 } },
      { kind: 'line', from: { x: 5, y: 40 }, to: { x: 30, y: 40 } },
    ]);
  });

  it('stamps its color on the distance and the leader', () => {
    const { run, store } = fixture({ color: '#e0397f' });
    run({ show: true, worldX: 35, worldY: 45 });
    expect(store.get().map((m) => m.color)).toEqual(Array(4).fill('#e0397f'));
  });
});
