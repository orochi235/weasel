/**
 * `ActionBehavior.onSettled`: once per gesture, after the commit has landed
 * or the cancel has run, from every action that runs behaviors.
 */
import { describe, it, expect, vi } from 'vitest';
import type { BindingOpts, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { createSetSelectionOp } from 'core/ops/select';
import { createTransformOp } from 'core/ops/transform';
import type { NodeId } from 'core/scene/types';
import { moveAction } from './move/action';
import { resizeAction } from './resize/action';
import { rotateAction } from './rotate/action';
import { insertAction } from './insert/action';
import { lassoSelectAction } from './lasso-select/action';
import type { InsertDep, LassoSelectDep } from './depSchema';
import { runBehaviorSettled } from './gestureLifecycle';

type Pose = { x: number; y: number; width: number; height: number; rotation?: number };
type Reason = 'commit' | 'cancel';

const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const REFUSE = { applyOps: () => { throw new Error('refused'); } };

function start(action: { invoker?: unknown }, ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
  const inv = action.invoker as { timing: string; start(c: InvocationCtx, o?: BindingOpts): OngoingHandle };
  if (inv.timing !== 'ongoing') throw new Error('expected ongoing');
  return inv.start(ctx, opts);
}

function sceneWithLeaf() {
  const scene = createScene<{ kind: string }, 'main', Pose>({
    systemLayers: [{ id: 'main', visible: true, locked: false }],
  });
  const a = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: { kind: 'rect' } });
  return { scene, a };
}

/** The `committed` each call of a spied `onSettled` was given. */
const verdicts = (onSettled: ReturnType<typeof vi.fn>): unknown[] => onSettled.mock.calls.map((c) => c[1]);

describe('runBehaviorSettled', () => {
  it('tells every behavior with the hook whether the gesture committed', () => {
    const first = { onSettled: vi.fn() };
    const second = { onSettled: vi.fn() };
    runBehaviorSettled([first, {}, second], 'ctx', true);
    expect(first.onSettled).toHaveBeenCalledWith('ctx', true);
    expect(second.onSettled).toHaveBeenCalledWith('ctx', true);
  });
});

describe('moveAction — onSettled', () => {
  function setup(extraDeps: Record<string, unknown> = {}) {
    const { scene, a } = sceneWithLeaf();
    const base = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: MODS,
      deps: { selection: { get: () => [a] as NodeId[] }, scene, ...extraDeps },
    };
    const at = (dx: number): InvocationCtx => ({
      ...base,
      drag: { start: { x: 0, y: 0 }, current: { x: dx, y: 0 }, delta: { x: dx, y: 0 }, screenDelta: { x: dx, y: 0 } },
    }) as unknown as InvocationCtx;
    /** `dx` null ends the gesture with no move at all. */
    const drag = (opts: BindingOpts, dx: number | null, reason: Reason = 'commit'): void => {
      const handle = start(moveAction, base as unknown as InvocationCtx, opts);
      if (dx !== null) handle.onMove?.(at(dx));
      handle.onEnd?.(at(dx ?? 0), reason);
    };
    return { scene, a, drag };
  }

  it('runs once on commit, after the ops land and the preview overrides drop, before onGestureEnd', () => {
    const { scene, a, drag } = setup();
    const log: string[] = [];
    const onSettled = vi.fn((_ctx: unknown, committed: boolean) => {
      log.push(`settled:${committed}:${scene.get(a)!.pose.x}:${scene.overrides.get(a) === undefined}`);
    });
    drag({ behaviors: [{ onSettled }] as never, params: { onGestureEnd: () => log.push('gestureEnd') } }, 5);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(log).toEqual(['settled:true:5:true', 'gestureEnd']);
  });

  it('hands the hook the gesture context the other hooks saw', () => {
    const { drag } = setup();
    const seen: unknown[] = [];
    const behavior = {
      onStart: (ctx: unknown) => { seen.push(ctx); },
      onSettled: (ctx: unknown) => { seen.push(ctx); },
    };
    drag({ behaviors: [behavior] as never }, 5);
    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0]);
  });

  it('reports false when a behavior aborts the commit', () => {
    const { drag } = setup();
    const onSettled = vi.fn();
    drag({ behaviors: [{ onEnd: () => null, onSettled }] as never }, 5);
    expect(verdicts(onSettled)).toEqual([false]);
  });

  /** A behavior logging which of its closing hooks ran. */
  const closing = (log: string[]) => ({
    onEnd: () => { log.push('end'); },
    onCancel: () => { log.push('cancel'); },
    onSettled: (_ctx: unknown, committed: boolean) => { log.push(`settled:${committed}`); },
  });

  it('reports false on a release with nothing to write, which asked the behaviors to commit', () => {
    const { drag } = setup();
    const log: string[] = [];
    drag({ behaviors: [closing(log)] as never }, 0);
    expect(log).toEqual(['end', 'settled:false']);
  });

  it('reports false on a gesture that ended before it moved, which canceled them', () => {
    const { drag } = setup();
    const log: string[] = [];
    drag({ behaviors: [closing(log)] as never }, null);
    expect(log).toEqual(['cancel', 'settled:false']);
  });

  it('reports true when a behavior claims the commit with no ops', () => {
    const { scene, a, drag } = setup();
    const onSettled = vi.fn();
    drag({ behaviors: [{ onEnd: () => [], onSettled }] as never }, 5);
    expect(verdicts(onSettled)).toEqual([true]);
    expect(scene.get(a)!.pose.x).toBe(0);
  });

  it('reports false on cancel, after onCancel', () => {
    const { drag } = setup();
    const log: string[] = [];
    const behavior = {
      onCancel: () => { log.push('cancel'); },
      onSettled: (_ctx: unknown, committed: boolean) => { log.push(`settled:${committed}`); },
    };
    drag({ behaviors: [behavior] as never }, 5, 'cancel');
    expect(log).toEqual(['cancel', 'settled:false']);
  });

  it('still runs, reporting false, when the commit throws', () => {
    const { drag } = setup(REFUSE);
    const onSettled = vi.fn();
    expect(() => drag({ behaviors: [{ onSettled }] as never }, 5)).toThrow('refused');
    expect(verdicts(onSettled)).toEqual([false]);
  });
});

