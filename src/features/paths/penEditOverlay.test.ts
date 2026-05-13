import { describe, expect, it } from 'vitest';
import { renderPenEditOverlay } from './penEditOverlay';
import type { PenScratch } from 'tools/builtin/useUserPenTool';
import type { PenAnchor as KitPenAnchor } from './anchors';

const view = { x: 0, y: 0, scale: 1 } as const;

function editingScratch(
  anchors: KitPenAnchor[][],
  selectedKeys: string[] = [],
): PenScratch {
  return {
    mode: 'edit',
    finishedSubpaths: [],
    current: null,
    cursor: null,
    draggingHandleAt: null,
    closeHintActive: false,
    _pendingDown: null,
    _lastClick: null,
    edit: {
      objId: 'a',
      anchors,
      closed: anchors.map(() => false),
      selectedAnchors: new Set(selectedKeys),
      activeHandle: null,
      dirty: false,
      preConvert: null,
      original: { path: null as never, closed: false },
      marquee: null,
    },
  };
}

describe('renderPenEditOverlay', () => {
  it('returns no commands when not in edit mode', () => {
    const scratch: PenScratch = {
      mode: 'create',
      finishedSubpaths: [],
      current: null,
      cursor: null,
      draggingHandleAt: null,
      closeHintActive: false,
      _pendingDown: null,
      _lastClick: null,
      edit: null,
    };
    expect(renderPenEditOverlay(scratch, view)).toEqual([]);
  });

  it('emits one path command per anchor', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 10, y: 0 }]]);
    const cmds = renderPenEditOverlay(scratch, view);
    // At least 2 anchor marker squares.
    expect(cmds.length).toBeGreaterThanOrEqual(2);
    // Every command is a path DrawCommand.
    expect(cmds.every(c => c.kind === 'path')).toBe(true);
  });

  it('emits more commands for selected anchors (handle stems + dots)', () => {
    const withSelected = renderPenEditOverlay(
      editingScratch([[{ x: 0, y: 0, outHandle: { x: 10, y: 0 } }]], ['0:0']),
      view,
    );
    const withoutSelected = renderPenEditOverlay(
      editingScratch([[{ x: 0, y: 0, outHandle: { x: 10, y: 0 } }]], []),
      view,
    );
    expect(withSelected.length).toBeGreaterThan(withoutSelected.length);
  });

  it('emits a rubber-band rect command when marquee is active', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }]]);
    scratch.edit!.marquee = { x0: 0, y0: 0, x1: 10, y1: 10, additive: false };
    const cmds = renderPenEditOverlay(scratch, view);
    const cmds2 = renderPenEditOverlay(editingScratch([[{ x: 0, y: 0 }]]), view);
    expect(cmds.length).toBeGreaterThan(cmds2.length);
  });
});
