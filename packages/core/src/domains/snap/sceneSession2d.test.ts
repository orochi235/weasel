import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { RectPose, Scene } from 'core/scene/types';
import { createSnapSession2d } from './sceneSession2d';
import type { SnapCollect, SnapSource } from './types';

const STROKED = { shape: 'rect', stroke: { paint: { kind: 'solid', color: '#f00' }, width: 10 } };

function fixture() {
  const s = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = s.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: STROKED });
  const b = s.add({ kind: 'mark', layer: 'main', pose: { x: 200, y: 0, width: 100, height: 100 }, data: {} });
  return { scene: s as unknown as Scene<unknown, string, unknown>, a: a as string, b: b as string };
}

function spy(seen: SnapCollect[]): SnapSource {
  return { id: 'spy', roles: ['box', 'pointer'], collect(q) { seen.push(q); return []; } };
}

describe('createSnapSession2d', () => {
  it('hands a move\'s sources the subject\'s drawn box where the drag puts it, and a drawn-box reader', () => {
    const { scene, a, b } = fixture();
    const seen: SnapCollect[] = [];
    const s = createSnapSession2d({
      scene, view: { x: 0, y: 0, scale: { x: 1, y: 1 } }, sources: [spy(seen)], gesture: 'move', press: { x: 0, y: 0 }, ids: [a],
    });
    s.at({ x: 10, y: 20 }, { suspend: false, constrain: false });
    expect(seen[0].box).toEqual({ x: 5, y: 15, width: 110, height: 110 });
    expect(seen[0].drawnBox?.(a)).toEqual({ x: -5, y: -5, width: 110, height: 110 });
    expect(seen[0].drawnBox?.(b)).toEqual({ x: 200, y: 0, width: 100, height: 100 });
    expect(seen[0].probes.map((p) => p.id)).toEqual(['box.min', 'box.center', 'box.max']);
  });

  it('carries no subject box for a point gesture', () => {
    const { scene: sc } = fixture();
    const seen: SnapCollect[] = [];
    createSnapSession2d({
      scene: sc, view: { x: 0, y: 0, scale: { x: 1, y: 1 } }, sources: [spy(seen)], gesture: 'point', press: { x: 1, y: 1 },
    }).at({ x: 3, y: 4 }, { suspend: false, constrain: false });
    expect(seen[0].box).toBeUndefined();
    expect(seen[0].probes).toEqual([{ id: 'pointer', at: { x: 3, y: 4 }, role: 'pointer' }]);
  });
});
