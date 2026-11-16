/**
 * The insert dep commits a nascent shape at the extent `insertPreviewExtent` gives it, the one the canvas paints
 * the preview at and reports as the gesture's bounds.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { insertPreviewExtent, type InsertPreviewLike, type Scene } from '@weasel-js/core';
import { useInsertDepSource } from './insert';

function committedPose(ov: InsertPreviewLike): { x: number; y: number; width: number; height: number } {
  const applyOps = vi.fn();
  const scene = {
    layers: [{ id: 'default' }], renderOrder: () => [], get: () => undefined, mintId: () => 'inserted', roots: [],
  } as unknown as Scene<unknown, string, unknown>;
  let reg!: DepRegistry;
  function Wire() {
    useInsertDepSource(scene, { applyOps });
    reg = useDepRegistry();
    return null;
  }
  render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
  (reg.get as (k: string) => { commit: (b: unknown, e: unknown) => unknown })('insert').commit(ov.bounds, ov.extras);
  return applyOps.mock.calls[0][0][0].args.node.pose;
}

const cases: Array<[string, InsertPreviewLike]> = [
  ['a centered Alt-drag polygon', {
    shape: 'polygon', bounds: { x: 50, y: 50, width: 100, height: 100 },
    extras: { kind: 'polygon', sides: 6, rotation: 0, center: { x: 100, y: 100 }, radius: Math.hypot(50, 50) },
  }],
  ['a horizontal Alt-drag star', {
    shape: 'star', bounds: { x: 150, y: 100, width: 100, height: 0 },
    extras: { kind: 'star', points: 5, innerRadiusRatio: 0.5, rotation: 0, center: { x: 200, y: 100 }, outerRadius: 50 },
  }],
  ['a pencil scribble that loops back', {
    shape: 'pencil', bounds: { x: 100, y: 100, width: 0, height: 0 },
    extras: {
      kind: 'pencil',
      samples: [{ x: 100, y: 100 }, { x: 160, y: 110 }, { x: 140, y: 160 }, { x: 100, y: 130 }, { x: 100, y: 100 }],
    },
  }],
];

describe('the insert dep commits at the preview extent', () => {
  for (const [name, ov] of cases) {
    it(name, () => {
      expect(committedPose(ov)).toEqual(insertPreviewExtent(ov).bounds);
    });
  }
});
