/**
 * `AffordanceRegion.cursor` reaches the hover-cursor pump.
 *
 * It didn't used to. The field was declared on the region model and set by
 * `rotationHandle` (`'grab'`, customizable via `RotationHandleOptions.cursor`),
 * but the only hit-tester that ran for kit chrome was the hand-written
 * classifier, which synthesized hits without going through region objects and
 * hardcoded `'grab'` on the rotate path. Consolidating onto one region walk is
 * what connects the declared value to the pump, which reads
 * `AffordanceHit.cursor`.
 */
import { describe, expect, it } from 'vitest';
import { buildAffordanceAt } from './affordanceAt';
import { createRotationAffordance } from 'affordances/rotationHandle';
import { hitAffordanceRegions } from 'affordances/hitAffordanceRegions';
import type { ChromeState } from 'core/selection/chromeState';
import type { NodeId } from 'core/scene/types';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function makeState(bounds = { x: 0, y: 0, width: 100, height: 100 }): ChromeState {
  const selection = ['n1'] as unknown as readonly NodeId[];
  return {
    selection,
    multiActive: false,
    boundsOf: (id: string) => (id === 'n1' ? bounds : null),
    unionBounds: null,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  };
}

describe('AffordanceHit.cursor comes from the region', () => {
  const affordanceAt = buildAffordanceAt({
    getChromeState: () => makeState(),
    getView: () => VIEW,
  });

  it('resize corners report a diagonal cursor matching their axis parity', () => {
    // Top-left and bottom-right sit on the ↘ diagonal; the other two on ↗.
    expect(affordanceAt({ x: 0, y: 0 })?.cursor).toBe('nwse-resize');
    expect(affordanceAt({ x: 100, y: 100 })?.cursor).toBe('nwse-resize');
    expect(affordanceAt({ x: 100, y: 0 })?.cursor).toBe('nesw-resize');
    expect(affordanceAt({ x: 0, y: 100 })?.cursor).toBe('nesw-resize');
  });

  it('the rotate ring reports grab', () => {
    // Just above the top edge: outside the AABB cutout, inside the ring.
    const hit = affordanceAt({ x: 50, y: -10 });
    expect(hit?.kind).toBe('rotate-handle');
    expect(hit?.cursor).toBe('grab');
  });

  it("honors a custom cursor on the rotation affordance's region", () => {
    // The customization point that existed but did nothing: the value was
    // declared on the region and the live path hardcoded 'grab' instead.
    const custom = createRotationAffordance({ bandPx: 24, cursor: 'crosshair' });
    const hit = hitAffordanceRegions([custom], 50, -10, makeState(), VIEW);
    expect(hit?.region.cursor).toBe('crosshair');
  });
});

describe('AffordanceHit payload', () => {
  const affordanceAt = buildAffordanceAt({
    getChromeState: () => makeState(),
    getView: () => VIEW,
  });

  it('lifts targetIds, anchor and fixedPoint out of the region scratch', () => {
    const hit = affordanceAt({ x: 0, y: 0 });
    expect(hit).toMatchObject({
      kind: 'handle:top-left',
      targetIds: ['n1'],
      // Dragging the top-left corner pins the bottom-right one.
      anchor: { x: 'max', y: 'max' },
      fixedPoint: { x: 100, y: 100 },
    });
  });

  it('gives the rotate ring the AABB center as its pivot', () => {
    expect(affordanceAt({ x: 50, y: -10 })).toMatchObject({
      kind: 'rotate-handle',
      targetIds: ['n1'],
      fixedPoint: { x: 50, y: 50 },
    });
  });
});

describe('AffordanceHit carries its owner and claim strength', () => {
  const affordanceAt = buildAffordanceAt({
    getChromeState: () => makeState(),
    getView: () => VIEW,
  });

  it('names the affordance that produced the hit as its owner', () => {
    expect(affordanceAt({ x: 0, y: 0 })?.owner).toBe('selection.resize-handles');
  });

  it('claims shared, so kit chrome keeps competing on scope as it always has', () => {
    expect(affordanceAt({ x: 0, y: 0 })?.strength).toBe('shared');
  });
});
