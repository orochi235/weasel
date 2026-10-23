import { describe, expect, it } from 'vitest';
import { buildSceneLayer, buildSceneLayers } from './buildSceneLayer';
import type { DrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 100, height: 100 };
const POSE = { x: 0, y: 0, width: 10, height: 10 };

describe('buildSceneLayer hierarchical path', () => {
  it('emits nested GroupDrawCommand tree for scene-backed adapter', () => {
    const scene = createScene<{ label: string }, 'bg', typeof POSE>({
      systemLayers: [{ id: 'bg' }],
    });
    const bed = scene.add({ kind: 'group', layer: 'bg', pose: POSE, data: { label: 'bed' } });
    scene.add({ kind: 'mark', layer: 'bg', pose: POSE, data: { label: 'plant' }, parent: bed });
    const adapter = sceneToAdapter(scene);
    const layer = buildSceneLayer(
      { drawOne: (_node, _p) => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: { color: 'red' } } }] },
      adapter as never,
      () => null,
      () => null,
    );
    // buildSceneLayer emits raw world-space commands; drawLayers wraps in
    // viewToMat3 at orchestration. The output is one group per layer; within a
    // layer, nodes are bucketed FLAT by their own layer (bed + plant siblings),
    // not nested under the container (buildSceneTree per-node-layer bucketing).
    const out = layer.draw(null, VIEW, DIMS) as DrawCommand[];
    expect(out).toHaveLength(1); // one 'bg' layer group
    const bgGroup = out[0] as { kind: string; children: DrawCommand[] };
    expect(bgGroup.kind).toBe('group');
    expect(bgGroup.children).toHaveLength(2); // bed + plant, flattened
    for (const c of bgGroup.children) expect((c as { kind: string }).kind).toBe('group');
  });

  it('cfg.toPose is honored on the hierarchical path', () => {
    // cfg.toPose returns a transformed pose; the draw call should see the
    // transformed value, not the raw adapter.getPose result.
    const scene = createScene<{ label: string }, 'bg', typeof POSE>({
      systemLayers: [{ id: 'bg' }],
    });
    scene.add({ kind: 'mark', layer: 'bg', pose: POSE, data: { label: 'node' } });
    const adapter = sceneToAdapter(scene);

    const TRANSFORMED_POSE = { x: 99, y: 88, width: 10, height: 10 };
    const seenPoses: typeof POSE[] = [];

    const layer = buildSceneLayer(
      {
        toPose: () => TRANSFORMED_POSE,
        drawOne: (_node, pose) => {
          seenPoses.push(pose as typeof POSE);
          return [];
        },
      },
      adapter as never,
      () => null,
      () => null,
    );
    layer.draw(null, VIEW, DIMS);
    expect(seenPoses).toHaveLength(1);
    expect(seenPoses[0]).toEqual(TRANSFORMED_POSE);
  });
});

