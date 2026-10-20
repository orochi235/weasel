import { describe, expect, it } from 'vitest';
import { boundsOfPath, rectPath } from '@weasel-js/geom';
import type { ImmediateInvoker, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import {
  createScene, derivedDepOf, derivedPartsOf, effectivePose, moveAction, RIGID_POSE_COMPOSITION, type NodeId, PATH_EFFECT_DERIVATIONS, pathEffectOf, pathEffectParts, type RectPose, type Scene, sceneFromJSON, withPathEffectsRegistry,
} from '@weasel-js/core';
import { blendAction, bendAlongAction, editPathEffectAction, expandPathEffectAction, repeatAlongAction } from './actions';
import { pathEffectSettingsParams, readPathEffectSettings } from './settingsForm';

type TestScene = Scene<unknown, 'default', RectPose>;

const box = (id: string, x: number, color: string, rotation?: number) => ({
  id: id as NodeId,
  kind: 'leaf' as const,
  layer: 'default' as const,
  pose: { x, y: 0, width: 20, height: 20, ...(rotation === undefined ? {} : { rotation }) },
  data: { path: rectPath(0, 0, 20, 20), fill: { paint: { color } } },
});

const spine = {
  id: 'spine' as NodeId,
  kind: 'leaf' as const,
  layer: 'default' as const,
  pose: { x: 0, y: 100, width: 200, height: 0 },
  data: { path: { kind: 'polygon', commands: new Uint8Array([0, 1]), coords: new Float32Array([0, 0, 200, 0]), fillRule: 'nonzero' }, stroke: { paint: { color: '#000' }, width: 1 } },
};

function setup(selected: string[], registered = true) {
  const scene: TestScene = createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    ...(registered ? { registry: withPathEffectsRegistry() } : {}),
    initial: [box('a', 0, '#ff0000'), box('b', 200, '#0000ff', Math.PI / 2), spine],
  });
  let current = selected;
  const selection = { get: () => current, set: (next: string[]) => { current = next; } };
  const deps = { scene, selection } as unknown as InvocationCtx['deps'];
  return { scene, deps, selected: () => current };
}

const run = (action: { invoker?: unknown }, deps: InvocationCtx['deps'], params?: Record<string, unknown>) =>
  (action.invoker as ImmediateInvoker).run(deps, params);

function partsOf(scene: TestScene, id: string) {
  const node = scene.get(id as NodeId)!;
  const deps = (node.dependsOn as NodeId[]).map((d) => derivedDepOf(scene, d));
  return pathEffectParts(node, deps)!;
}

describe('a scene that does not register path effects', () => {
  it('refuses to make one, where it could neither paint nor save it', () => {
    const { scene, deps } = setup(['a', 'b'], false);
    expect(blendAction.enabled!(deps)).toBe('not-applicable');
    run(blendAction, deps, {});
    expect(scene.roots).toHaveLength(3);
  });
});

