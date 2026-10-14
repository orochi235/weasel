import { describe, expect, it, vi } from 'vitest';
import { createScene, type ActionDeps, type CanvasExtensionApi, type NodeId } from '@weasel-js/core';
import { distanceReadout } from './distanceReadout';

type Pose = { x: number; y: number; width: number; height: number };

function fixture() {
  const scene = createScene<object, 'main', Pose>({ systemLayers: [{ id: 'main', visible: true, locked: false }] });
  const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
  const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 30, y: 0, width: 10, height: 10 }, data: {} });
  let selected: NodeId[] = [a];
  const nodeAtPoint = vi.fn((p: { x: number }, exclude?: Iterable<NodeId>) => {
    const ex = new Set(exclude);
    if (p.x >= 30 && !ex.has(b)) return b;
    if (p.x < 10 && !ex.has(a)) return a;
    return null;
  });
  const deps = {
    scene,
    nodeAtPoint,
    selection: { get: () => selected },
  } as unknown as ActionDeps;
  const r = distanceReadout();
  const redraw = vi.fn();
  const el = document.createElement('div');
  const detach = r.attach!({ element: el, requestRedraw: redraw } as unknown as CanvasExtensionApi, {} as never);
  const run = (params: Record<string, unknown>) => r.actions![0].invoker!.timing === 'immediate'
    && (r.actions![0].invoker as { run: (d: ActionDeps, p: unknown) => void }).run(deps, params);
  return { r, run, redraw, el, detach, select: (ids: NodeId[]) => { selected = ids; }, a, b };
}

describe('distanceReadout', () => {
  it('shows the distance from the selection to the shape under the pointer while the modifier is held', () => {
    const { r, run, redraw } = fixture();
    run({ show: true, worldX: 35, worldY: 5 });
    expect(r.read().gaps).toEqual([{ axis: 'x', min: 10, max: 30, at: 5 }]);
    expect(redraw).toHaveBeenCalledTimes(1);
    run({ show: false, worldX: 35, worldY: 5 });
    expect(r.read().gaps).toEqual([]);
    expect(redraw).toHaveBeenCalledTimes(2);
  });

  it('shows nothing over empty canvas, over the selection itself, or with nothing selected', () => {
    const { r, run, select, redraw } = fixture();
    run({ show: true, worldX: 20, worldY: 5 });
    run({ show: true, worldX: 5, worldY: 5 });
    expect(r.read().gaps).toEqual([]);
    select([]);
    run({ show: true, worldX: 35, worldY: 5 });
    expect(r.read().gaps).toEqual([]);
    expect(redraw).not.toHaveBeenCalled();
  });

  it('hides on a press', () => {
    const { r, run, el } = fixture();
    run({ show: true, worldX: 35, worldY: 5 });
    el.dispatchEvent(new Event('pointerdown'));
    expect(r.read().gaps).toEqual([]);
  });

  it('binds a hover with the modifier held, one without it, and the pointer leaving', () => {
    const { r } = fixture();
    expect(r.bindings!.map((b) => [b.spec, b.opts?.params])).toEqual([
      [{ kind: 'hover', mods: { alt: true, ctrl: 'optional', meta: 'optional', shift: 'optional' } }, { show: true }],
      [{ kind: 'hover', mods: { alt: false, ctrl: 'optional', meta: 'optional', shift: 'optional' } }, { show: false }],
      [{ kind: 'hover', motion: 'leave' }, { show: false }],
    ]);
  });

  it('draws the readout as labeled gaps on its overlay', () => {
    const { r, run } = fixture();
    run({ show: true, worldX: 35, worldY: 5 });
    const layer = Array.isArray(r.overlay) ? r.overlay[0] : r.overlay!;
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const cmds = layer.draw(undefined, view as never, { width: 100, height: 100 });
    expect(cmds.some((c) => c.kind === 'text')).toBe(true);
  });
});
