import { describe, it, expect, vi } from 'vitest';
import {
  defaultAlignActions,
  alignLeftAction,
  alignRightAction,
  alignTopAction,
  alignBottomAction,
  alignCenterXAction,
  alignCenterYAction,
} from './align';
import { RECT_POSE_DESCRIPTOR } from '../resize/geometry';
import type { Op } from 'core/ops/types';
import { asNodeId } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';
import { ActionDisabledReason } from '../registry';
import type { ImmediateInvoker } from '../invoker';

interface Pose { x: number; y: number; width: number; height: number }

function applyOp(op: Op): { id?: string; pose?: Pose } {
  const captured: { id?: string; pose?: Pose } = {};
  op.apply({ setPose(id: string, pose: Pose) { captured.id = id; captured.pose = pose; } });
  return captured;
}

function makeDeps(poses: Record<string, Pose>) {
  return {
    getSelection: () => Object.keys(poses).map((k) => asNodeId(k)),
    getPose: (id: string): Pose => poses[id],
    geometry: RECT_POSE_DESCRIPTOR as unknown as import('../resize/geometry').PoseProjection<Pose>,
    applyOps: vi.fn(),
  };
}

function makeScene(poses: Record<string, Pose>) {
  const current = { ...poses };
  const setPose = vi.fn((id: string, pose: Pose) => { current[id] = pose; });
  const scene = {
    get: (id: string) => ({ pose: current[id], id: asNodeId(id), children: [] }),
    setPose,
    batch: vi.fn((_label: string, fn: () => void) => fn()),
    nodes: new Map(), roots: [], layers: [],
    childrenOf: vi.fn().mockReturnValue([]), ancestorsOf: vi.fn().mockReturnValue([]),
    renderOrder: vi.fn().mockReturnValue([]),
    add: vi.fn(), remove: vi.fn(), update: vi.fn(), setLayer: vi.fn(),
    move: vi.fn(), reorder: vi.fn(), setLayerVisible: vi.fn(), setLayerLocked: vi.fn(),
    registerOp: vi.fn(), recordOp: vi.fn(),
    undo: vi.fn(), redo: vi.fn(), canUndo: vi.fn(), canRedo: vi.fn(),
    toJSON: vi.fn(), subscribe: vi.fn(), subscribeNode: vi.fn(),
  };
  return { scene, setPose, current };
}

function makeSelection(ids: string[]) {
  return {
    get: () => ids.map((id) => asNodeId(id)),
    current: [] as readonly NodeId[],
    set: vi.fn(), add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), clear: vi.fn(),
    contains: vi.fn().mockReturnValue(false),
  };
}

function runDescriptor(
  action: typeof alignLeftAction,
  deps: { selection: ReturnType<typeof makeSelection>; scene: ReturnType<typeof makeScene>['scene'] },
) {
  (action.invoker as ImmediateInvoker).run(deps as Parameters<ImmediateInvoker['run']>[0]);
}

// ---------------------------------------------------------------------------
// Static descriptor tests
// ---------------------------------------------------------------------------

