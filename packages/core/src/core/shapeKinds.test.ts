import { describe, it, expect } from 'vitest';
import {
  KIT_SHAPE_KINDS,
  SHAPE_KINDS,
  shapeKindInfo,
  shapeKindsWhere,
} from './shapeKinds';
import type { ShapeKindsWhere } from './shapeKinds';
import { BUNDLE_TOOLS } from 'canvas/SceneCanvas';
import { defaultNodeRouting } from 'canvas/SceneCanvas/defaultNodeRouting';
import { defaultNodeProperties } from 'canvas/SceneCanvas/defaultNodeProperties';

/** A tenth kind, added the way a real one would be. */
const EXTENDED = {
  ...SHAPE_KINDS,
  hexagon: { tool: true, insertPreview: true },
} as const;

describe('shape-kind table', () => {
  it('carries a tenth kind into every derived list and union', () => {
    expect(shapeKindsWhere(EXTENDED, 'tool')).toContain('hexagon');
    expect(shapeKindsWhere(EXTENDED, 'insertPreview')).toContain('hexagon');
    // Compile-time half: the unions are the same derivation, so a kind the
    // runtime lists is a kind the types admit.
    const toolId: ShapeKindsWhere<typeof EXTENDED, 'tool'> = 'hexagon';
    const insertShape: ShapeKindsWhere<typeof EXTENDED, 'insertPreview'> = 'hexagon';
    expect([toolId, insertShape]).toEqual(['hexagon', 'hexagon']);
  });

  it('is the source of every shipped list', () => {
    expect([...KIT_SHAPE_KINDS]).toEqual(shapeKindsWhere(SHAPE_KINDS, 'tool'));
    expect(defaultNodeRouting.map((e) => e.name)).toEqual([...KIT_SHAPE_KINDS]);
    expect(defaultNodeProperties.map((e) => e.name)).toEqual([...KIT_SHAPE_KINDS]);
    const exhaustive = BUNDLE_TOOLS.exhaustive;
    expect(KIT_SHAPE_KINDS.filter((k) => !exhaustive.includes(k))).toEqual([]);
  });

  it('answers per-kind questions through one accessor', () => {
    expect(shapeKindInfo('rect')).toEqual({ tool: true, insertPreview: true });
    expect(shapeKindInfo('image')?.tool).toBe(false);
    expect(shapeKindInfo('lasso')?.insertPreview).toBe(false);
    expect(shapeKindInfo('sticky-note')).toBeUndefined();
  });
});
