/**
 * Handle sizes and hit radii are one number, scaled once.
 *
 * The failure this file exists to prevent is chrome you can see but cannot
 * grab: paint size lives in `SceneCanvas` / `domains/selection/overlay` and
 * hit radius lives in `affordances/cornerResize` / `canvas/affordanceAt`, and
 * before this they were five independent literal `8`s. Scaling one of them
 * for a coarse pointer and missing another is a silent, touch-only bug — and
 * one no assertion on a single constant can catch, so one test here takes
 * the paint size and the hit radius from their two call sites at one scale.
 */
import { describe, it, expect } from 'vitest';
import { HANDLE_BASE_PX, ROTATION_HANDLE_BASE_PX } from '../core/device/targets';
import { COARSE_TARGET_SCALE, resolveDeviceProfile } from '@weasel-js/routing';
import { DEFAULT_HANDLE_SIZE, mergeLayersWithDefaults } from './SceneCanvas';
import { DEFAULT_ROTATION_HANDLE_DISTANCE } from '../interactions/actions/rotate';
import { createCornerResizeAffordance } from '../affordances/cornerResize';
import { buildAffordanceAt, chromeAffordances } from './affordanceAt';
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

  // The slot is a union with `CustomLayerEntry`; only the overlay arm has
  // `handles`, and the defaults branch always produces that arm.
  const handleSizeOf = (targetScale?: number): unknown =>
    (mergeLayersWithDefaults(undefined, targetScale)
      .selectionOverlay as { handles?: { size?: number } } | null | undefined)
      ?.handles?.size;

  it('the default selection-overlay layer paints handles at the scaled size', () => {
    expect(handleSizeOf()).toBe(HANDLE_BASE_PX);
    expect(handleSizeOf(coarse.targetScale)).toBe(14);
  });

  it('paint size and hit radius agree under a coarse profile', () => {
    const painted = handleSizeOf(coarse.targetScale);
    const handles = chromeAffordances({ targetScale: coarse.targetScale })
      .find((a) => a.id === 'selection.resize-handles')!
      .regions(singleSelection());

    expect(painted).toBeGreaterThan(HANDLE_BASE_PX);
    expect(handles).toHaveLength(8);
    for (const r of handles) expect(r.shape).toMatchObject({ hitRadiusPx: painted });
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
