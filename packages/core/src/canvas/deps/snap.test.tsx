import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import type { SnapDep } from 'interactions/actions/snapDep';
import { captureMovePathSnap, snapMoveDelta } from 'interactions/actions/move/pathSnap';
import { createSnapOutcomeStore } from 'features/snap/outcomeStore';
import { useSnapDepSource, type SnapSources } from './snap';

afterEach(() => { cleanup(); });

function snapDepOf(sources: SnapSources): SnapDep {
  let reg!: DepRegistry;
  function Wire() {
    useSnapDepSource(sources, { current: null }, undefined, createSnapOutcomeStore());
    reg = useDepRegistry();
    return null;
  }
  render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
  return (reg.get as (n: string) => unknown)('snap') as SnapDep;
}

// A measurement end at (50, 50), within 5 of a point.
const END = { x: 50, y: 50 };
const targets = (p: { x: number; y: number }) => (Math.hypot(p.x - END.x, p.y - END.y) <= 5 ? END : null);
const grid = (p: { x: number; y: number }) => ({ x: Math.round(p.x / 7) * 7, y: Math.round(p.y / 7) * 7 });

describe('the snap dep with snapTargets', () => {
  it('locks a drawn point to a target ahead of snapPoint', () => {
    const snap = snapDepOf({ targets, snapPoint: grid });
    expect(snap.point({ x: 52, y: 47 })).toEqual(END);
    expect(snap.point({ x: 62, y: 47 })).toEqual({ x: 63, y: 49 });
  });

  it('carries a move onto a target, as the drag sees it', () => {
    const snap = snapDepOf({ targets, snapPoint: grid });
    const s = captureMovePathSnap(snap, { x: 10, y: 10 }, ['a']);
    // The press is the base: a target is no geometry of the dragged node.
    expect(s?.base).toEqual({ x: 10, y: 10 });
    expect(snapMoveDelta(s, 38, 41)).toEqual({ dx: 40, dy: 40, held: true });
    expect(snapMoveDelta(s, 20, 20)).toEqual({ dx: 20, dy: 20, held: false });
  });
});
