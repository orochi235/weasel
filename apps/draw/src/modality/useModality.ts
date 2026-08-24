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
  sceneSelectionStore,
  type RenderLayer,
  type DrawCommand,
  type Scene,
} from '@weasel-js/core';
import { createHistory, type History } from '@weasel-js/history';
import {
  createModeDecorations,
  createScopingDim,
  DEFAULT_MODES,
  type ModeDecorations,
  type ScopingDim,
} from '@weasel-js/modes';
import {
  createModeMachine,
  type ModeMachine,
} from './index';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseModalityReturn {
  machine: ModeMachine;
  decorations: ModeDecorations;
  scopingDim: ScopingDim;
  decorationLayer: RenderLayer<unknown>;
  /** The live undo/redo History backing the mode machine. Exposed so the app
   *  can `serialize()` it for persistence and `restore()` it on reload. */
  history: History;
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
  const history = useMemo<History>(
    () => createHistory(scene, { selection: sceneSelectionStore(scene) }),
    [scene],
  );

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
    [machine],
  );

  // No path-edit anchor painter here on purpose. The kit's
  // `pathEditingOverlayLayer` (inside SceneCanvas) owns that chrome — it
  // reads `editAnchors.editingId`, which is the same state the anchor
  // hit-test and every anchor-editing Action key off. This app used to
  // register a second painter keyed on `machine.getActiveTargetId()`
  // instead; the two drew the same anchors from two different sources of
  // truth, the app's on top and in world space (so its markers grew with
  // zoom, unlike the kit's screen-space ones). Nothing here needs to
  // re-add it.

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

  return { machine, decorations, scopingDim, decorationLayer, history };
}
