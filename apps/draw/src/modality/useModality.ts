/**
 * useModality — bootstraps the mode machine, decoration adapter, and scoping
 * dim for WeaselDraw. Wires them together and exposes the pieces that
 * the app plumbs into <SceneCanvas>.
 */
import { useEffect, useMemo } from 'react';
import {
  modeDecorationLayer,
  type RenderLayer,
  type Scene,
} from '@weasel-js/core';
import type { History } from '@weasel-js/history';
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
import { drawPrefs } from '../prefs';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseModalityReturn {
  machine: ModeMachine;
  decorations: ModeDecorations;
  scopingDim: ScopingDim;
  decorationLayer: RenderLayer<unknown>;
  /** The scene's history, which the mode machine opens its journals on. */
  history: History;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Bootstrap the mode machine.
 *
 * The machine opens its journals on `scene.history`, and the scene reads the
 * open one through `scene.setActiveJournalAccessor`: edits land in it, and
 * undo and redo step it.
 */
export function useModality(
  scene: Scene<unknown, string, unknown>,
): UseModalityReturn {
  const history = scene.history;

  const machine = useMemo<ModeMachine>(
    () => createModeMachine({
      modes: DEFAULT_MODES,
      history,
      journalSoftModes: () => drawPrefs().get('modes.undo') === 'mode',
    }),
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

  const decorationLayer = useMemo(() => modeDecorationLayer(decorations), [decorations]);

  return { machine, decorations, scopingDim, decorationLayer, history };
}