describe('blend', () => {
  it('adds a live node of steps between the two selected shapes, just under the upper', () => {
    const { scene, deps, selected } = setup(['a', 'b']);
    run(blendAction, deps, { steps: 3 });
    const [id] = selected();
    const node = scene.get(id as NodeId)!;
    expect(pathEffectOf(node)).toMatchObject({ kind: 'blend', steps: 3 });
    expect(scene.roots.indexOf(id as NodeId)).toBe(1);

    const parts = partsOf(scene, id!);
    expect(parts).toHaveLength(3);
    // The middle step sits halfway, turned halfway, and is violet-ish.
    const mid = boundsOfPath(parts[1]!.path);
    expect(mid.x + mid.width / 2).toBeCloseTo(110, 3);
    expect((parts[1]!.fill?.paint as { color: string }).color).not.toBe('#ff0000');

    // Moving a source moves the steps.
    scene.setPose('b' as NodeId, { x: 400, y: 0, width: 20, height: 20, rotation: Math.PI / 2 });
    const moved = boundsOfPath(partsOf(scene, id!)[1]!.path);
    expect(moved.x + moved.width / 2).toBeCloseTo(210, 3);
    // Its pose is the bounds of what it paints: steps centered 110 to 310.
    const pose = effectivePose(scene, node);
    expect(pose.x).toBeLessThan(110);
    expect(pose.x + pose.width).toBeGreaterThan(310);
  });

  it('paints each step in its own color', () => {
    const { scene, deps, selected } = setup(['a', 'b']);
    run(blendAction, deps, { steps: 2 });
    const node = scene.get(selected()[0] as NodeId)!;
    const path = PATH_EFFECT_DERIVATIONS.derivePath(node, (node.dependsOn as NodeId[]).map((d) => derivedDepOf(scene, d)));
    expect(derivedPartsOf(path)).toHaveLength(2);
  });

  it('survives a save and load', () => {
    const { scene, deps, selected } = setup(['a', 'b']);
    run(blendAction, deps, { steps: 2 });
    const loaded = sceneFromJSON<unknown, 'default', RectPose>(scene.toJSON(), { registry: withPathEffectsRegistry() });
    const node = loaded.get(selected()[0] as NodeId)!;
    expect(node.derivePath).toBe(PATH_EFFECT_DERIVATIONS.derivePath);
    expect(partsOf(loaded as TestScene, node.id)).toHaveLength(2);
  });

  it('changes its settings in one undoable edit, and commits nothing for no change', () => {
    const { scene, deps, selected } = setup(['a', 'b']);
    run(blendAction, deps, { steps: 2 });
    const id = selected()[0]!;
    run(editPathEffectAction, deps, { ids: [id], steps: 5 });
    expect(partsOf(scene, id)).toHaveLength(5);
    run(editPathEffectAction, deps, { ids: [id], steps: 5 });
    scene.undo();
    expect(partsOf(scene, id)).toHaveLength(2);
    // The next undo is the blend's own insert: the no-change edit left no entry.
    scene.undo();
    expect(scene.get(id as NodeId)).toBeUndefined();
  });
});

describe('a blend spaced by distance', () => {
  it('puts a step every `distance` from the first source, as many as fit short of the second', () => {
    const { scene, deps, selected } = setup(['a', 'b']);
    // Middles at 10 and 210: a run of 200.
    run(blendAction, deps, { spaceBy: 'distance', distance: 60 });
    const middles = partsOf(scene, selected()[0]!).map((p) => {
      const b = boundsOfPath(p.path);
      return b.x + b.width / 2;
    });
    expect(middles.map((x) => Math.round(x * 1000) / 1000)).toEqual([70, 130, 190]);
    // Far enough apart that none fits.
    run(editPathEffectAction, deps, { ids: selected(), distance: 250 });
    expect(partsOf(scene, selected()[0]!)).toBeNull();
    // Back to its count.
    run(editPathEffectAction, deps, { ids: selected(), spaceBy: 'count' });
    expect(partsOf(scene, selected()[0]!)).toHaveLength(4);
  });
});

describe('a blend along a spine', () => {
  const middleOf = (path: Parameters<typeof boundsOfPath>[0]) => {
    const b = boundsOfPath(path);
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2), width: Math.round(b.width), height: Math.round(b.height) };
  };

  it('lays its steps along a third selected path, and follows it', () => {
    const { scene, deps, selected } = setup(['a', 'b', 'spine']);
    run(blendAction, deps, { steps: 3, rotate: false });
    const id = selected()[0]!;
    expect(scene.get(id as NodeId)!.dependsOn).toEqual(['a', 'b', 'spine']);
    // The spine runs (0,100)-(200,100).
    expect(partsOf(scene, id).map((p) => middleOf(p.path))).toMatchObject([
      { x: 50, y: 100 }, { x: 100, y: 100 }, { x: 150, y: 100 },
    ]);
    scene.setPose('spine' as NodeId, { x: 0, y: 300, width: 200, height: 0 });
    expect(middleOf(partsOf(scene, id)[1]!.path)).toMatchObject({ x: 100, y: 300 });
  });

  it('turns its steps to the spine with orient', () => {
    const { scene, deps, selected } = setup(['a', 'b', 'spine']);
    // A spine running down, across a run that goes right.
    scene.setPose('spine' as NodeId, { x: 0, y: 0, width: 0, height: 200 });
    scene.update('spine' as NodeId, { data: {
      ...(scene.get('spine' as NodeId)!.data as object),
      path: { kind: 'polygon', commands: new Uint8Array([0, 1]), coords: new Float32Array([0, 0, 0, 200]), fillRule: 'nonzero' },
    } });
    scene.setPose('b' as NodeId, { x: 200, y: 0, width: 60, height: 20 });
    run(blendAction, deps, { steps: 1, rotate: false });
    const id = selected()[0]!;
    expect(middleOf(partsOf(scene, id)[0]!.path)).toEqual({ x: 0, y: 100, width: 40, height: 20 });
    run(editPathEffectAction, deps, { ids: [id], orient: true });
    expect(middleOf(partsOf(scene, id)[0]!.path)).toEqual({ x: 0, y: 100, width: 20, height: 40 });
  });

  it('spaces by distance along the spine', () => {
    const { scene, deps, selected } = setup(['a', 'b', 'spine']);
    run(blendAction, deps, { spaceBy: 'distance', distance: 90 });
    expect(partsOf(scene, selected()[0]!).map((p) => middleOf(p.path).x)).toEqual([90, 180]);
  });

  it('paints nothing while its spine is gone', () => {
    const { scene, deps, selected } = setup(['a', 'b', 'spine']);
    run(blendAction, deps, { steps: 2 });
    const node = scene.get(selected()[0] as NodeId)!;
    expect(pathEffectParts(node, [derivedDepOf(scene, 'a' as NodeId), derivedDepOf(scene, 'b' as NodeId), undefined])).toBeNull();
  });
});

