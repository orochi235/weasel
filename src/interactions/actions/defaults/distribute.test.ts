import { describe, it, expect, vi } from 'vitest';
import {
  defaultDistributeActions,
  distributeHorizontalAction,
  distributeVerticalAction,
} from './distribute';
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

function makeDeps(poses: Record<string, Pose>, mode?: 'centers' | 'gaps') {
  return {
    getSelection: () => Object.keys(poses).map((k) => asNodeId(k)),
    getPose: (id: string): Pose => poses[id],
    geometry: RECT_POSE_DESCRIPTOR as unknown as import('../resize/geometry').PoseProjection<Pose>,
    applyOps: vi.fn(),
    mode,
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
  action: typeof distributeHorizontalAction,
  deps: { selection: ReturnType<typeof makeSelection>; scene: ReturnType<typeof makeScene>['scene'] },
) {
  (action.invoker as ImmediateInvoker).run(deps as Parameters<ImmediateInvoker['run']>[0]);
}

// ---------------------------------------------------------------------------
// Static descriptor tests
// ---------------------------------------------------------------------------

describe('distributeHorizontalAction descriptor', () => {
  it('has id "distribute.horizontal"', () => {
    expect(distributeHorizontalAction.id).toBe('distribute.horizontal');
  });

  it('has no gestureBinding', () => {
    expect(distributeHorizontalAction.gestureBinding).toBeUndefined();
  });

  it('has no gestureBinding', () => {
    expect(distributeHorizontalAction.gestureBinding).toBeUndefined();
  });

  it('has an icon', () => {
    expect(distributeHorizontalAction.icon).toBeDefined();
  });

  it('belongs to group "distribute"', () => {
    expect(distributeHorizontalAction.group).toBe('distribute');
  });

  it('has timing "immediate"', () => {
    expect(distributeHorizontalAction.invoker?.timing).toBe('immediate');
  });

  it('invoker.run distributes 3 items horizontally (centers mode) via scene.setPose', () => {
    const poses = {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 30, y: 0, width: 10, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    };
    const { scene, setPose } = makeScene(poses);
    const selection = makeSelection(['a', 'b', 'c']);
    runDescriptor(distributeHorizontalAction, { selection, scene });
    expect(scene.batch).toHaveBeenCalledOnce();
    // centers: a center=5, c center=105 → b center should land at 55, so x=50
    // a and c are anchors; only b moves
    expect(setPose).toHaveBeenCalledOnce();
    expect(setPose.mock.calls[0][1]).toMatchObject({ x: 50, y: 0 });
  });

  it('invoker.run no-ops when <3 selected', () => {
    const poses = {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 0, width: 10, height: 10 },
    };
    const { scene, setPose } = makeScene(poses);
    const selection = makeSelection(['a', 'b']);
    runDescriptor(distributeHorizontalAction, { selection, scene });
    expect(setPose).not.toHaveBeenCalled();
  });

  it('invoker.run no-ops when selection or scene is missing', () => {
    expect(() => {
      (distributeHorizontalAction.invoker as ImmediateInvoker).run({});
    }).not.toThrow();
  });

  it('enabled returns SelectionRequired', () => {
    expect(distributeHorizontalAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });
});

describe('distributeVerticalAction descriptor', () => {
  it('has id "distribute.vertical"', () => {
    expect(distributeVerticalAction.id).toBe('distribute.vertical');
  });

  it('invoker.run distributes 3 items vertically (centers mode) via scene.setPose', () => {
    const poses = {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 0, y: 30, width: 10, height: 10 },
      c: { x: 0, y: 100, width: 10, height: 10 },
    };
    const { scene, setPose } = makeScene(poses);
    const selection = makeSelection(['a', 'b', 'c']);
    runDescriptor(distributeVerticalAction, { selection, scene });
    // centers: a center=5, c center=105 → b center at 55, y=50
    expect(setPose).toHaveBeenCalledOnce();
    expect(setPose.mock.calls[0][1]).toMatchObject({ x: 0, y: 50 });
  });
});

// ---------------------------------------------------------------------------
// Legacy factory tests (bridge still produces original Action shapes)
// ---------------------------------------------------------------------------

describe('defaultDistributeActions', () => {
  it('returns 2 actions with documented ids', () => {
    const acts = defaultDistributeActions(makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 0, width: 10, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    }));
    expect(acts.map((a) => a.id).sort()).toEqual(['distribute.horizontal', 'distribute.vertical']);
  });

  it('no default keybindings', () => {
    const acts = defaultDistributeActions(makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 0, width: 10, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    }));
    for (const a of acts) expect(a.gestureBinding).toBeUndefined();
  });

  it('every action ships a default icon', () => {
    const acts = defaultDistributeActions(makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 0, width: 10, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    }));
    for (const a of acts) expect(a.icon).toBeDefined();
  });

  it('distribute.horizontal centers mode evenly spaces middle items', () => {
    const deps = makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 30, y: 0, width: 10, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    });
    defaultDistributeActions(deps).find((a) => a.id === 'distribute.horizontal')!.run!();
    expect(deps.applyOps).toHaveBeenCalledOnce();
    const [ops, label] = deps.applyOps.mock.calls[0];
    expect(label).toBe('Distribute');
    expect(ops).toHaveLength(1); // only b moves
    // centers: a center=5, c center=105 → b center should land at 55, so x=50
    expect(applyOp(ops[0]).pose).toMatchObject({ x: 50, y: 0 });
  });

  it('mode override via deps.mode', () => {
    const deps = makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 0, width: 30, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    }, 'gaps');
    defaultDistributeActions(deps).find((a) => a.id === 'distribute.horizontal')!.run!();
    const [ops] = deps.applyOps.mock.calls[0];
    // span = 110-0 = 110, sumSizes = 10+30+10 = 50, gap = (110-50)/2 = 30
    // a stays at 0; b should land at 0 + 10 + 30 = 40
    expect(applyOp(ops[0]).pose).toMatchObject({ x: 40, y: 0 });
  });

  it('run() is a no-op on <3 selection', () => {
    const deps = makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 0, width: 10, height: 10 },
    });
    defaultDistributeActions(deps).find((a) => a.id === 'distribute.horizontal')!.run!();
    expect(deps.applyOps).not.toHaveBeenCalled();
  });

  it('enabled: SelectionRequired when <3, true when ≥3', () => {
    const two = makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 0, width: 10, height: 10 },
    });
    expect(defaultDistributeActions(two)[0].enabled!()).toBe('selection-required');
    const three = makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 0, width: 10, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    });
    expect(defaultDistributeActions(three)[0].enabled!()).toBe(true);
  });
});