describe('resizeAction — onSettled', () => {
  function setup() {
    const { scene, a } = sceneWithLeaf();
    const resize = (constraint: object, reason: Reason = 'commit', more: { deps?: object; policy?: object } = {}): void => {
      const base = {
        world: { x: 100, y: 100 },
        screen: { x: 0, y: 0 },
        modifiers: MODS,
        deps: {
          selection: { get: () => [a] as NodeId[] },
          scene,
          resizePolicy: { constraints: [constraint], expandIds: (ids: string[]) => ids, ...more.policy },
          ...more.deps,
        },
        drag: {
          start: { x: 100, y: 100 },
          current: { x: 100, y: 100 },
          delta: { x: 0, y: 0 },
          affordance: { kind: 'handle:bottom-right', anchor: { x: 'min', y: 'min' } },
        },
      } as unknown as InvocationCtx;
      const grown = { ...base, drag: { ...base.drag!, current: { x: 150, y: 150 }, delta: { x: 50, y: 50 } } } as InvocationCtx;
      const handle = start(resizeAction, base);
      handle.onMove?.(grown);
      handle.onEnd?.(grown, reason);
    };
    return { scene, a, resize };
  }

  it('runs once on commit, after the ops land and the preview overrides drop, before onGestureEnd', () => {
    const { scene, a, resize } = setup();
    const log: string[] = [];
    const onSettled = vi.fn((_ctx: unknown, committed: boolean) => {
      log.push(`settled:${committed}:${scene.get(a)!.pose.width}:${scene.overrides.get(a) === undefined}`);
    });
    resize({ onSettled }, 'commit', { policy: { onGestureEnd: () => log.push('gestureEnd') } });
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(log).toEqual(['settled:true:150:true', 'gestureEnd']);
  });

  it('reports false on abort and on cancel', () => {
    const aborted = vi.fn();
    setup().resize({ onEnd: () => null, onSettled: aborted });
    expect(verdicts(aborted)).toEqual([false]);
    const canceled = vi.fn();
    setup().resize({ onSettled: canceled }, 'cancel');
    expect(verdicts(canceled)).toEqual([false]);
  });

  it('still runs, reporting false, when the commit throws', () => {
    const onSettled = vi.fn();
    expect(() => setup().resize({ onSettled }, 'commit', { deps: REFUSE })).toThrow('refused');
    expect(verdicts(onSettled)).toEqual([false]);
  });
});

