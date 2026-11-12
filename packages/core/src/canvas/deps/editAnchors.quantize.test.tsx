/**
 * An anchor drag under a scene's quantize rule previews the path the rule
 * stores, so the release lands where the preview showed.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { polygonFromPoints, type OutputGrid, type PolygonPath } from '@weasel-js/geom';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { DepRegistryProvider, useDepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import { OUTPUT_GRID_KEY } from 'core/scene/outputGrid';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import type { QuantizeRule } from 'core/scene/useSceneOptions';
import type { SelectionApi } from 'core/selection/useSelection';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import type { EditAnchorsDep } from 'interactions/actions/depSchema';
import { editAnchorsAction } from 'interactions/actions/edit-anchors/action';
import { useEditAnchorsDepSource, type EditAnchorsStateRef } from './editAnchors';

type Data = { path: PolygonPath };
const GRID: OutputGrid = { pitch: 1, origin: { x: 0, y: 0 } };
const RULE: QuantizeRule<Data, RectPose> = {
  stored: ({ data }) => {
    const coords = Array.from(data.path.coords, Math.round);
    return coords.every((c, i) => c === data.path.coords[i]) ? null : { data: { ...data, path: { ...data.path, coords } } };
  },
};

describe('an anchor drag under a quantize rule', () => {
  it('previews the path it commits', () => {
    const scene = createScene<Data, 'main', RectPose>({
      systemLayers: [{ id: 'main' }], quantize: RULE, doc: { [OUTPUT_GRID_KEY]: GRID },
    });
    const id = scene.add({
      kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 40, height: 40 },
      data: { path: polygonFromPoints([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }]) },
    });
    let selected: ReadonlySet<number> = new Set();
    const state: EditAnchorsStateRef = {
      getEditingId: () => id,
      setEditingId: () => {},
      getSelectedAnchors: () => selected,
      setSelectedAnchors: (next) => { selected = next; },
      getMarquee: () => null,
      setMarquee: () => {},
      getSelectedMark: () => null,
      setSelectedMark: () => {},
      getExtensions: () => [],
      getHandleLocks: () => null,
      setHandleLocks: () => {},
    };
    const loose = scene as unknown as Scene<unknown, string, unknown>;
    const adapter = {
      applyOps: (ops: Parameters<typeof scene.applyBatch>[0], label = '') => {
        scene.applyBatch(ops, label, defaultCommitAdapter(loose));
      },
    };
    const selection = { get: () => [id] as NodeId[] } as unknown as SelectionApi;
    const { result } = renderHook(() => {
      useEditAnchorsDepSource(loose, selection, adapter, state);
      return useDepRegistry();
    }, { wrapper: ({ children }: { children: ReactNode }) => createElement(DepRegistryProvider, null, children) });
    const dep = (result.current.get as (key: string) => EditAnchorsDep)('editAnchors');
    const ctx = (x: number, y: number) => ({
      world: { x, y },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { editAnchors: dep, selection },
      drag: { start: { x: 40, y: 0 }, current: { x, y }, delta: { x: x - 40, y }, affordance: { kind: 'anchor:1' } },
    }) as unknown as InvocationCtx;
    const handle = (editAnchorsAction.invoker as OngoingInvoker).start(ctx(40, 0), undefined);
    handle.onMove!(ctx(50.3, 0.4));
    const preview = handle.previewData!(id) as Data;
    handle.onEnd!(ctx(50.3, 0.4), 'commit');
    expect(preview).toBeTruthy();
    expect(Array.from(scene.get(id)!.data.path.coords)).toEqual(Array.from(preview.path.coords));
  });
});