describe('bend and repeat along a path', () => {
  it('bends the first selected shape along the second', () => {
    const { scene, deps, selected } = setup(['a', 'spine']);
    run(bendAlongAction, deps, {});
    const [part] = partsOf(scene, selected()[0]!);
    const b = boundsOfPath(part!.path);
    expect(b.width).toBeCloseTo(200, 1);
    expect(b.y + b.height / 2).toBeCloseTo(100, 1);
    expect(part!.fill).toEqual({ paint: { color: '#ff0000' } });
  });

  it('repeats the first selected shape along the second', () => {
    const { scene, deps, selected } = setup(['a', 'spine']);
    run(repeatAlongAction, deps, { count: 3, orient: false });
    const xs = partsOf(scene, selected()[0]!).map((p) => boundsOfPath(p.path).x);
    expect(xs).toEqual([-10, 90, 190]);
  });
});

describe('the Edit Path Effect form', () => {
  /** A blend of a and b, and a repeat of a along the spine, both selected. */
  function twoEffects() {
    const { scene, deps, selected } = setup(['a', 'b']);
    run(blendAction, deps, {});
    const blend = selected()[0]!;
    (deps.selection as unknown as { set(ids: string[]): void }).set(['a', 'spine']);
    run(repeatAlongAction, deps, { count: 3 });
    const repeat = selected()[0]!;
    (deps.selection as unknown as { set(ids: string[]): void }).set([blend, repeat]);
    return { scene, deps, blend, repeat };
  }
  const effectOf = (scene: TestScene, id: string) => pathEffectOf(scene.get(id as NodeId))!;

  it('is disabled with no path effect selected', () => {
    const { deps } = setup(['a']);
    expect(editPathEffectAction.enabled?.(deps)).not.toBe(true);
  });

  it('reads each selected kind, filling what an effect leaves unset', () => {
    const { deps } = twoEffects();
    const { values } = readPathEffectSettings(deps);
    expect(values).toMatchObject({ blends: 1, bends: 0, repeats: 1, blend: { steps: 4, orient: false }, repeatAlong: { count: 3, orient: true } });
  });

  it('changes a field only on effects of the kind whose section it was made in', () => {
    const { scene, deps, blend, repeat } = twoEffects();
    run(editPathEffectAction, deps, pathEffectSettingsParams('blend.orient', true)!);
    expect(effectOf(scene, blend)).toMatchObject({ orient: true });
    expect(effectOf(scene, repeat)).toMatchObject({ kind: 'repeatAlong' });
    expect((effectOf(scene, repeat) as { orient?: boolean }).orient).toBeUndefined();
  });
});

describe('expand', () => {
  it('replaces the effect with ordinary paths in its paint, and undoes as one step', () => {
    const { scene, deps, selected } = setup(['a', 'spine']);
    run(repeatAlongAction, deps, { count: 3, orient: false });
    const effect = selected()[0]!;
    const before = scene.roots.length;
    run(expandPathEffectAction, deps);
    expect(scene.get(effect as NodeId)).toBeUndefined();
    expect(scene.roots.length).toBe(before + 2);
    const made = selected().map((id) => scene.get(id as NodeId)!);
    expect(made).toHaveLength(3);
    expect(made.every((n) => n.dependsOn === undefined)).toBe(true);
    expect(made[0]!.data).toMatchObject({ fill: { paint: { color: '#ff0000' } } });
    expect(made.map((n) => n.pose.x)).toEqual([-10, 90, 190]);
    scene.undo();
    expect(scene.get(effect as NodeId)).toBeDefined();
  });
});

