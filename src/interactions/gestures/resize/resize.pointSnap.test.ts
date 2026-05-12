import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResize } from './resize';
import { ROTATED_POSE_DESCRIPTOR } from './geometry';
import type {
  ModifierState,
  PointSnapBehavior,
  PointSnapContext,
  PointSnapResult,
  ResizePose,
  RotatedPose,
} from '../types';
import type { Op } from 'core/ops/types';
import type { ResizeAdapter } from 'core/adapters/types';

const MODS: ModifierState = { alt: false, shift: false, meta: false, ctrl: false };

// ---- simple axis-aligned rect pose ----
interface P extends ResizePose {}

function makeAdapter(initial: [string, P][] = [['a', { x: 0, y: 0, width: 100, height: 60 }]]) {
  const state = new Map<string, P>(initial);
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: ResizeAdapter<{ id: string }, P> = {
    getNode: (id) => (state.has(id) ? { id } : undefined),
    getPose: (id) => ({ ...(state.get(id)!) }),
    setPose: (id, pose) => state.set(id, { ...pose }),
    applyBatch: (ops, label) => {
      batches.push({ ops, label });
      for (const op of ops) op.apply(adapter);
    },
  };
  return { adapter, batches, state };
}

// Adapter for rotated poses.
function makeRotatedAdapter(
  initial: [string, RotatedPose][] = [['a', { x: 0, y: 0, width: 100, height: 60, rotation: 0 }]],
) {
  const state = new Map<string, RotatedPose>(initial);
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: ResizeAdapter<{ id: string }, RotatedPose> = {
    getNode: (id) => (state.has(id) ? { id } : undefined),
    getPose: (id) => ({ ...(state.get(id)!) }),
    setPose: (id, pose) => state.set(id, { ...pose }),
    applyBatch: (ops, label) => {
      batches.push({ ops, label });
      for (const op of ops) op.apply(adapter);
    },
  };
  return { adapter, batches, state };
}

// Helper — rotate (px,py) about (cx,cy) by angle.
function rot(px: number, py: number, cx: number, cy: number, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: cx + (px - cx) * c - (py - cy) * s, y: cy + (px - cx) * s + (py - cy) * c };
}

