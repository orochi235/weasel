/**
 * A real scene holding one path, open in path edit through core's real `editAnchors` dep source, for tests that
 * drive path-tools actions and drags through it and undo them through the scene.
 */
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import type { PathConstraint, PolygonPath } from '@weasel-js/geom';
import type { ActionDeps } from '@weasel-js/routing';
import { DepRegistryProvider, useDepRegistry } from '@weasel-js/routing/react';
import {
  IDENTITY_POSE_COMPOSITION, createScene, defaultCommitAdapter, type EditAnchorsDep, type HandleLocks, type NodeId,
  type PathEditMark, type Scene, type SelectionApi,
} from '@weasel-js/core';
import { useEditAnchorsDepSourceForTests as useEditAnchorsDepSource, type EditAnchorsStateRef } from '@weasel-js/core/test-seams';
import { createConstraintsExtension } from '../../constraints/constraintsExtension';

type Data = { constraints?: PathConstraint[] };

/** `path` as a polygon pose on a real scene, open in path edit through the real `editAnchors` dep source,
 *  with the constraints extension. */
export function editHarness(path: PolygonPath) {
  const scene = createScene<Data, 'main', PolygonPath>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'mark', layer: 'main', pose: path, data: {} });
  let selected: ReadonlySet<number> = new Set();
  let selectedMark: PathEditMark | null = null;
  let locks: HandleLocks | null = null;
  const extensions = [createConstraintsExtension()];
  const state: EditAnchorsStateRef = {
    getEditingId: () => id,
    setEditingId: () => {},
    getSelectedAnchors: () => selected,
    setSelectedAnchors: (next) => { selected = next; },
    getMarquee: () => null,
    setMarquee: () => {},
    getSelectedMark: () => selectedMark,
    setSelectedMark: (next) => { selectedMark = next; },
    getExtensions: () => extensions,
    getHandleLocks: () => locks,
    setHandleLocks: (next) => { locks = next; },
  };
  const loose = scene as unknown as Scene<unknown, string, unknown>;
  const applyOps = (ops: Parameters<typeof scene.applyBatch>[0], label = '') => {
    scene.applyBatch(ops, label, defaultCommitAdapter(loose));
  };
  const selection = { current: [id] as NodeId[] } as unknown as SelectionApi;
  const { result, unmount } = renderHook(() => {
    useEditAnchorsDepSource(loose, selection, { applyOps }, state);
    return useDepRegistry();
  }, { wrapper: ({ children }: { children: ReactNode }) => createElement(DepRegistryProvider, null, children) });
  const dep = () => (result.current.get as (key: string) => EditAnchorsDep)('editAnchors');
  const deps = () => ({
    editAnchors: dep(), scene: loose, applyOps, selection: { get: () => [id], set: () => {} },
  }) as unknown as ActionDeps;
  return {
    scene, id, deps, unmount,
    path: () => scene.get(id)!.pose,
    selected: () => [...selected].sort((a, b) => a - b),
    setSelected: (next: number[]) => { selected = new Set(next); },
    locks: () => locks,
  };
}
export type EditHarness = ReturnType<typeof editHarness>;
