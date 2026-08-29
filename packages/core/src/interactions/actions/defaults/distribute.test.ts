import { describe, it, expect, vi } from 'vitest';
import {
  distributeHorizontalAction,
  distributeVerticalAction,
} from './distribute';
import { asNodeId } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';
import { ActionDisabledReason } from '../registry';
import type { ImmediateInvoker } from '../invoker';

interface Pose { x: number; y: number; width: number; height: number; rotation?: number }

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

  it('has no defaultBinding', () => {
    expect(distributeHorizontalAction.defaultBinding).toBeUndefined();
  });

  it('has no defaultBinding', () => {
    expect(distributeHorizontalAction.defaultBinding).toBeUndefined();
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

  it('enabled returns SelectionRequired without deps', () => {
    expect(distributeHorizontalAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('enabled is true once three nodes are selected', () => {
    const two = { selection: makeSelection(['a', 'b']) };
    const three = { selection: makeSelection(['a', 'b', 'c']) };
    expect(distributeHorizontalAction.enabled!(two as never)).toBe(ActionDisabledReason.SelectionRequired);
    expect(distributeHorizontalAction.enabled!(three as never)).toBe(true);
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
// Rotated members
// ---------------------------------------------------------------------------

describe('distribute with a rotated member', () => {
  it('picks endpoints by visual extent, so the rotated ink anchors the span', () => {
    const poses = {
      a: { x: 0, y: 0, width: 10, height: 10 },
      // ink x 55..65 (centre 60); stored box x 40..80.
      r: { x: 40, y: 0, width: 40, height: 10, rotation: Math.PI / 2 },
      c: { x: 50, y: 0, width: 10, height: 10 },
    };
    const { scene, setPose } = makeScene(poses);
    const selection = makeSelection(['a', 'r', 'c']);
    runDescriptor(distributeHorizontalAction, { selection, scene });
    // Visual order is a(0..10), c(50..60), r(55..65): a and r are the endpoints,
    // so c is the middle item. Centres 5 → 60 put it at 32.5 → x = 27.5.
    expect(setPose).toHaveBeenCalledOnce();
    expect(setPose.mock.calls[0][0]).toBe('c');
    expect(setPose.mock.calls[0][1]).toMatchObject({ x: 27.5, y: 0 });
  });
});
