import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import { drawnBoxes } from 'interactions/actions/drawnBoxes';
import type { SnapDep } from 'interactions/actions/snapDep';
import { createSnapOutcomeStore } from 'domains/snap/outcomeStore';
import type { SnapSource } from 'domains/snap/types';
import { useSnapDepSource, type SnapSessionSources } from './snap';

const geometry = vi.hoisted(() => ({ calls: 0 }));
vi.mock('domains/paths/pathSnap/pathSnapSource', async (importActual) => {
  const actual = await importActual<typeof import('domains/paths/pathSnap/pathSnapSource')>();
  return {
    ...actual,
    ownGeometryAt: (...args: Parameters<typeof actual.ownGeometryAt>) => {
      geometry.calls++;
      return actual.ownGeometryAt(...args);
    },
  };
});

afterEach(() => { cleanup(); geometry.calls = 0; });

const scene = createScene({ systemLayers: [{ id: 'main' }] }) as unknown as Scene<unknown, string, unknown>;
const box = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 10, y: 20, width: 10, height: 10 } } as never) as string;

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

describe('the snap dep\'s geometry probe', () => {
  it('is not built for a move on a stock canvas, whose geometry source answers point gestures only', () => {
    const snap = snapDepOf({ sources: [] });
    snap.begin({ gesture: 'move', ids: [box], press: { x: 15, y: 25 } }).end();
    expect(geometry.calls).toBe(0);
  });

  it('is built when a source answering the gesture wants it', () => {
    const wants: SnapSource = { id: 'wants', roles: ['geometry'], gestures: ['move'], collect: () => [] };
    const snap = snapDepOf({ sources: [wants] });
    snap.begin({ gesture: 'move', ids: [box], press: { x: 15, y: 25 } }).end();
    expect(geometry.calls).toBe(1);
  });
});
