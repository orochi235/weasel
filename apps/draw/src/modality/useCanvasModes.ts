import {
  asNodeId,
  effectSourceFor,
  hasEditablePath,
  modeTriggers,
  type Contribution,
  type PathEditHost,
  type SelectionApi,
  useLatest,
} from '@weasel-js/core';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { DrawScene } from '../drawDocument';
import { enterModeOn } from './enterModeOn';
import type { ModeMachine } from './machine';
import { modalityShortcuts } from './shortcuts';

/** What `<SceneCanvas>` takes to enter and leave the machine's modes. */
export interface CanvasModes {
  /** Each mode's declared shortcuts and double-click entry, for `ambient`. */
  ambient: readonly Contribution[];
  /** The path being anchor-edited is the path-edit mode's target, read from the machine. */
  pathEdit: PathEditHost;
}

/** The path Enter opens for `ids`: one selected path, or the unlocked path a selected effect hides. */
export function pathToEdit(scene: DrawScene, ids: readonly string[]): string | null {
  const [id, ...rest] = ids;
  if (id === undefined || rest.length > 0) return null;
  const target = effectSourceFor(scene, asNodeId(id), 'path') ?? id;
  if (scene.isLocked(asNodeId(target))) return null;
  return (scene.get(asNodeId(target))?.data as { path?: unknown } | undefined)?.path != null ? target : null;
}

/**
 * A path with anchors is left to the canvas's `enterPathEdit`, which opens it; one without still
 * takes path-edit, as Enter does.
 */
export function useCanvasModes(
  machine: ModeMachine,
  scene: DrawScene,
  selection: SelectionApi,
  pathEdit: PathEditHost,
): CanvasModes {
  const entry = useLatest({
    pathToEdit: (): string | null => pathToEdit(scene, selection.get()),
    selection: (): readonly string[] => selection.get(),
  });
  const keys = useMemo(() => modalityShortcuts(machine, {
    pathToEdit: () => entry.current.pathToEdit(),
    selection: () => entry.current.selection(),
  }), [machine, entry]);

  const triggers = useMemo(() => modeTriggers(machine.registry, {
    canEnter: (id, target) => !(id === 'path-edit' && hasEditablePath(scene.get(asNodeId(target)))),
    enter: (id, target) => enterModeOn(machine, id, target),
  }), [machine, scene]);

  const ambient = useMemo(() => [keys, triggers], [keys, triggers]);
  return { ambient, pathEdit };
}

/**
 * What the breadcrumb calls the node the current mode is on: its label, its text, or its id. Read
 * again whenever the mode or the scene changes, so it follows a rename or the text being typed.
 */
export function useModeTargetLabel(machine: ModeMachine, scene: DrawScene): string | null {
  const { registry } = machine;
  const subscribe = useCallback((fn: () => void) => {
    const offMode = registry.subscribe(fn);
    const offScene = scene.subscribe(fn);
    return () => { offMode(); offScene(); };
  }, [registry, scene]);
  const read = useCallback((): string | null => {
    const targetId = machine.getActiveTargetId();
    if (!targetId) return null;
    const data = scene.get(asNodeId(targetId))?.data;
    return data ? data.label ?? data.text ?? targetId : targetId;
  }, [machine, scene]);
  return useSyncExternalStore(subscribe, read, read);
}
