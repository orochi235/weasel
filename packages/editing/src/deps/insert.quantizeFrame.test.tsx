/** An insert preview under a quantize rule, drawn into a container that turns its contents. */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, useDepSource, type DepRegistry } from '@weasel-js/routing/react';
import type { InvocationCtx, OngoingOverlay } from '@weasel-js/routing';
import { snapToPitch, type OutputGrid } from '@weasel-js/geom';
import {
  AUTO_POSE_DESCRIPTOR, RIGID_POSE_COMPOSITION, OUTPUT_GRID_KEY, composeWorldPose, createScene, insertPreviewExtent,
  quantizeSize, sceneViewPoseAdapter,
} from '@weasel-js/core/engine';
import { sceneMutators } from '@weasel-js/core';
import type { RectPose, Scene } from '@weasel-js/core/engine';
import type { NodeId, Op } from '@weasel-js/core';
import { insertAction } from '../actions/insert/action';
import { useInsertDepSource } from './insert';

const GRID: OutputGrid = { pitch: 4, origin: { x: 0, y: 0 } };
type S = Scene<unknown, 'main', RectPose>;

describe('an insert preview under a quantize rule, in a turned container', () => {
  it('lands where the release commits the node', () => {
    const scene: S = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      composition: RIGID_POSE_COMPOSITION,
      doc: { [OUTPUT_GRID_KEY]: GRID },
      quantize: {
        stored: ({ pose }, grid, anchor) => ({
          pose: quantizeSize(pose, snapToPitch(pose.width, grid.pitch), snapToPitch(pose.height, grid.pitch), anchor),
        }),
      },
    });
    const group = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 200, height: 200, rotation: Math.PI / 2 } }) as NodeId;
    const any = scene as unknown as Scene<unknown, string, unknown>;
    const adapter = { applyOps: (ops: Op[], label?: string) => scene.applyBatch(ops, label ?? 'Insert', sceneMutators(any)) };
    const insertInto = { get: () => group };
    let reg!: DepRegistry;
    function Wire() {
      useDepSource('insertInto', () => insertInto);
      useInsertDepSource(any, adapter);
      reg = useDepRegistry();
      return null;
    }
    render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
    const ctx = (world: { x: number; y: number }): InvocationCtx => ({
      world, screen: world, modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { insert: reg.get('insert')!, insertInto, scene: scene as never },
    });
    const invoker = insertAction.invoker;
    if (invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    const from = { x: 50, y: 60 };
    const to = { x: 75, y: 70 };
    const handle = invoker.start(ctx(from), { params: { kind: 'rect' } });
    handle.onMove!(ctx(to));
    const ov = handle.overlay?.() as Extract<OngoingOverlay, { kind: 'insertPreview' }>;
    handle.onEnd!(ctx(to), 'commit');
    const made = [...scene.nodes.values()].find((n) => n.kind === 'mark')!;
    expect(made.parent).toBe(group);
    const world = composeWorldPose(sceneViewPoseAdapter(any), made.id, RIGID_POSE_COMPOSITION.compose as never);
    const committed = AUTO_POSE_DESCRIPTOR.getBounds(world);
    expect(ov.lands).toBeDefined();
    const shown = insertPreviewExtent(ov).bounds;
    for (const k of ['x', 'y', 'width', 'height'] as const) expect(shown[k]).toBeCloseTo(committed[k], 9);
  });
});
