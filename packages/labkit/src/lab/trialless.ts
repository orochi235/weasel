import { useMemo } from 'react';
import type { LabContribution } from '../chrome/labTypes';
import { icon } from '../icons.gen';
import type { InstrumentList } from '../instrument/types';
import {
  type MountTrialHistory,
  type TrialHistorySource,
  useMountedHistory,
} from '../trial/trialHistory';
import { undoShortcuts, useUndoKeys } from '../undo/useUndoKeys';
import type { LabProps } from './labProps';

const NO_INSTRUMENTS: InstrumentList = [];

/** `props` with `instruments` and `defaultInstrument` filled in: none, and the first of them. */
export function withInstruments(
  props: LabProps,
): LabProps & { instruments: InstrumentList; defaultInstrument: string } {
  const instruments = props.instruments ?? NO_INSTRUMENTS;
  return {
    ...props,
    instruments,
    defaultInstrument: props.defaultInstrument ?? instruments[0]?.name ?? '',
  };
}

function historyItems(
  history: TrialHistorySource,
  canUndo: boolean,
  canRedo: boolean,
): LabContribution[] {
  return [
    {
      id: 'lab.undo',
      region: 'header',
      group: 'history',
      item: {
        icon: icon('core:undo'),
        label: 'Undo',
        shortcut: undoShortcuts().undo,
        disabled: !canUndo,
        onActivate: () => history.undo(),
      },
    },
    {
      id: 'lab.redo',
      region: 'header',
      group: 'history',
      item: {
        icon: icon('core:redo'),
        label: 'Redo',
        shortcut: undoShortcuts().redo,
        disabled: !canRedo,
        onActivate: () => history.redo(),
      },
    },
  ];
}

/**
 * A lab with no trials stands in for the trial as the slot `useTrialHistory` hands a history to: the history mounted
 * last gets Undo and Redo at the start of the lab's header, and Mod+Z and Shift+Mod+Z. `mount` is null in a lab that
 * has trials, whose own slots take histories instead.
 */
export function useTriallessHistory(
  trialless: boolean,
  labChrome: readonly LabContribution[] | undefined,
): { mount: MountTrialHistory | null; labChrome: readonly LabContribution[] | undefined } {
  const { mount, history } = useMountedHistory();
  const held = trialless ? history : null;
  useUndoKeys(held);
  const canUndo = held?.canUndo() ?? false;
  const canRedo = held?.canRedo() ?? false;
  const merged = useMemo(
    () => (held ? [...historyItems(held, canUndo, canRedo), ...(labChrome ?? [])] : labChrome),
    [held, canUndo, canRedo, labChrome],
  );
  return { mount: trialless ? mount : null, labChrome: merged };
}
