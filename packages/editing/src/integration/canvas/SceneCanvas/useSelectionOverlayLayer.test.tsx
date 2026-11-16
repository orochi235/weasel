import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AUTO_POSE_DESCRIPTOR } from '@weasel-js/core/engine';
import type { PathDrawCommand } from '@weasel-js/renderer';
import { createScene } from '@weasel-js/core/engine';
import { asNodeId, type RectPose } from '@weasel-js/core/engine';
import { useSelectionOverlayLayerForTests as useSelectionOverlayLayer } from '@weasel-js/core/test-seams';
import { SELECTION_CHROME } from '../../../chrome/selectionChrome';

const NONE: ReadonlySet<string> = new Set();
const build = (slot: Parameters<typeof useSelectionOverlayLayer>[0]) =>
  renderHook(() => useSelectionOverlayLayer(slot, () => NONE, AUTO_POSE_DESCRIPTOR as never, {}, undefined, SELECTION_CHROME)).result.current;

describe('useSelectionOverlayLayer', () => {
  it('builds the kit overlay from a config', () => {
    expect(build({ rotationHandle: true })).toMatchObject({
      layer: { space: 'screen' },
      rotationBadge: { distancePx: expect.any(Number) },
    });
  });

  it('builds nothing for a slot switched off', () => {
    expect(build(null)).toEqual({ layer: null, rotationBadge: null });
  });

  it('paints a pre-built layer in place of its own, with no rotate badge', () => {
    const layer = { id: 'mine', label: 'Mine', draw: () => [] };
    expect(build({ layer })).toEqual({ layer, rotationBadge: null });
  });

  it('outlines a caller\'s poseById on the stroke of the node it names', () => {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const pose = { x: 0, y: 0, width: 100, height: 100 };
    scene.add({
      id: asNodeId('a'), kind: 'mark', layer: 'main', pose,
      data: { shape: 'rect', stroke: { paint: { kind: 'solid', color: '#f00' }, width: 10 } },
    } as never);
    const slot = {
      poseById: () => pose, handles: false as const,
      outline: { paint: { kind: 'solid', color: '#f00' } as const, width: 0, pad: 0 },
    };
    const { layer } = renderHook(() =>
      useSelectionOverlayLayer(slot, () => NONE, AUTO_POSE_DESCRIPTOR as never, { measured: scene }, undefined, SELECTION_CHROME)).result.current;
    const data = { getChromeState: () => ({ selection: [asNodeId('a')], multiActive: false }) };
    const cmds = layer!.draw(data, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 400, height: 400, dpr: 1 });
    expect((cmds[0] as PathDrawCommand).path).toMatchObject({ x: -5, y: -5, width: 110, height: 110 });
  });
});
