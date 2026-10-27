import { describe, expect, it, vi } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose, type Scene } from 'core/scene/types';
import type { SnapMods } from 'interactions/actions/snapDep';
import { createSnapOutcomeStore } from 'features/snap/outcomeStore';
import { createSession2d } from 'features/snap/session2d';
import { measureAt, measureEndSource } from './measureHit';
import { measureNode } from './measurement';

const FREE: SnapMods = { suspend: false, constrain: false };

function scene() {
  const s = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  s.add(measureNode(asNodeId('m'), 'main', { x: 0, y: 0 }, { x: 100, y: 50 }) as never);
  return s as unknown as Scene<unknown, string, unknown>;
}

/** The measurement with its far end shown at (200, 50) by a data override, as a gesture moving it publishes. */
function shownMoved(s: Scene<unknown, string, unknown>) {
  s.overrides.set(asNodeId('m'), { data: () => ({ measure: { start: { x: 0, y: 0 }, end: { x: 200, y: 50 } } }) });
  return s;
}

function at(p: { x: number; y: number }, exclude: string[] = [], reach = 8, sc = scene()) {
  const s = createSession2d({
    req: { gesture: 'point', press: p, ...(exclude.length ? { ids: exclude } : {}) },
    sources: [measureEndSource()],
    probes: [{ id: 'pointer', at: p, role: 'pointer' }],
    view: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }),
    reachPx: reach,
    scene: sc,
    store: createSnapOutcomeStore(),
  });
  return s.at(p, FREE);
}

describe('measureEndSource', () => {
  it('snaps to a measure end within 8px and not beyond it', () => {
    const hit = at({ x: 96, y: 54 });
    expect(hit.held).toBe(true);
    expect(hit.point).toEqual({ x: expect.closeTo(100, 9), y: expect.closeTo(50, 9) });
    expect(hit.marks).toEqual([{ kind: 'point', at: { x: 100, y: 50 }, glyph: 'center' }]);
    expect(at({ x: 91, y: 50 }).held).toBe(false);
  });

  it("takes the canvas's reach", () => {
    expect(at({ x: 90, y: 50 }, [], 12).held).toBe(true);
    expect(at({ x: 90, y: 50 }).held).toBe(false);
  });

  it('offers no end of a measurement the gesture is moving', () => {
    expect(at({ x: 3, y: 2 }, ['m']).held).toBe(false);
  });

  it('snaps to an end where it is shown', () => {
    expect(at({ x: 196, y: 54 }, [], 8, shownMoved(scene())).held).toBe(true);
  });
});

describe('measureAt', () => {
  it('finds an end where it is shown', () => {
    const s = shownMoved(scene());
    expect(measureAt(s, { layer: 'main' }, { x: 199, y: 50 }, 4)).toEqual({ id: 'm', part: 'end' });
  });

  it("reads only the measurement layer's nodes, not the whole scene", () => {
    const s = scene();
    const walk = vi.spyOn(s, 'renderOrderNodes');
    expect(measureAt(s, { layer: 'main' }, { x: 99, y: 50 }, 4)).toEqual({ id: 'm', part: 'end' });
    // A proxy for the cost: a hit test per pointer move should not walk every node of every layer.
    expect(walk).not.toHaveBeenCalled();
  });
});
