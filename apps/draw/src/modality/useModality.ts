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
 * Cycle break: `scene.applyOps` must consult the machine's active journal,
 * but the machine is constructed from a History that lives alongside the
 * scene (not from the scene itself). We use a ref so `getActiveJournal` in
 * `useScene`'s options can read `machineRef.current` before the machine
 * exists, and we populate `machineRef.current` in a `useEffect` so it's
 * always fresh.
 *
 * Caller is responsible for setting up `getActiveJournal: () =>
 * machineRef.current?.getActiveJournal() ?? null` in its `useScene` call
 * and returning `machineRef` so the hook can be composed correctly.
 */
export function useModality(
  scene: Scene<unknown, string, unknown>,
  machineRef: React.MutableRefObject<ModeMachine | null>,
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

  // Keep the ref current so the getActiveJournal closure (in useScene)
  // always reads the live machine.
  useEffect(() => {
    machineRef.current = machine;
  }, [machine, machineRef]);

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
        // enumerateAnchors returns coords in the path's local space.
        // The painter renders in world space, so translate by the node's
        // pose. Scale and rotation are intentionally ignored for now —
        // apps/draw's pen-tool paths don't carry independent pose scale,
        // they live directly in world coords via x/y offset of their AABB.
        const localAnchors = enumerateAnchors(p as Parameters<typeof enumerateAnchors>[0]);
        const pose = node.pose as { x?: number; y?: number };
        const dx = pose.x ?? 0;
        const dy = pose.y ?? 0;
        if (dx === 0 && dy === 0) return localAnchors;
        return localAnchors.map((a) => ({
          x: a.x + dx,
          y: a.y + dy,
          ...(a.controlIn ? { controlIn: { x: a.controlIn.x + dx, y: a.controlIn.y + dy } } : {}),
          ...(a.controlOut ? { controlOut: { x: a.controlOut.x + dx, y: a.controlOut.y + dy } } : {}),
        }));
      },
    });
    decorations.register('path-edit', painter);
  }, [decorations, machine, scene]);

  // Build a RenderLayer<unknown> whose draw() calls decorations.paint().
  // The decoration layer sits after the scene slot and before tool overlays
  // (Canvas already handles the slot ordering when decorationLayer is passed
  // to SceneCanvas).
  const decorationLayer = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'mode-decorations',
      label: 'Mode decorations',
      draw: (_data, _view) => decorations.paint() as DrawCommand[],
    }),
    [decorations],
  );

  return { machine, decorations, scopingDim, decorationLayer };
}
