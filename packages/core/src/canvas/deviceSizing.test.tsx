/**
 * Handle sizes and hit radii are one number, scaled once.
 *
 * The failure this file exists to prevent is chrome you can see but cannot
 * grab: paint size lives in `SceneCanvas` / `features/selection/overlay` and
 * hit radius lives in `affordances/cornerResize` / `canvas/affordanceAt`, and
 * before this they were five independent literal `8`s. Scaling one of them
 * for a coarse pointer and missing another is a silent, touch-only bug — and
 * one no assertion on a single constant can catch, so the last test here
 * reads the paint size and the hit radius off the *same* emitted region.
 */
import { describe, it, expect } from 'vitest';
import { HANDLE_BASE_PX, ROTATION_HANDLE_BASE_PX } from '../core/device/targets';
import { COARSE_TARGET_SCALE, resolveDeviceProfile } from '../core/device/profile';
import { DEFAULT_HANDLE_SIZE, mergeLayersWithDefaults } from './SceneCanvas';
import { DEFAULT_ROTATION_HANDLE_DISTANCE } from '../interactions/actions/rotate';
import { createCornerResizeAffordance } from '../affordances/cornerResize';
import { buildAffordanceAt } from './affordanceAt';
import type { ChromeState } from 'core/selection/chromeState';
import { asNodeId } from 'core/scene/types';

const coarse = resolveDeviceProfile({ coarsePointer: true, canHover: false, dpr: 2 });

function singleSelection(): ChromeState {
  return {
    selection: [asNodeId('a')],
    multiActive: false,
    boundsOf: () => ({ x: 100, y: 100, width: 50, height: 40 }),
    unionBounds: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
  };
}

describe('device-scaled chrome sizing', () => {
  it('public constants keep their unscaled values (no consumer break)', () => {
    expect(DEFAULT_HANDLE_SIZE).toBe(HANDLE_BASE_PX);
    expect(DEFAULT_HANDLE_SIZE).toBe(8);
    expect(DEFAULT_ROTATION_HANDLE_DISTANCE).toBe(ROTATION_HANDLE_BASE_PX);
    expect(DEFAULT_ROTATION_HANDLE_DISTANCE).toBe(24);
  });

  it('a coarse profile scales the base sizes into the touch-target band', () => {
    expect(HANDLE_BASE_PX * coarse.targetScale).toBe(14);
    expect(ROTATION_HANDLE_BASE_PX * coarse.targetScale).toBe(42);
    expect(coarse.targetScale).toBe(COARSE_TARGET_SCALE);
  });

  it('the default selection-overlay layer paints handles at the scaled size', () => {
    // The slot is a union with `CustomLayerEntry`; only the overlay arm has
    // `handles`, and the defaults branch always produces that arm.
    const handleSizeOf = (targetScale?: number): unknown =>
      (mergeLayersWithDefaults(undefined, targetScale)
        .selectionOverlay as { handles?: { size?: number } } | null | undefined)
        ?.handles?.size;

    expect(handleSizeOf()).toBe(HANDLE_BASE_PX);
    expect(handleSizeOf(coarse.targetScale)).toBe(14);
  });

  // The regression guard this whole task exists for. Visual size and hit
  // radius are computed in different files; if they ever diverge you get
  // chrome you can see but cannot grab. Read both off one emitted region.
  it('paint size and hit radius agree under a coarse profile', () => {
    const scaled = HANDLE_BASE_PX * coarse.targetScale;
    const regions = createCornerResizeAffordance({
      handleSize: scaled,
      handleHitRadius: scaled,
    }).regions(singleSelection());

    expect(regions).toHaveLength(4);
    for (const r of regions) {
      expect(r.paint).toMatchObject({ sizePx: scaled });
      expect(r.shape).toMatchObject({ hitRadiusPx: scaled });
    }
  });

  it('a caller passing neither option gets an agreeing unscaled pair', () => {
    const regions = createCornerResizeAffordance().regions(singleSelection());
    for (const r of regions) {
      expect(r.paint).toMatchObject({ sizePx: HANDLE_BASE_PX });
      expect(r.shape).toMatchObject({ hitRadiusPx: HANDLE_BASE_PX });
    }
  });
});

describe('device-scaled affordance hit zones', () => {
  const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
  // Top-left corner of `singleSelection()`'s bounds.
  const CORNER = { x: 100, y: 100 };
  // Between the fine grab half-extent (8px) and the coarse one (8 * 1.75 = 14px).
  const OFF = 12;

  const hitAt = (targetScale: number) =>
    buildAffordanceAt({
      getChromeState: singleSelection,
      getView: () => view,
      targetScale,
    })({ x: CORNER.x - OFF, y: CORNER.y - OFF })?.kind;

  it('a coarse pointer grabs a corner handle out to the scaled radius', () => {
    expect(hitAt(coarse.targetScale)).toBe('handle:top-left');
  });

  it('a fine pointer does not', () => {
    expect(hitAt(1)).not.toBe('handle:top-left');
  });
});