describe('buildSceneLayer postProcess', () => {
  const RED_RECT: DrawCommand[] = [
    { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: { color: 'red' } } },
  ];

  function makeHierarchicalAdapter(layers: string[] = ['bg']) {
    const scene = createScene<{ label: string }, string, typeof POSE>({
      systemLayers: layers.map((id) => ({ id })),
    });
    for (const layer of layers) {
      scene.add({ kind: 'mark', layer, pose: POSE, data: { label: `node-${layer}` } });
    }
    return sceneToAdapter(scene);
  }

  it('receives the scene commands and its return value replaces them', () => {
    const adapter = makeHierarchicalAdapter();
    const seen: DrawCommand[][] = [];
    const layer = buildSceneLayer(
      {
        drawOne: () => RED_RECT,
        postProcess: (cmds) => {
          seen.push(cmds);
          return [{ kind: 'group', alpha: 0.5, children: cmds }];
        },
      },
      adapter as never,
      () => null,
      () => null,
    );
    const out = layer.draw(null, VIEW, DIMS) as DrawCommand[];
    // The wrapper is what reaches the renderer, scene content nested inside.
    expect(out).toHaveLength(1);
    const wrapper = out[0] as { kind: string; alpha?: number; children: DrawCommand[] };
    expect(wrapper.kind).toBe('group');
    expect(wrapper.alpha).toBe(0.5);
    // The hook saw exactly what the scene would otherwise emit.
    expect(seen).toHaveLength(1);
    expect(wrapper.children).toBe(seen[0]);
    expect(seen[0]).toHaveLength(1); // one 'bg' layer group
  });

  it('is called with view and dims', () => {
    const adapter = makeHierarchicalAdapter();
    const seenArgs: unknown[][] = [];
    const layer = buildSceneLayer(
      {
        drawOne: () => RED_RECT,
        postProcess: (cmds, view, dims) => {
          seenArgs.push([view, dims]);
          return cmds;
        },
      },
      adapter as never,
      () => null,
      () => null,
    );
    layer.draw(null, VIEW, DIMS);
    expect(seenArgs).toEqual([[VIEW, DIMS]]);
  });

  it('identity hook emits commands deep-equal to the no-hook baseline', () => {
    const cfg = { drawOne: () => RED_RECT };
    const baseline = buildSceneLayer(
      cfg, makeHierarchicalAdapter() as never, () => null, () => null,
    ).draw(null, VIEW, DIMS);
    const withHook = buildSceneLayer(
      { ...cfg, postProcess: (cmds: DrawCommand[]) => cmds },
      makeHierarchicalAdapter() as never, () => null, () => null,
    ).draw(null, VIEW, DIMS);
    expect(withHook).toEqual(baseline);
  });

  it('runs once per scene:<layerId> canvas layer with only that layer\'s commands', () => {
    const adapter = makeHierarchicalAdapter(['bg', 'fg']);
    const calls: DrawCommand[][] = [];
    const countPaths = (cmds: DrawCommand[]): number =>
      cmds.reduce(
        (n, c) =>
          n + (c.kind === 'path' ? 1 : 0) +
          (c.kind === 'group' ? countPaths((c as { children: DrawCommand[] }).children) : 0),
        0,
      );
    const entries = buildSceneLayers(
      {
        drawOne: () => RED_RECT,
        postProcess: (cmds) => {
          calls.push(cmds);
          return cmds;
        },
      },
      adapter as never,
      () => null,
      () => null,
    );
    expect(entries.map((e) => e.key)).toEqual(['scene:bg', 'scene:fg']);
    for (const entry of entries) entry.layer.draw(null, VIEW, DIMS);
    // Hook ran once per split canvas layer, each seeing only its own layer's
    // node (one path each — the bundled scene layer would carry both).
    expect(calls).toHaveLength(2);
    expect(calls.map(countPaths)).toEqual([1, 1]);
  });

  it('cfg.objects routes through the hook', () => {
    const objects = [{ id: 'a' }, { id: 'b' }];
    const seen: DrawCommand[][] = [];
    const layer = buildSceneLayer(
      {
        objects,
        toPose: () => POSE,
        drawOne: () => RED_RECT,
        postProcess: (cmds) => {
          seen.push(cmds);
          return [{ kind: 'group', alpha: 0.25, children: cmds }];
        },
      },
      undefined,
      () => null,
      () => null,
    );
    const out = layer.draw(null, VIEW, DIMS) as DrawCommand[];
    expect(seen).toHaveLength(1);
    expect(seen[0]).toHaveLength(2); // one path per object
    expect(out).toHaveLength(1);
    expect((out[0] as { alpha?: number }).alpha).toBe(0.25);
  });

  it('is called even when the scene emits zero commands', () => {
    const seen: DrawCommand[][] = [];
    const layer = buildSceneLayer(
      {
        objects: [],
        toPose: () => POSE,
        drawOne: () => RED_RECT,
        postProcess: (cmds) => {
          seen.push(cmds);
          return cmds;
        },
      },
      undefined,
      () => null,
      () => null,
    );
    const out = layer.draw(null, VIEW, DIMS) as DrawCommand[];
    expect(seen).toEqual([[]]);
    expect(out).toEqual([]);
  });
});