describe('useResize point-snap behaviors', () => {
  it('snaps dragged corner of axis-aligned rect to nearest 50', () => {
    // Pose {x:0,y:0,w:100,h:60}; anchor=(min,min) → fixed=TL=(0,0), dragged=BR=(100,60).
    // Drag toward (123, 47); behavior snaps dragged corner to (100, 50).
    // Expected: pose.x=0, pose.y=0, width=100, height=50.
    const { adapter } = makeAdapter();

    const behavior: PointSnapBehavior<P> = {
      onMove(ctx) {
        if (!ctx.draggedCorner) return null;
        const round50 = (v: number) => Math.round(v / 50) * 50;
        return { frame: 'dragged-corner', worldX: round50(ctx.draggedCorner.worldX), worldY: round50(ctx.draggedCorner.worldY) };
      },
    };

    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, { pointSnapBehaviors: [behavior] }),
    );

    act(() => { result.current.start('a', { x: 'min', y: 'min' }, 100, 60); });
    act(() => { result.current.move(123, 47, MODS); });

    const ov = result.current.overlay!;
    expect(ov.targetPose.x).toBeCloseTo(0, 5);
    expect(ov.targetPose.y).toBeCloseTo(0, 5);
    expect(ov.targetPose.width).toBeCloseTo(100, 5);
    expect(ov.targetPose.height).toBeCloseTo(50, 5);
  });

  it('snaps world dragged corner of a rotated rect onto a grid intersection', () => {
    // Pose {x:0,y:0,w:100,h:60,rotation:Math.PI/4}; anchor=(min,min) → dragged=BR.
    // Center=(50,30). BR rotated 45° about (50,30).
    // Behavior snaps dragged corner to nearest 50 → G=(worldX rounded, worldY rounded).
    // Assert the back-solved pose's world dragged corner equals G within 1e-6.
    const angle = Math.PI / 4;
    const { adapter } = makeRotatedAdapter([
      ['a', { x: 0, y: 0, width: 100, height: 60, rotation: angle }],
    ]);

    let capturedResult: PointSnapResult | null = null;
    const behavior: PointSnapBehavior<RotatedPose> = {
      onMove(ctx) {
        if (!ctx.draggedCorner) return null;
        const round50 = (v: number) => Math.round(v / 50) * 50;
        const r: PointSnapResult = { frame: 'dragged-corner', worldX: round50(ctx.draggedCorner.worldX), worldY: round50(ctx.draggedCorner.worldY) };
        capturedResult = r;
        return r;
      },
    };

    const { result } = renderHook(() =>
      useResize<{ id: string }, RotatedPose>(adapter, {
        geometry: ROTATED_POSE_DESCRIPTOR,
        pointSnapBehaviors: [behavior],
      }),
    );

    // Start from the world-space BR corner before rotation.
    const cx = 50; const cy = 30;
    const brWorld = rot(100, 60, cx, cy, angle);
    act(() => { result.current.start('a', { x: 'min', y: 'min' }, brWorld.x, brWorld.y); });
    act(() => { result.current.move(brWorld.x + 17, brWorld.y + 8, MODS); });

    expect(capturedResult).not.toBeNull();
    const G = capturedResult!;

    // Verify the target pose's world dragged corner == G.
    const tp = result.current.overlay!.targetPose;
    const tpCx = tp.x + tp.width / 2;
    const tpCy = tp.y + tp.height / 2;
    const worldDragged = rot(tp.x + tp.width, tp.y + tp.height, tpCx, tpCy, angle);
    expect(worldDragged.x).toBeCloseTo(G.worldX, 4);
    expect(worldDragged.y).toBeCloseTo(G.worldY, 4);
  });

  it('center snap translates the pose without resizing', () => {
    // Use an edge drag (anchor.x='free') so drag doesn't change width.
    // Origin {x:0,y:0,w:100,h:60}; anchor=(free,min) → south edge moves.
    // Drag to same worldX (no width change), dy=+10 → h=70.
    // Behavior snaps center to (200,100). proposed center before snap = (50, 35).
    // After snap: dx=150, dy=65 → x=150, y=65; w=100, h=70.
    // Center = (200, 100). ✓
    const { adapter } = makeAdapter();

    const behavior: PointSnapBehavior<P> = {
      onMove(_ctx): PointSnapResult {
        return { frame: 'center', worldX: 200, worldY: 100 };
      },
    };

    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, { pointSnapBehaviors: [behavior] }),
    );

    // Edge drag: anchor y='min' means south edge drags; x='free' means no width change.
    act(() => { result.current.start('a', { x: 'free', y: 'min' }, 50, 60); });
    act(() => { result.current.move(50, 70, MODS); });

    const tp = result.current.overlay!.targetPose;
    // Width unchanged at 100; height is 70.
    expect(tp.width).toBeCloseTo(100, 5);
    expect(tp.height).toBeCloseTo(70, 5);
    // Center must be at (200,100).
    expect(tp.x + tp.width / 2).toBeCloseTo(200, 5);
    expect(tp.y + tp.height / 2).toBeCloseTo(100, 5);
  });

  it('origin snap translates the pose without resizing (axis-aligned)', () => {
    // Use an edge drag (anchor.x='free') so drag doesn't change width.
    // Origin {x:0,y:0,w:100,h:60}; anchor=(free,min) → south edge moves.
    // Drag dy=+10 → h=70. Behavior snaps origin (TL world) to (40,30).
    // For axis-aligned, TL = pose.(x,y). So new x=40, y=30; w=100, h=70.
    const { adapter } = makeAdapter();

    const behavior: PointSnapBehavior<P> = {
      onMove(_ctx): PointSnapResult {
        return { frame: 'origin', worldX: 40, worldY: 30 };
      },
    };

    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, { pointSnapBehaviors: [behavior] }),
    );

    act(() => { result.current.start('a', { x: 'free', y: 'min' }, 50, 60); });
    act(() => { result.current.move(50, 70, MODS); });

    const tp = result.current.overlay!.targetPose;
    expect(tp.x).toBeCloseTo(40, 5);
    expect(tp.y).toBeCloseTo(30, 5);
    expect(tp.width).toBeCloseTo(100, 5);
    expect(tp.height).toBeCloseTo(70, 5);
  });

  it('edge drag: draggedCorner is null in context; behavior keyed off it returns null; pose passes through', () => {
    // anchor.x === 'free' → edge drag → draggedCorner is null.
    const { adapter } = makeAdapter();

    let seenContext: PointSnapContext<P> | null = null;
    const behavior: PointSnapBehavior<P> = {
      onMove(ctx) {
        seenContext = ctx;
        return ctx.draggedCorner ? { frame: 'dragged-corner', worldX: 0, worldY: 0 } : null;
      },
    };

    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, { pointSnapBehaviors: [behavior] }),
    );

    act(() => { result.current.start('a', { x: 'free', y: 'min' }, 50, 60); });
    act(() => { result.current.move(50, 80, MODS); });

    expect(seenContext).not.toBeNull();
    expect(seenContext!.draggedCorner).toBeNull();
    expect(seenContext!.fixedCorner).toBeNull();
    // Height should have changed per normal resize math; point-snap did nothing.
    const tp = result.current.overlay!.targetPose;
    expect(tp.width).toBeCloseTo(100, 5);
    expect(tp.height).toBeCloseTo(80, 5);
  });

  it('iterates pointSnapBehaviors in order; first non-null result wins', () => {
    const { adapter } = makeAdapter();

    const b1: PointSnapBehavior<P> = { onMove: () => null };
    const b2: PointSnapBehavior<P> = {
      onMove(ctx): PointSnapResult | null {
        if (!ctx.draggedCorner) return null;
        return { frame: 'dragged-corner', worldX: 50, worldY: 50 };
      },
    };

    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, { pointSnapBehaviors: [b1, b2] }),
    );

    act(() => { result.current.start('a', { x: 'min', y: 'min' }, 100, 60); });
    act(() => { result.current.move(120, 70, MODS); });

    // Back-solve: pin=(0,0), target=(50,50) → width=50, height=50, center=(25,25) → x=0, y=0.
    const tp = result.current.overlay!.targetPose;
    expect(tp.width).toBeCloseTo(50, 5);
    expect(tp.height).toBeCloseTo(50, 5);
    expect(tp.x).toBeCloseTo(0, 5);
    expect(tp.y).toBeCloseTo(0, 5);
  });

  it('pointSnapToGrid honors bypassKey: meta=true suppresses snap', () => {
    // Use a manual implementation of the bypass-key logic to verify the hook
    // passes modifiers through correctly. (pointSnapToGrid is in Task 3; here we
    // inline equivalent logic.)
    const { adapter } = makeAdapter();

    const behavior: PointSnapBehavior<P> = {
      onMove(ctx) {
        if (ctx.modifiers.meta) return null;
        if (!ctx.draggedCorner) return null;
        const round50 = (v: number) => Math.round(v / 50) * 50;
        return { frame: 'dragged-corner', worldX: round50(ctx.draggedCorner.worldX), worldY: round50(ctx.draggedCorner.worldY) };
      },
    };

    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, { pointSnapBehaviors: [behavior] }),
    );

    act(() => { result.current.start('a', { x: 'min', y: 'min' }, 100, 60); });
    act(() => { result.current.move(123, 47, { ...MODS, meta: true }); });

    // meta=true → snap bypassed → raw resize: w=100+(123-100)=123, h=60+(47-60)...
    // Actually anchor=(min,min) means fixed at TL, dragged at BR.
    // origin start=(100,60), move to (123,47) → dx=23, dy=-13.
    // nw = 100 + 23 = 123, nh = 60 + (-13) = 47.
    const tp = result.current.overlay!.targetPose;
    expect(tp.width).toBeCloseTo(123, 5);
    expect(tp.height).toBeCloseTo(47, 5);
  });

  it('back-solve produces positive width/height when dragged corner crosses fixed corner', () => {
    // anchor=(min,min) → fixed=TL=(0,0), dragged=BR.
    // Snap target at (-30,-20) (past TL in both axes).
    // Back-solve: pin=(0,0), target=(-30,-20).
    // Diagonal D=(-30,-20). projection onto (1,0)=-30, (0,1)=-20.
    // newWidth=30, newHeight=20; center=(-15,-10); x=-30, y=-20.
    const { adapter } = makeAdapter();

    const behavior: PointSnapBehavior<P> = {
      onMove(ctx): PointSnapResult | null {
        if (!ctx.draggedCorner) return null;
        return { frame: 'dragged-corner', worldX: -30, worldY: -20 };
      },
    };

    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, { pointSnapBehaviors: [behavior] }),
    );

    act(() => { result.current.start('a', { x: 'min', y: 'min' }, 100, 60); });
    act(() => { result.current.move(-30, -20, MODS); });

    const tp = result.current.overlay!.targetPose;
    expect(tp.width).toBeCloseTo(30, 5);
    expect(tp.height).toBeCloseTo(20, 5);
    // x and y should be the smaller corner.
    expect(tp.x).toBeCloseTo(-30, 5);
    expect(tp.y).toBeCloseTo(-20, 5);
  });
});
