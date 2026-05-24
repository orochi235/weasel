/**
 * useModality — bootstraps the mode machine, decoration adapter, and scoping
 * dim for WeaselDraw. Wires them together and exposes the pieces that
 * App.tsx needs to plumb into <SceneCanvas>.
 *
 * No behavioral changes land here (mode stays 'normal'). This hook is
 * the foundation that Tasks 19–20 build on.
 */
import { useEffect, useMemo } from 'react';
import {
  asNodeId,
  boundsOfPath,
  enumerateAnchors,
  type RenderLayer,
  type DrawCommand,
  type Scene,
} from '@orochi235/weasel';
import { createHistory, type History } from '@orochi235/weasel-history';
import {
  createModeDecorations,
  createScopingDim,
  DEFAULT_MODES,
  type ModeDecorations,
  type ScopingDim,
} from '@orochi235/weasel-modes';
import {
  createModeMachine,
  createPathEditPainter,
  type ModeMachine,
} from './index';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseModalityReturn {
  machine: ModeMachine;
  decorations: ModeDecorations;
  scopingDim: ScopingDim;
  decorationLayer: RenderLayer<unknown>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Bootstrap the mode machine.
 *
 * The mode machine is constructed from a History that lives alongside the
 * scene (not derived from the scene itself). `scene.applyOps` must consult
 * the machine's active journal — wired via `scene.setActiveJournalAccessor`
 * once the machine exists. No more ref-indirection cycle break needed at
 * the call site.
 */
export function useModality(
  scene: Scene<unknown, string, unknown>,
): UseModalityReturn {
  // Create a weasel-history History backed by the scene. Kit ops call
  // op.apply(adapter) — the scene is a valid adapter (it has add/remove/
  // setPose/update/move etc.). This History is what the mode machine calls
  // beginJournal() on; the resulting Journal's applyBatch is what
  // scene.applyBatch delegates to when getActiveJournal() is non-null.
  const history = useMemo<History>(() => createHistory(scene), [scene]);

  const machine = useMemo<ModeMachine>(
    () => createModeMachine({ modes: DEFAULT_MODES, history }),
    [history],
  );

  // Wire the active-journal accessor on the scene. The setter clears any
  // previous accessor on unmount so a re-mount doesn't leak a stale ref
  // to a disposed machine.
  useEffect(() => {
    scene.setActiveJournalAccessor(() => machine.getActiveJournal());
    return () => scene.setActiveJournalAccessor(null);
  }, [scene, machine]);

  const decorations = useMemo(
    () => createModeDecorations({ registry: machine.registry }),
    [machine.registry],
  );

  const scopingDim = useMemo(
    () =>
      createScopingDim({
        registry: machine.registry,
        getTargetIds: () => {
          const tid = machine.getActiveTargetId();
          return tid ? new Set([tid]) : new Set<string>();
        },
      }),
    // machine.registry is stable; machine is stable (memoized from history).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [machine],
  );

  // Register the path-edit painter once per decorations instance.
  useEffect(() => {
    const painter = createPathEditPainter({
      getTargetId: () => machine.getActiveTargetId(),
      getAnchors: (pathId) => {
        const node = scene.get(asNodeId(pathId));
        if (!node || node.kind !== 'leaf') return [];
        const data = node.data as { path?: unknown };
        const path = data.path;
        if (!path || typeof path !== 'object') return [];
        const p = path as { kind?: string; commands?: unknown; coords?: unknown };
        if (p.kind !== 'polygon' || !(p.commands instanceof Uint8Array) || !(p.coords instanceof Float32Array)) return [];
        // PolygonPath coords may be stored either in local space (origin
        // at 0,0, with the pose providing the world offset) or in world
        // space (coords already at the path's world position, pose AABB
        // matching). PATH_PAINTER#pathAtPose handles both by translating
        // the path by `pose.x - b.x, pose.y - b.y` at draw time. We apply
        // the same delta to enumerated anchors so they land at the
        // path's actual rendered position.
        const typedPath = p as Parameters<typeof enumerateAnchors>[0];
        const localAnchors = enumerateAnchors(typedPath);
        const b = boundsOfPath(typedPath);
        const pose = node.pose as { x?: number; y?: number };
        const dx = (pose.x ?? 0) - b.x;
        const dy = (pose.y ?? 0) - b.y;
        if (dx === 0 && dy === 0) return localAnchors;
        return localAnchors.map((a) => ({
          ...a,
          x: a.x + dx,
          y: a.y + dy,
          ...(a.controlIn ? { controlIn: { ...a.controlIn, x: a.controlIn.x + dx, y: a.controlIn.y + dy } } : {}),
          ...(a.controlOut ? { controlOut: { ...a.controlOut, x: a.controlOut.x + dx, y: a.controlOut.y + dy } } : {}),
        }));
      },
    });
    decorations.register('path-edit', painter);
  }, [decorations, machine, scene]);

  // Build a RenderLayer<unknown> whose draw() calls decorations.paint().
  // World-space commands; drawLayers wraps in viewToMat3 automatically
  // (default `space: 'world'`).
  const decorationLayer = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'mode-decorations',
      label: 'Mode decorations',
      draw: () => {
        return decorations.paint() as DrawCommand[];
      },
    }),
    [decorations],
  );

  return { machine, decorations, scopingDim, decorationLayer };
}
