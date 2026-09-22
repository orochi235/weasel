import { describe, it, expect, vi } from 'vitest';
import { createPenPreviewLayer } from './penPreviewLayer';
import { usePenTool, type PenScratch } from 'tools/builtin/pen';
import { renderHook } from '@testing-library/react';
import type { PolygonPath } from './types';
import { anchorsToPath } from './anchors';

interface Pose { kind: 'path'; path: PolygonPath; closed: boolean }

const DIMS = { width: 400, height: 400 };

function setup() {
  const adapter = { addNode: vi.fn(() => 'id'), setSelection: vi.fn() };
  const wrapPath = (path: PolygonPath, opts: { closed: boolean }): Pose =>
    ({ kind: 'path', path, closed: opts.closed });
  const { result } = renderHook(() => usePenTool<Pose>({ wrapPath, adapter }));
  const tool = result.current;
  const scratch = tool.initScratch!() as PenScratch;
  const layer = createPenPreviewLayer({ penTool: tool });
  return { tool, scratch, layer };
}

describe('createPenPreviewLayer', () => {
  it('returns a screen-space RenderLayer with a stable id', () => {
    const { layer } = setup();
    expect(layer.space).toBe('screen');
    expect(layer.id).toBe('penPreview');
  });

  it('returns [] in idle state (no anchors, no cursor)', () => {
    const { layer } = setup();
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    expect(tree).toEqual([]);
  });

  it('emits paths for current subpath + rubber-band + anchor dots', () => {
    const { scratch, layer } = setup();
    scratch.current = {
      anchors: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      closed: false,
    };
    scratch.cursor = { x: 200, y: 200 };
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    // current subpath + rubber-band + 2 anchor dots = 4 path commands minimum.
    expect(tree.length).toBeGreaterThanOrEqual(4);
    expect(tree.every((c) => c.kind === 'path')).toBe(true);
  });

  it('emits an extra path for the close-hint ring when active', () => {
    const { scratch, layer } = setup();
    scratch.current = {
      anchors: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 50 }],
      closed: false,
    };
    scratch.cursor = { x: 1, y: 1 };
    scratch.closeHintActive = true;
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    // current subpath + rubber-band + 3 anchor dots + close-hint = 6 paths.
    expect(tree.length).toBeGreaterThanOrEqual(6);
  });

  it('emits a mirrored in-handle line + dot for the latest anchor while dragging an outHandle', () => {
    const linked = setup();
    linked.scratch.current = {
      anchors: [{ x: 50, y: 50, outHandle: { x: 80, y: 50 }, inHandle: { x: 20, y: 50 } }],
      closed: false,
    };
    linked.scratch.cursor = { x: 80, y: 50 };
    linked.scratch.draggingHandleAt = 0;
    const linkedTree = linked.layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);

    const broken = setup();
    broken.scratch.current = {
      anchors: [{ x: 50, y: 50, outHandle: { x: 80, y: 50 }, altBroken: true }],
      closed: false,
    };
    broken.scratch.cursor = { x: 80, y: 50 };
    broken.scratch.draggingHandleAt = 0;
    const brokenTree = broken.layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);

    // Mirror contributes exactly 2 extra commands (line + dot) over the
    // alt-broken case.
    expect(linkedTree.length - brokenTree.length).toBe(2);
  });


  it('draws each segment from the start anchor\'s out-handle to the end anchor\'s in-handle, as the commit does', () => {
    const { scratch, layer } = setup();
    const anchors = [
      { x: 0, y: 0 },
      { x: 100, y: 0, outHandle: { x: 150, y: 50 }, inHandle: { x: 50, y: -50 } },
      { x: 200, y: 0 },
    ];
    scratch.current = { anchors, closed: false };
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    const drawn = (tree[0] as { path: PolygonPath }).path;
    const committed = anchorsToPath([anchors], [false]);
    expect(Array.from(drawn.commands)).toEqual(Array.from(committed.commands));
    expect(Array.from(drawn.coords)).toEqual([0, 0, 0, 0, 50, -50, 100, 0, 150, 50, 200, 0, 200, 0]);
    expect(Array.from(drawn.coords)).toEqual(Array.from(committed.coords));
  });

  it('draws the latest anchor\'s in-handle where the anchor holds it, not a fresh mirror of its out-handle', () => {
    const { scratch, layer } = setup();
    // Alt pressed mid-drag froze the in-handle off the out-handle's line.
    scratch.current = {
      anchors: [{ x: 50, y: 50, outHandle: { x: 80, y: 50 }, inHandle: { x: 50, y: 20 }, altBroken: true }],
      closed: false,
    };
    scratch.draggingHandleAt = 0;
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    const lines = tree
      .map((c) => (c as { path: PolygonPath }).path)
      .filter((p) => p.commands.length === 2)
      .map((p) => Array.from(p.coords));
    expect(lines).toContainEqual([50, 50, 50, 20]);
    expect(lines).not.toContainEqual([50, 50, 20, 50]);
  });

  it('emits one path for each finished subpath', () => {
    const { scratch, layer } = setup();
    scratch.finishedSubpaths = [
      { anchors: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }], closed: true },
    ];
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    expect(tree.length).toBeGreaterThanOrEqual(1);
    expect(tree[0].kind).toBe('path');
  });
});