describe('alignLeftAction descriptor', () => {
  it('has id "align.left"', () => {
    expect(alignLeftAction.id).toBe('align.left');
  });

  it('has no gestureBinding', () => {
    expect(alignLeftAction.gestureBinding).toBeUndefined();
  });

  it('has no gestureBinding', () => {
    expect(alignLeftAction.gestureBinding).toBeUndefined();
  });

  it('has an icon', () => {
    expect(alignLeftAction.icon).toBeDefined();
  });

  it('belongs to group "align"', () => {
    expect(alignLeftAction.group).toBe('align');
  });

  it('has timing "immediate"', () => {
    expect(alignLeftAction.invoker?.timing).toBe('immediate');
  });

  it('invoker.run aligns items to union left via scene.setPose', () => {
    const poses = {
      a: { x: 5, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 50, width: 10, height: 10 },
    };
    const { scene, setPose } = makeScene(poses);
    const selection = makeSelection(['a', 'b']);
    runDescriptor(alignLeftAction, { selection, scene });
    expect(scene.batch).toHaveBeenCalledOnce();
    // only b moves (a is already at union.left=5)
    expect(setPose).toHaveBeenCalledOnce();
    expect(setPose.mock.calls[0][1]).toMatchObject({ x: 5, y: 50 });
  });

  it('invoker.run no-ops when <2 selected', () => {
    const poses = { a: { x: 0, y: 0, width: 10, height: 10 } };
    const { scene, setPose } = makeScene(poses);
    const selection = makeSelection(['a']);
    runDescriptor(alignLeftAction, { selection, scene });
    expect(setPose).not.toHaveBeenCalled();
  });

  it('invoker.run no-ops when selection or scene is missing', () => {
    expect(() => {
      (alignLeftAction.invoker as ImmediateInvoker).run({});
    }).not.toThrow();
  });

  it('enabled returns SelectionRequired', () => {
    expect(alignLeftAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });
});

describe('alignRightAction descriptor', () => {
  it('has id "align.right"', () => {
    expect(alignRightAction.id).toBe('align.right');
  });

  it('invoker.run aligns items to union right via scene.setPose', () => {
    const poses = {
      a: { x: 5, y: 0, width: 10, height: 10 },  // right edge = 15
      b: { x: 20, y: 0, width: 10, height: 10 },  // right edge = 30 (union right)
    };
    const { scene, setPose } = makeScene(poses);
    const selection = makeSelection(['a', 'b']);
    runDescriptor(alignRightAction, { selection, scene });
    // a moves right so its right edge = 30 → x = 20
    expect(setPose).toHaveBeenCalledOnce();
    expect(setPose.mock.calls[0][1]).toMatchObject({ x: 20 });
  });
});

describe('alignTopAction descriptor', () => {
  it('has id "align.top"', () => {
    expect(alignTopAction.id).toBe('align.top');
  });

  it('invoker.run aligns items to union top', () => {
    const poses = {
      a: { x: 0, y: 5, width: 10, height: 10 },   // top = 5 (union top)
      b: { x: 0, y: 20, width: 10, height: 10 },   // top = 20
    };
    const { scene, setPose } = makeScene(poses);
    const selection = makeSelection(['a', 'b']);
    runDescriptor(alignTopAction, { selection, scene });
    expect(setPose).toHaveBeenCalledOnce();
    expect(setPose.mock.calls[0][1]).toMatchObject({ y: 5 });
  });
});

describe('alignBottomAction descriptor', () => {
  it('has id "align.bottom"', () => {
    expect(alignBottomAction.id).toBe('align.bottom');
  });

  it('invoker.run aligns items to union bottom', () => {
    const poses = {
      a: { x: 0, y: 0, width: 10, height: 10 },   // bottom = 10
      b: { x: 0, y: 20, width: 10, height: 10 },   // bottom = 30 (union bottom)
    };
    const { scene, setPose } = makeScene(poses);
    const selection = makeSelection(['a', 'b']);
    runDescriptor(alignBottomAction, { selection, scene });
    // a moves so bottom = 30 → y = 20
    expect(setPose).toHaveBeenCalledOnce();
    expect(setPose.mock.calls[0][1]).toMatchObject({ y: 20 });
  });
});

describe('alignCenterXAction descriptor', () => {
  it('has id "align.centerX"', () => {
    expect(alignCenterXAction.id).toBe('align.centerX');
  });

  it('invoker.run aligns centers horizontally', () => {
    const poses = {
      a: { x: 0, y: 0, width: 10, height: 10 },   // center = 5
      b: { x: 30, y: 0, width: 10, height: 10 },  // center = 35
    };
    const { scene, setPose } = makeScene(poses);
    const selection = makeSelection(['a', 'b']);
    runDescriptor(alignCenterXAction, { selection, scene });
    // union center-x = (0+40)/2 = 20; a → x=15, b → x=15
    expect(setPose).toHaveBeenCalledTimes(2);
    for (const call of setPose.mock.calls) {
      expect(call[1]).toMatchObject({ x: 15 });
    }
  });
});

describe('alignCenterYAction descriptor', () => {
  it('has id "align.centerY"', () => {
    expect(alignCenterYAction.id).toBe('align.centerY');
  });

  it('invoker.run aligns centers vertically', () => {
    const poses = {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 0, y: 30, width: 10, height: 10 },
    };
    const { scene, setPose } = makeScene(poses);
    const selection = makeSelection(['a', 'b']);
    runDescriptor(alignCenterYAction, { selection, scene });
    // union center-y = (0+40)/2 = 20; both → y=15
    expect(setPose).toHaveBeenCalledTimes(2);
    for (const call of setPose.mock.calls) {
      expect(call[1]).toMatchObject({ y: 15 });
    }
  });
});

// ---------------------------------------------------------------------------
// Legacy factory tests (bridge still produces original Action shapes)
// ---------------------------------------------------------------------------

describe('defaultAlignActions', () => {
  it('returns 6 actions with documented ids', () => {
    const acts = defaultAlignActions(makeDeps({ a: { x: 0, y: 0, width: 10, height: 10 } }));
    expect(acts.map((a) => a.id).sort()).toEqual([
      'align.bottom', 'align.centerX', 'align.centerY', 'align.left', 'align.right', 'align.top',
    ]);
  });

  it('no default keybindings (consumer overrides)', () => {
    const acts = defaultAlignActions(makeDeps({ a: { x: 0, y: 0, width: 10, height: 10 } }));
    for (const a of acts) expect(a.gestureBinding).toBeUndefined();
  });

  it('every action ships a default icon', () => {
    const acts = defaultAlignActions(makeDeps({ a: { x: 0, y: 0, width: 10, height: 10 } }));
    for (const a of acts) expect(a.icon).toBeDefined();
  });

  it('align.left translates each item to the union left', () => {
    const deps = makeDeps({
      a: { x: 5, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 50, width: 10, height: 10 },
    });
    defaultAlignActions(deps).find((a) => a.id === 'align.left')!.run!();
    expect(deps.applyOps).toHaveBeenCalledOnce();
    const [ops, label] = deps.applyOps.mock.calls[0];
    expect(label).toBe('Align');
    expect(ops).toHaveLength(1); // only `b` moves; `a` already at union.left
    expect(applyOp(ops[0]).pose).toMatchObject({ x: 5, y: 50 });
  });

  it('run() is a no-op on <2 selection', () => {
    const deps = makeDeps({ a: { x: 0, y: 0, width: 10, height: 10 } });
    defaultAlignActions(deps).find((a) => a.id === 'align.left')!.run!();
    expect(deps.applyOps).not.toHaveBeenCalled();
  });

  it('enabled: SelectionRequired when <2, true when ≥2', () => {
    const one = makeDeps({ a: { x: 0, y: 0, width: 10, height: 10 } });
    expect(defaultAlignActions(one)[0].enabled!()).toBe('selection-required');
    const two = makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 5, y: 0, width: 10, height: 10 },
    });
    expect(defaultAlignActions(two)[0].enabled!()).toBe(true);
  });
});