describe('in a scene whose containers compose frames', () => {
  /** `a` in a container at (200,100) turned a quarter, `b` at the root. */
  function framedSetup() {
    const scene: TestScene = createScene<unknown, 'default', RectPose>({
      systemLayers: [{ id: 'default' }],
      registry: withPathEffectsRegistry(),
      composition: RIGID_POSE_COMPOSITION,
      initial: [
        { id: 'g' as NodeId, kind: 'container', layer: 'default', pose: { x: 200, y: 100, width: 100, height: 100, rotation: Math.PI / 2 }, data: {} },
        { ...box('a', 0, '#ff0000'), pose: { x: 0, y: 0, width: 20, height: 10 }, parent: 'g' as NodeId },
        { ...box('b', 95, '#0000ff'), pose: { x: 95, y: 100, width: 10, height: 20 } },
        { ...box('c', 80, '#00ff00'), pose: { x: 80, y: 40, width: 20, height: 10 }, parent: 'g' as NodeId },
      ],
    });
    let current: string[] = [];
    const selection = { get: () => current, set: (next: string[]) => { current = next; } };
    const deps = { scene, selection } as unknown as InvocationCtx['deps'];
    return { scene, deps, select: (ids: string[]) => { current = ids; }, selected: () => current };
  }

  it('makes a blend of two shapes in one container inside it', () => {
    const { scene, deps, select, selected } = framedSetup();
    select(['a', 'c']);
    run(blendAction, deps, { steps: 1 });
    expect(scene.get(selected()[0] as NodeId)!.parent).toBe('g');
  });

  it('expands a blend across frames where its steps are painted', () => {
    const { scene, deps, select, selected } = framedSetup();
    select(['a', 'b']);
    run(blendAction, deps, { steps: 1, rotate: false });
    expect(scene.get(selected()[0] as NodeId)!.parent).toBeNull();
    run(expandPathEffectAction, deps);
    // a is painted 10 wide by 20 tall about (295,110), b about (100,110).
    const [copy] = selected().map((id) => scene.get(id as NodeId)!);
    expect(copy!.pose.x).toBeCloseTo(192.5, 3);
    expect(copy!.pose.y).toBeCloseTo(100, 3);
    expect(copy!.pose.width).toBeCloseTo(10, 3);
    expect(copy!.pose.height).toBeCloseTo(20, 3);
  });
});

describe('moving and reshaping an effect', () => {
  const dragCtx = (deps: InvocationCtx['deps'], drag?: { x: number; y: number }) => ({
    world: drag ?? { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps,
    ...(drag ? { drag: { start: { x: 0, y: 0 }, current: drag, delta: drag } } : {}),
  }) as unknown as InvocationCtx;

  it('drags its sources with it, so it follows them, as one undo step', () => {
    const { scene, deps, selected } = setup(['a', 'b']);
    run(blendAction, deps, { steps: 3 });
    const effect = selected()[0]!;
    const handle = (moveAction.invoker as OngoingInvoker).start(dragCtx(deps), {}) as OngoingHandle;
    handle.onMove!(dragCtx(deps, { x: 0, y: 50 }));
    handle.onEnd!(dragCtx(deps, { x: 0, y: 50 }), 'commit');
    expect(scene.get('a' as NodeId)!.pose.y).toBe(50);
    expect(scene.get('b' as NodeId)!.pose.y).toBe(50);
    const mid = boundsOfPath(partsOf(scene, effect)[1]!.path);
    expect(mid.y + mid.height / 2).toBeCloseTo(60, 3);
    scene.undo();
    expect(scene.get('a' as NodeId)!.pose.y).toBe(0);
  });

  it('resizes and turns through its sources, which a resize or rotation writes in its place', () => {
    const { scene, deps, selected } = setup(['a', 'spine']);
    run(bendAlongAction, deps, {});
    expect(scene.get(selected()[0] as NodeId)!.dependsOn).toEqual(['a', 'spine']);
  });
});
