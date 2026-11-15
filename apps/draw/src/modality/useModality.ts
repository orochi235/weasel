/**
 * useModality — bootstraps the mode machine, decoration adapter, and scoping
 * dim for WeaselDraw. Wires them together and exposes the pieces that
 * the app plumbs into <SceneCanvas>.
 */
import { useEffect, useMemo } from 'react';
import {
  asNodeId,
  hasEditablePath,
  createModeDecorationLayer,
  type RenderLayer,
  type Scene,
} from '@weasel-js/core';
import type { PathEditStore } from '@weasel-js/path-tools';
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
import { modeScope } from './modeScope';
import { modePathEdit } from './pathEditHost';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseModalityReturn {
  machine: ModeMachine;
  decorations: ModeDecorations;
  scopingDim: ScopingDim;
  decorationLayer: RenderLayer<unknown>;
  /** The scene's history, which the mode machine opens its journals on. */
  history: History;
  /** The path being anchor-edited is the path-edit mode's target, read from the machine; the
   *  host holds its selected anchors, and the corner controls read both from it. */
  pathEdit: PathEditStore;
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

  // Wire the active-journal accessor on the scene. Unmounting leaves the open
  // mode as leaving it would, keeping its edits: its journal would otherwise stay
  // the scene's innermost and take every later edit.
  useEffect(() => {
    scene.setActiveJournalAccessor(() => machine.getActiveJournal());
    return () => {
      machine.leaveMode();
      scene.setActiveJournalAccessor(null);
    };
  }, [scene, machine]);

  const decorations = useMemo(
    () => createModeDecorations({ registry: machine.registry }),
    [machine.registry],
  );

  const scopingDim = useMemo(
    () =>
      createScopingDim({
        registry: machine.registry,
        getTargetIds: modeScope(machine, scene),
      }),
    // machine.registry is stable; machine is stable (memoized from history).
    [machine, scene],
  );

  // No anchor painter: SceneCanvas's path-editing overlay draws the open path's anchors.
  const decorationLayer = useMemo(() => createModeDecorationLayer(decorations), [decorations]);

  const pathEdit = useMemo(
    () => modePathEdit(machine, (id) => hasEditablePath(scene.get(asNodeId(id)))),
    [machine, scene],
  );

  return { machine, decorations, scopingDim, decorationLayer, history, pathEdit };
}
