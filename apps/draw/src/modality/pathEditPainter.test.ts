import { describe, it, expect } from 'vitest';
import { createPathEditPainter, type Anchor } from './pathEditPainter';
import type { PathDrawCommand } from '@weasel-js/core/renderer';

describe('createPathEditPainter', () => {
  it('returns empty draw commands when targetId is null', () => {
    const painter = createPathEditPainter({
      getTargetId: () => null,
      getAnchors: () => [],
    });
    expect(painter()).toEqual([]);
  });

  it('emits one anchor-dot command per anchor of the target', () => {
    const anchors: Anchor[] = [
      { x: 10, y: 10 },
      { x: 50, y: 80 },
      { x: 100, y: 30 },
    ];
    const painter = createPathEditPainter({
      getTargetId: () => 'p1',
      getAnchors: (id) => (id === 'p1' ? anchors : []),
    });
    const cmds = painter() as PathDrawCommand[];

    // At least one 'path' command per anchor (the anchor dot circle).
    expect(cmds.length).toBeGreaterThanOrEqual(anchors.length);
    // All commands should be 'path' draw commands (no other vocabulary in this renderer).
    for (const c of cmds) {
      expect(c.kind).toBe('path');
    }
    // Each anchor must produce a filled circle command (anchor dot).
    const filledCmds = cmds.filter((c) => c.fill != null);
    expect(filledCmds.length).toBeGreaterThanOrEqual(anchors.length);
  });

  it('emits handle lines for anchors with control handle data', () => {
    const anchors: Anchor[] = [
      {
        x: 10,
        y: 10,
        controlIn: { x: 5, y: 5 },
        controlOut: { x: 15, y: 15 },
      },
    ];
    const painter = createPathEditPainter({
      getTargetId: () => 'p1',
      getAnchors: () => anchors,
    });
    const cmds = painter() as PathDrawCommand[];

    // Expect stroke-only (no fill) line commands for handle-in and handle-out.
    const lineCmds = cmds.filter((c) => c.stroke != null && c.fill == null);
    expect(lineCmds.length).toBeGreaterThanOrEqual(2);

    // Expect small filled circles for the handle endpoints.
    const handleDots = cmds.filter(
      (c) => c.fill != null && c.stroke != null,
    );
    expect(handleDots.length).toBeGreaterThanOrEqual(2);
  });
});