describe('rotateAction — onSettled', () => {
  function setup() {
    const { scene, a } = sceneWithLeaf();
    const turn = (opts: BindingOpts, reason: Reason = 'commit', deps: object = {}): void => {
      // The pointer starts due east of the leaf's center and goes a quarter turn round.
      const base = { world: { x: 60, y: 50 }, screen: { x: 0, y: 0 }, modifiers: MODS, deps: { selection: { get: () => [a] as NodeId[] }, scene, ...deps } };
      const quarter = { ...base, world: { x: 50, y: 60 } } as unknown as InvocationCtx;
      const handle = start(rotateAction, base as unknown as InvocationCtx, opts);
      handle.onMove?.(quarter);
      handle.onEnd?.(quarter, reason);
    };
    return { scene, a, turn };
  }

  it('runs once on commit, after the ops land and the preview overrides drop, before onGestureEnd', () => {
    const { scene, a, turn } = setup();
    const log: string[] = [];
    const onSettled = vi.fn((_ctx: unknown, committed: boolean) => {
      const turned = Math.abs((scene.get(a)!.pose.rotation ?? 0) - Math.PI / 2) < 1e-9;
      log.push(`settled:${committed}:${turned}:${scene.overrides.get(a) === undefined}`);
    });
    turn({ behaviors: [{ onSettled }], params: { onGestureEnd: () => log.push('gestureEnd') } });
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(log).toEqual(['settled:true:true:true', 'gestureEnd']);
  });

  it('reports false on abort and on cancel', () => {
    const aborted = vi.fn();
    setup().turn({ behaviors: [{ onEnd: () => null, onSettled: aborted }] });
    expect(verdicts(aborted)).toEqual([false]);
    const canceled = vi.fn();
    setup().turn({ behaviors: [{ onSettled: canceled }] }, 'cancel');
    expect(verdicts(canceled)).toEqual([false]);
  });

  it('still runs, reporting false, when the commit throws', () => {
    const onSettled = vi.fn();
    expect(() => setup().turn({ behaviors: [{ onSettled }] }, 'commit', REFUSE)).toThrow('refused');
    expect(verdicts(onSettled)).toEqual([false]);
  });
});

describe('insertAction — onSettled', () => {
  const at = (x: number, y: number, deps: object): InvocationCtx =>
    ({ world: { x, y }, screen: { x, y }, modifiers: MODS, deps }) as unknown as InvocationCtx;

  /** Draw a rect from the origin to `to`. */
  function draw(behavior: object, commit: InsertDep['commit'], reason: Reason = 'commit', to = 40, deps: object = {}): void {
    const all = { insert: { commit } satisfies InsertDep, ...deps };
    const handle = start(insertAction, at(0, 0, all), { params: { kind: 'rect' }, behaviors: [behavior] });
    handle.onMove?.(at(to, to, all));
    handle.onEnd?.(at(to, to, all), reason);
  }
  const minted = (): NodeId => 'new' as NodeId;

  it('runs once, after the node is committed, and reports true', () => {
    const log: string[] = [];
    const onSettled = vi.fn((_ctx: unknown, committed: boolean) => { log.push(`settled:${committed}`); });
    draw({ onSettled }, () => { log.push('commit'); return minted(); });
    expect(log).toEqual(['commit', 'settled:true']);
  });

  it('reports true once a behavior\'s ops are in the document', () => {
    const { scene, a } = sceneWithLeaf();
    const from = scene.get(a)!.pose;
    const log: string[] = [];
    const behavior = {
      onEnd: () => [createTransformOp<Pose>({ id: a, from, to: { ...from, x: 7 }, label: 'Place' })],
      onSettled: (_ctx: unknown, committed: boolean) => { log.push(`settled:${committed}:${scene.get(a)!.pose.x}`); },
    };
    draw(behavior, minted, 'commit', 40, { scene });
    expect(log).toEqual(['settled:true:7']);
  });

  it('reports false when nothing was inserted', () => {
    const refused = vi.fn();
    draw({ onSettled: refused }, () => null);
    expect(verdicts(refused)).toEqual([false]);
    const tooSmall = vi.fn();
    draw({ onSettled: tooSmall }, minted, 'commit', 0);
    expect(verdicts(tooSmall)).toEqual([false]);
    const aborted = vi.fn();
    draw({ onEnd: () => null, onSettled: aborted }, minted);
    expect(verdicts(aborted)).toEqual([false]);
  });

  it('reports false on cancel, after onCancel', () => {
    const log: string[] = [];
    const behavior = {
      onCancel: () => { log.push('cancel'); },
      onSettled: (_ctx: unknown, committed: boolean) => { log.push(`settled:${committed}`); },
    };
    draw(behavior, minted, 'cancel');
    expect(log).toEqual(['cancel', 'settled:false']);
  });

  it('still runs, reporting false, when the commit throws', () => {
    const onSettled = vi.fn();
    expect(() => draw({ onSettled }, () => { throw new Error('refused'); })).toThrow('refused');
    expect(verdicts(onSettled)).toEqual([false]);
  });
});

