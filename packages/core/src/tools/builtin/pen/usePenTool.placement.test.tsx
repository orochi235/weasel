import { describe, it, expect, vi } from 'vitest';
import { act } from '@testing-library/react';
import {
  PATH_C,
  PATH_CMD_LENGTHS,
  PATH_L,
  PATH_M,
  PATH_Z,
  type PolygonPath,
  pathFromD,
} from '@weasel-js/geom';
import type { ActionDeps, InvocationCtx } from '@weasel-js/routing';
import { NO_MODS, setup } from './testing/penHarness';

// The real layer, recorded: the pen keeps its state to itself, and the one
// place it hands that object out is to the preview layer that paints from it.
vi.mock('domains/paths/penPreviewLayer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('domains/paths/penPreviewLayer')>();
  return { ...actual, createPenPreviewLayer: vi.fn(actual.createPenPreviewLayer) };
});

const DEG = Math.PI / 180;

describe('usePenTool', () => {
  it('click on empty space (Idle) → places a corner anchor and enters Drawing', () => {
    const p = setup();
    p.click(10, 20);
    expect(p.scratch.current).not.toBeNull();
    expect(p.scratch.current!.anchors).toEqual([{ x: 10, y: 20 }]);
    expect(p.scratch.finishedSubpaths).toEqual([]);
  });

  it('second click in Drawing → appends corner anchor', () => {
    const p = setup();
    p.click(10, 20);
    p.click(30, 40);
    expect(p.scratch.current!.anchors.length).toBe(2);
    expect(p.scratch.current!.anchors[1]).toEqual({ x: 30, y: 40 });
  });

  it('drag → places the anchor at the PRESS point with an outHandle at the drag end', () => {
    // The anchor lands where the pointer went down, not where the drag
    // threshold happened to be crossed. `InvocationCtx.drag.start` carries
    // the press position because the dispatcher buffers the pointerdown and
    // releases it at the threshold — which is why the pen no longer keeps a
    // `_pendingDown` field of its own.
    const p = setup();
    p.drag({ x: 10, y: 20 }, { x: 50, y: 20 }, {}, [{ x: 30, y: 20 }]);
    expect(p.scratch.current!.anchors.length).toBe(1);
    const a = p.scratch.current!.anchors[0];
    expect(a.x).toBe(10);
    expect(a.y).toBe(20);
    expect(a.outHandle).toEqual({ x: 50, y: 20 });
  });

  it('Alt held during placement drag → marks altBroken on the anchor', () => {
    const p = setup();
    p.drag({ x: 0, y: 0 }, { x: 20, y: 0 }, { alt: true });
    expect(p.scratch.current!.anchors[0].altBroken).toBe(true);
  });

  it('Shift held during drag → constrains outHandle direction to 45°', () => {
    const p = setup();
    p.drag({ x: 0, y: 0 }, { x: 10, y: 1 }, { shift: true });
    const out = p.scratch.current!.anchors[0].outHandle!;
    expect(out.y).toBeCloseTo(0);
    expect(out.x).toBeGreaterThan(0);
  });

  it('Shift puts a handle dragged at 40° on the 45° line, at the nearest point to the pointer', () => {
    const p = setup();
    const r = 100;
    p.drag({ x: 0, y: 0 }, { x: r * Math.cos(40 * DEG), y: r * Math.sin(40 * DEG) }, { shift: true });
    const out = p.scratch.current!.anchors[0].outHandle!;
    const along = r * Math.cos(5 * DEG) / Math.SQRT2;
    expect(out.x).toBeCloseTo(along, 9);
    expect(out.y).toBeCloseTo(along, 9);
  });

  it('a cancelled drag takes back the anchor it placed', () => {
    const p = setup();
    const invoker = p.actionOf('pen.dragHandle').invoker;
    if (invoker?.timing !== 'ongoing') throw new Error('expected ongoing');
    const cancelledDrag = () => act(() => {
      const handle = invoker.start({
        world: { x: 0, y: 0 }, screen: { x: 0, y: 0 },
        modifiers: NO_MODS, deps: {} as ActionDeps,
        drag: { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 } },
      })!;
      handle.onEnd?.({
        world: { x: 5, y: 5 }, screen: { x: 5, y: 5 },
        modifiers: NO_MODS, deps: {} as ActionDeps,
      }, 'cancel');
    });

    cancelledDrag();
    expect(p.scratch.draggingHandleAt).toBeNull();
    // Nothing was placed, so there is no subpath in progress either.
    expect(p.scratch.current).toBeNull();

    // With a path already under way, only the cancelled anchor goes.
    p.click(50, 50);
    p.click(80, 50);
    cancelledDrag();
    expect(p.scratch.current!.anchors).toHaveLength(2);
  });

  describe('segment control points (Illustrator/Figma)', () => {
    // A dragged anchor's out-handle is the drag vector and its in-handle the
    // mirror of it; segment A→B is C(A.out ?? A, B.in ?? B, B).
    const segs = (path: PolygonPath): string[] => {
      const names: Record<number, string> = { [PATH_M]: 'M', [PATH_L]: 'L', [PATH_C]: 'C', [PATH_Z]: 'Z' };
      const out: string[] = [];
      let ci = 0;
      for (const c of path.commands) {
        const n = PATH_CMD_LENGTHS[c];
        out.push([names[c], ...Array.from(path.coords.slice(ci, ci + n))].join(' '));
        ci += n;
      }
      return out;
    };

    it('a dragged anchor shapes the segment coming into it with its mirrored in-handle', () => {
      const p = setup();
      p.click(0, 0);
      p.drag({ x: 100, y: 0 }, { x: 150, y: 50 });
      p.click(200, 0);
      p.enter();
      expect(segs(p.adapter.added[0].path)).toEqual([
        'M 0 0',
        'C 0 0 50 -50 100 0',
        'C 150 50 200 0 200 0',
      ]);
    });

    it('a segment between two dragged anchors runs out-handle to in-handle', () => {
      const p = setup();
      p.drag({ x: 0, y: 0 }, { x: 0, y: -50 });
      p.drag({ x: 100, y: 0 }, { x: 100, y: 50 });
      p.enter();
      expect(segs(p.adapter.added[0].path)).toEqual(['M 0 0', 'C 0 -50 100 -50 100 0']);
    });

    it('Alt from the start of the drag leaves the anchor with no in-handle', () => {
      const p = setup();
      p.click(0, 0);
      p.drag({ x: 100, y: 0 }, { x: 150, y: 50 }, { alt: true });
      p.click(200, 0);
      p.enter();
      expect(segs(p.adapter.added[0].path)).toEqual([
        'M 0 0',
        'L 100 0',
        'C 150 50 200 0 200 0',
      ]);
    });

    it('Alt pressed mid-drag freezes the in-handle and moves only the out-handle', () => {
      const p = setup();
      p.click(0, 0);
      const inv = p.actionOf('pen.dragHandle').invoker;
      if (inv?.timing !== 'ongoing') throw new Error('expected ongoing');
      const mk = (world: { x: number; y: number }, alt: boolean): InvocationCtx => ({
        world, screen: world, modifiers: { ...NO_MODS, alt }, deps: {} as ActionDeps,
        drag: { start: { x: 100, y: 0 }, current: world, delta: { x: 0, y: 0 } },
      });
      act(() => {
        const h = inv.start(mk({ x: 150, y: 50 }, false))!;
        h.onMove?.(mk({ x: 120, y: 60 }, true));
        h.onEnd?.(mk({ x: 100, y: 80 }, true), 'commit');
      });
      const a = p.scratch.current!.anchors[1];
      expect(a.outHandle).toEqual({ x: 100, y: 80 });
      expect(a.inHandle).toEqual({ x: 50, y: -50 });
    });

    it('closing onto a dragged first anchor curves the closing segment into its in-handle', () => {
      const p = setup();
      p.drag({ x: 0, y: 0 }, { x: 0, y: -40 });
      p.click(100, 0);
      p.click(50, 100);
      p.click(0, 0);
      expect(segs(p.adapter.added[0].path)).toEqual([
        'M 0 0',
        'C 0 -40 100 0 100 0',
        'L 50 100',
        'C 50 100 0 40 0 0',
        'Z',
      ]);
    });

    it('a picked-up path keeps its existing segments: an out-handle alone does not bend the segment before it', () => {
      const p = setup({ paths: { n1: pathFromD('M 0 0 L 100 0 C 150 0 200 50 200 100') as PolygonPath } });
      p.click(200, 100);
      p.click(300, 100);
      p.enter();
      expect(segs(p.scene.n1)).toEqual([
        'M 0 0',
        'L 100 0',
        'C 150 0 200 50 200 100',
        'L 300 100',
      ]);
    });

    it('dragging a picked-up endpoint pulls its out-handle without reshaping the segment into it', () => {
      const p = setup({ paths: { n1: pathFromD('M 0 0 L 100 0') as PolygonPath } });
      p.drag({ x: 100, y: 0 }, { x: 150, y: 50 });
      p.click(200, 0);
      p.enter();
      expect(segs(p.scene.n1)).toEqual(['M 0 0', 'L 100 0', 'C 150 50 200 0 200 0']);
    });
  });
});
