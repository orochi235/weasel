import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import { createDebugSink } from 'debug/createDebugSink';
import { drawnBoxes } from 'interactions/actions/drawnBoxes';
import type { SnapDep } from 'interactions/actions/snapDep';
import { createSnapOutcomeStore } from 'features/snap/outcomeStore';
import type { SnapSource } from 'features/snap/types';
import type { OriginProjection } from 'interactions/gestures/shared/originProjection';
import { useSnapDepSource, type SnapSessionSources } from './snap';

afterEach(() => { cleanup(); });

const FREE = { suspend: false, constrain: false };
const scene = createScene({ systemLayers: [{ id: 'main' }] }) as unknown as Scene<unknown, string, unknown>;
const box = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: { x: 10, y: 20, width: 10, height: 10 } } as never) as string;

function snapDepOf(session: Omit<SnapSessionSources, 'scene' | 'boxes'>): SnapDep {
  let reg!: DepRegistry;
  function Wire() {
    useSnapDepSource({ current: null }, { scene, boxes: () => drawnBoxes({ scene }), ...session }, createSnapOutcomeStore());
    reg = useDepRegistry();
    return null;
  }
  render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
  return (reg.get as (n: string) => unknown)('snap') as SnapDep;
}

/** One point target at `at`, for pointer probes. */
const pointAt = (at: { x: number; y: number }): SnapSource => ({
  id: `at:${at.x},${at.y}`, roles: ['pointer'],
  *collect(q) { for (const p of q.probes) yield { probe: p.id, locus: { at, dirs: [] } }; },
});

describe('the snap dep', () => {
  it('runs a session over the sources it is given', () => {
    const snap = snapDepOf({ sources: [pointAt({ x: 50, y: 50 })] });
    const s = snap.begin({ gesture: 'point', press: { x: 0, y: 0 } });
    expect(s.at({ x: 52, y: 47 }, FREE)).toMatchObject({ point: { x: 50, y: 50 }, held: true });
    expect(s.at({ x: 70, y: 47 }, FREE)).toMatchObject({ point: { x: 70, y: 47 }, held: false });
  });

  it('records each frame\'s candidates into the debug sink, and clears them at the end', () => {
    const sink = createDebugSink({ snap: true });
    const snap = snapDepOf({ sources: [pointAt({ x: 50, y: 50 }), pointAt({ x: 56, y: 50 })], debug: () => sink });
    const s = snap.begin({ gesture: 'point', press: { x: 0, y: 0 } });
    s.at({ x: 51, y: 50 }, FREE);
    expect(sink.snapshot().snap).toEqual([
      { point: { x: 50, y: 50 }, accepted: true },
      { point: { x: 56, y: 50 }, accepted: false },
    ]);
    s.end();
    expect(sink.snapshot().snap).toEqual([]);
  });

  it('reads the origin probe through the canvas\'s origin projection', () => {
    const seen: { x: number; y: number }[] = [];
    const spy: SnapSource = { id: 'spy', roles: ['origin'], collect(q) { seen.push(...q.probes.map((p) => p.at)); return []; } };
    const center: OriginProjection<unknown> = {
      getOrigin: (p) => { const r = p as { x: number; y: number; width: number; height: number }; return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; },
      translate: (p) => p,
    };
    const snap = snapDepOf({ sources: [spy], originProjection: center });
    snap.begin({ gesture: 'move', ids: [box], press: { x: 12, y: 22 } }).at({ x: 12, y: 22 }, FREE);
    expect(seen).toEqual([{ x: 15, y: 25 }]);
  });

  /** Vertical lines every `step` from x = 0, at `tier`. */
  const xLines = (id: string, xs: (x: number) => number, tier?: 'fallback'): SnapSource => ({
    id, roles: ['pointer'], ...(tier ? { tier } : {}),
    *collect(q) { for (const p of q.probes) yield { probe: p.id, locus: { at: { x: xs(p.at.x), y: p.at.y }, dirs: [{ x: 0, y: 1 }] } }; },
  });

  it('a gesture source is asked alongside the canvas sources', () => {
    const grid = xLines('grid', (x) => Math.round(x / 100) * 100, 'fallback');
    const snap = snapDepOf({ sources: [grid] });
    const press = { x: 0, y: 0 };
    expect(snap.begin({ gesture: 'point', press }).at({ x: 102, y: 40 }, FREE).point).toEqual({ x: 100, y: 40 });
    const s = snap.begin({ gesture: 'point', press, sources: [xLines('gesture', () => 103)] });
    expect(s.at({ x: 102, y: 40 }, FREE).point).toEqual({ x: 103, y: 40 });
  });

  it('omit drops a canvas source for that gesture only', () => {
    const snap = snapDepOf({ sources: [] });
    const near = { x: 11, y: 21 };
    expect(snap.begin({ gesture: 'point', press: { x: 0, y: 0 }, omit: ['path-snap'] }).at(near, FREE).held).toBe(false);
    expect(snap.begin({ gesture: 'point', press: { x: 0, y: 0 } }).at(near, FREE)).toMatchObject({ point: { x: 10, y: 20 }, held: true });
  });

  it('a gesture source sharing an asked id throws', () => {
    const snap = snapDepOf({ sources: [pointAt({ x: 50, y: 50 })] });
    expect(() => snap.begin({ gesture: 'point', press: { x: 0, y: 0 }, sources: [pointAt({ x: 50, y: 50 })] }))
      .toThrow(/share the id 'at:50,50'/);
    expect(() => snap.begin({ gesture: 'point', press: { x: 0, y: 0 }, sources: [{ ...pointAt({ x: 1, y: 1 }), id: 'path-snap' }] }))
      .toThrow(/share the id 'path-snap'/);
    expect(() => snap.begin({ gesture: 'point', press: { x: 0, y: 0 }, omit: ['path-snap'], sources: [{ ...pointAt({ x: 1, y: 1 }), id: 'path-snap' }] }))
      .not.toThrow();
  });
});