describe('lassoSelectAction — onSettled', () => {
  function setup() {
    const selected: string[][] = [];
    const dep: LassoSelectDep = {
      hitTestArea: () => ['hit'],
      hitTestLasso: () => ['hit'],
      getSelection: () => [],
      setSelection: (ids) => { selected.push([...ids]); },
    };
    const at = (x: number, y: number, shift = false): InvocationCtx =>
      ({ world: { x, y }, screen: { x, y }, modifiers: { ...MODS, shift }, deps: { lassoSelect: dep } }) as unknown as InvocationCtx;
    /** Lasso through `points` from the origin. */
    const lasso = (behavior: object, points: Array<[number, number]>, reason: Reason = 'commit', shift = false): void => {
      const handle = start(lassoSelectAction, at(0, 0, shift), { behaviors: [behavior] });
      for (const [x, y] of points) handle.onMove?.(at(x, y, shift));
      handle.onEnd?.(at(0, 0, shift), reason);
    };
    return { selected, lasso };
  }
  const TRIANGLE: Array<[number, number]> = [[10, 0], [10, 10]];
  const TOO_SHORT: Array<[number, number]> = [[10, 0]];

  it('runs once, after the selection is set, and reports true', () => {
    const { selected, lasso } = setup();
    const log: string[] = [];
    const onSettled = vi.fn((_ctx: unknown, committed: boolean) => { log.push(`settled:${committed}:${JSON.stringify(selected)}`); });
    lasso({ onSettled }, TRIANGLE);
    expect(log).toEqual(['settled:true:[["hit"]]']);
  });

  it('reports true once a behavior\'s ops are applied', () => {
    const { selected, lasso } = setup();
    const log: string[] = [];
    const behavior = {
      onEnd: () => [createSetSelectionOp({ from: [], to: ['picked' as NodeId] })],
      onSettled: (_ctx: unknown, committed: boolean) => { log.push(`settled:${committed}:${JSON.stringify(selected)}`); },
    };
    lasso(behavior, TRIANGLE);
    expect(log).toEqual(['settled:true:[["picked"]]']);
  });

  it('reports true when a lasso too short to enclose anything clears the selection', () => {
    const { selected, lasso } = setup();
    const onSettled = vi.fn();
    lasso({ onSettled }, TOO_SHORT);
    expect(selected).toEqual([[]]);
    expect(verdicts(onSettled)).toEqual([true]);
  });

  it('reports false when a too-short lasso with shift held leaves the selection alone', () => {
    const { selected, lasso } = setup();
    const onSettled = vi.fn();
    lasso({ onSettled }, TOO_SHORT, 'commit', true);
    expect(selected).toEqual([]);
    expect(verdicts(onSettled)).toEqual([false]);
  });

  it('reports false when a behavior aborts', () => {
    const aborted = vi.fn();
    setup().lasso({ onEnd: () => null, onSettled: aborted }, TRIANGLE);
    expect(verdicts(aborted)).toEqual([false]);
  });

  it('reports false on cancel, after onCancel', () => {
    const log: string[] = [];
    const behavior = {
      onCancel: () => { log.push('cancel'); },
      onSettled: (_ctx: unknown, committed: boolean) => { log.push(`settled:${committed}`); },
    };
    setup().lasso(behavior, TRIANGLE, 'cancel');
    expect(log).toEqual(['cancel', 'settled:false']);
  });

  it('still runs, reporting false, when setting the selection throws', () => {
    const onSettled = vi.fn();
    const handle = start(lassoSelectAction, {
      world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, modifiers: MODS,
      deps: { lassoSelect: { hitTestArea: () => [], hitTestLasso: () => [], getSelection: () => [], setSelection: () => { throw new Error('refused'); } } },
    } as unknown as InvocationCtx, { behaviors: [{ onSettled }] });
    const move = (x: number, y: number) => handle.onMove?.({ world: { x, y }, screen: { x, y }, modifiers: MODS, deps: {} } as unknown as InvocationCtx);
    move(10, 0);
    move(10, 10);
    expect(() => handle.onEnd?.({ world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, modifiers: MODS, deps: {} } as unknown as InvocationCtx, 'commit')).toThrow('refused');
    expect(verdicts(onSettled)).toEqual([false]);
  });
});
