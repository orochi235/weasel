import { describe, it, expect, vi } from 'vitest';
import {
  alignLeftAction,
  alignRightAction,
  alignTopAction,
  alignBottomAction,
  alignCenterXAction,
  alignCenterYAction,
} from './align';
import { asNodeId } from 'core/scene/types';
import { createPoseOverrides } from 'core/scene/poseOverrides';
import type { NodeId } from 'core/scene/types';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { ImmediateInvoker } from '@weasel-js/routing';

interface Pose { x: number; y: number; width: number; height: number; rotation?: number }

function makeScene(poses: Record<string, Pose>) {
  const current = { ...poses };
  const setPose = vi.fn((id: string, pose: Pose) => { current[id] = pose; });
  const scene = {
    get: (id: string) => ({ pose: current[id], id: asNodeId(id), children: [] }),
    overrides: createPoseOverrides<Pose>(() => undefined),
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

  it('has no defaultBinding', () => {
    expect(alignLeftAction.defaultBinding).toBeUndefined();
  });

  it('has no defaultBinding', () => {
    expect(alignLeftAction.defaultBinding).toBeUndefined();
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

  it('enabled returns SelectionRequired without deps', () => {
    expect(alignLeftAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('enabled is true once a node is selected', () => {
    const none = { selection: makeSelection([]) };
    const one = { selection: makeSelection(['a']) };
    expect(alignLeftAction.enabled!(none as never)).toBe(ActionDisabledReason.SelectionRequired);
    expect(alignLeftAction.enabled!(one as never)).toBe(true);
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
// Rotated members
// ---------------------------------------------------------------------------

describe('align with a rotated member', () => {
  // 40x10 posed at x=40 and turned a quarter turn about its own centre:
  // its ink occupies x 55..65, y -15..25 while the stored box is x 40..80, y 0..10.
  const rotated = { x: 40, y: 0, width: 40, height: 10, rotation: Math.PI / 2 };

  it('align-left lines up the rotated ink, not the stored pose box', () => {
    const { scene, setPose } = makeScene({ a: { x: 0, y: 0, width: 10, height: 10 }, r: rotated });
    const selection = makeSelection(['a', 'r']);
    runDescriptor(alignLeftAction, { selection, scene });
    // Visual union left = 0; the rotated ink starts at 55 → shift by -55.
    expect(setPose).toHaveBeenCalledOnce();
    expect(setPose.mock.calls[0][0]).toBe('r');
    expect(setPose.mock.calls[0][1]).toMatchObject({ x: -15, y: 0, rotation: Math.PI / 2 });
  });

  it('align-top takes the union top edge from the rotated ink', () => {
    const { scene, setPose } = makeScene({ a: { x: 0, y: 0, width: 10, height: 10 }, r: rotated });
    const selection = makeSelection(['a', 'r']);
    runDescriptor(alignTopAction, { selection, scene });
    // Visual union top = -15 (the rotated ink), so the unrotated square moves up.
    expect(setPose).toHaveBeenCalledOnce();
    expect(setPose.mock.calls[0][0]).toBe('a');
    expect(setPose.mock.calls[0][1]).toMatchObject({ x: 0, y: -15 });
  });
});

// ---------------------------------------------------------------------------
// Reference (`params.to`)
// ---------------------------------------------------------------------------

function runWith(
  action: typeof alignLeftAction,
  deps: Record<string, unknown>,
  params?: Record<string, unknown>,
) {
  (action.invoker as ImmediateInvoker).run(deps as Parameters<ImmediateInvoker['run']>[0], params);
}

describe('align reference', () => {
  const poses = {
    a: { x: 0, y: 0, width: 10, height: 10 },
    b: { x: 40, y: 20, width: 20, height: 20 },
  };

  it("'pointer' aligns to the click's world point when a click invoked it", () => {
    const { scene, current } = makeScene(poses);
    const selection = makeSelection(['a', 'b']);
    runWith(alignLeftAction, { selection, scene }, { to: 'pointer', worldX: 100, worldY: 5 });
    expect(current.a).toMatchObject({ x: 100, y: 0 });
    expect(current.b).toMatchObject({ x: 100, y: 20 });
  });

  it("'pointer' falls back to the pointer dep's position", () => {
    const { scene, current } = makeScene(poses);
    const selection = makeSelection(['a', 'b']);
    const pointer = { get: () => ({ worldX: 70, worldY: 50, viewId: null }) };
    runWith(alignCenterYAction, { selection, scene, pointer }, { to: 'pointer' });
    expect(current.a).toMatchObject({ y: 45 });
    expect(current.b).toMatchObject({ y: 40 });
  });

  it("'pointer' with no pointer over the canvas moves nothing", () => {
    const { scene, setPose } = makeScene(poses);
    const selection = makeSelection(['a', 'b']);
    const pointer = { get: () => null };
    runWith(alignLeftAction, { selection, scene, pointer }, { to: 'pointer' });
    expect(setPose).not.toHaveBeenCalled();
  });

  it('aligns a single selected item to a point', () => {
    const { scene, current } = makeScene(poses);
    const selection = makeSelection(['b']);
    runWith(alignRightAction, { selection, scene }, { to: { x: 200, y: 0 } });
    expect(current.b).toMatchObject({ x: 180, y: 20 });
  });

  it('aligns to a world rect', () => {
    const { scene, current } = makeScene(poses);
    const selection = makeSelection(['a', 'b']);
    runWith(alignBottomAction, { selection, scene }, { to: { x: 0, y: 0, width: 300, height: 100 } });
    expect(current.a).toMatchObject({ y: 90 });
    expect(current.b).toMatchObject({ y: 80 });
  });

  it('aligns to a key node, which stays put', () => {
    const { scene, setPose, current } = makeScene(poses);
    const selection = makeSelection(['a', 'b']);
    runWith(alignTopAction, { selection, scene }, { to: { node: 'b' } });
    expect(setPose).toHaveBeenCalledOnce();
    expect(current.a).toMatchObject({ y: 20 });
  });

  it("'union' is the default, and needs two items", () => {
    const { scene, setPose } = makeScene(poses);
    runWith(alignLeftAction, { selection: makeSelection(['b']), scene }, { to: 'union' });
    expect(setPose).not.toHaveBeenCalled();
  });

});
