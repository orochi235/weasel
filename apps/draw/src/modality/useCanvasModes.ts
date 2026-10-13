import {
  asNodeId,
  type Contribution,
  type PathEditHost,
  type SceneCanvasHit,
  type SelectionApi,
  useLatest,
} from '@weasel-js/core';
import { useCallback, useMemo } from 'react';
import type { DrawScene, WeaselDrawData } from '../drawDocument';
import { dispatchDoubleClickEntry } from './doubleClickEntry';
import type { ModeMachine } from './machine';
import { modePathEdit } from './pathEditHost';
import { modalityShortcuts } from './shortcuts';
import { useModeId } from './useModeId';

/** What `<SceneCanvas>` takes to enter and leave the machine's modes. */
export interface CanvasModes {
  /** Each mode's declared shortcuts, for `ambient`. */
  keys: Contribution;
  /** The path being anchor-edited is the path-edit mode's target, read from the machine. */
  pathEdit: PathEditHost;
  onDoubleClick: (hit: SceneCanvasHit | null) => void;
}

export function useCanvasModes(machine: ModeMachine, scene: DrawScene, selection: SelectionApi): CanvasModes {
  const entry = useLatest({
    pathToEdit: (): string | null => {
      const [id, ...rest] = selection.get();
      if (id === undefined || rest.length > 0) return null;
      return (scene.get(id)?.data as { path?: unknown } | undefined)?.path != null ? id : null;
    },
    selection: (): readonly string[] => selection.get(),
  });
  const keys = useMemo(() => modalityShortcuts(machine, {
    pathToEdit: () => entry.current.pathToEdit(),
    selection: () => entry.current.selection(),
  }), [machine, entry]);

  const pathEdit = useMemo(() => modePathEdit(
    machine,
    (id) => (scene.get(asNodeId(id))?.data as WeaselDrawData | undefined)?.path?.kind === 'polygon',
  ), [machine, scene]);

  const onDoubleClick = useCallback((hit: SceneCanvasHit | null) => {
    dispatchDoubleClickEntry(hit, machine);
  }, [machine]);

  return { keys, pathEdit, onDoubleClick };
}

/** What the breadcrumb calls the node the current mode is on: its label, its text, or its id. */
export function useModeTargetLabel(machine: ModeMachine, scene: DrawScene): string | null {
  // The subscription is what re-reads the target; the resolved id is a tighter memo key than the
  // mode it came from.
  useModeId(machine);
  const targetId = machine.getActiveTargetId();
  return useMemo(() => {
    if (!targetId) return null;
    const data = scene.get(asNodeId(targetId))?.data;
    return data ? data.label ?? data.text ?? targetId : targetId;
  }, [targetId, scene]);
}
