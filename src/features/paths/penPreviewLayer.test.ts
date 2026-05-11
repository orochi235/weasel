import { describe, it, expect, vi } from 'vitest';
import { createPenPreviewLayer } from './penPreviewLayer';
import { useUserPenTool, type PenScratch } from 'tools/builtin/useUserPenTool';
import { renderHook } from '@testing-library/react';
import type { PolygonPath } from './types';

interface Pose { kind: 'path'; path: PolygonPath; closed: boolean }

const DIMS = { width: 400, height: 400 };

function setup() {
  const adapter = { addNode: vi.fn(() => 'id'), setSelection: vi.fn() };
  const wrapPath = (path: PolygonPath, opts: { closed: boolean }): Pose =>
    ({ kind: 'path', path, closed: opts.closed });
  const { result } = renderHook(() => useUserPenTool<Pose>({ wrapPath, adapter }));
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
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, DIMS);
    expect(tree).toEqual([]);
  });

  it('emits paths for current subpath + rubber-band + anchor dots', () => {
    const { scratch, layer } = setup();
    scratch.current = {
      anchors: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      closed: false,
    };
    scratch.cursor = { x: 200, y: 200 };
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, DIMS);
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
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, DIMS);
    // current subpath + rubber-band + 3 anchor dots + close-hint = 6 paths.
    expect(tree.length).toBeGreaterThanOrEqual(6);
  });

  it('emits one path for each finished subpath', () => {
    const { scratch, layer } = setup();
    scratch.finishedSubpaths = [
      { anchors: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }], closed: true },
    ];
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, DIMS);
    expect(tree.length).toBeGreaterThanOrEqual(1);
    expect(tree[0].kind).toBe('path');
  });
});
