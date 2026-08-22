import { ThemeProvider } from '@weasel-js/theme/react';
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand/react';
import type { InstrumentList } from '../instrument/types';
import { noneAdapter } from '../state/adapters';
import { LabStoreContext } from '../state/context';
import { createLabStore, type LabStore } from '../state/store';
import type { LabMode, StorageAdapter, TrialRecord } from '../state/types';
import { interstellarTheme } from '../theme/interstellar';
import { Trial } from '../trial/Trial';
import {
  addTrial as addTrialOp,
  cloneTrial as cloneTrialOp,
  closeTrial as closeTrialOp,
  reorderTrials as reorderTrialsOp,
  resetTrial as resetTrialOp,
} from '../trial/trialOps';
import { LabContext, type LabContextValue } from './LabContext';
import { LabShell } from './LabShell';
import { useResolvedMode } from './useSystemMode';
import { type TrialLayout, Workspace } from './Workspace';

/** Props for `<Lab>`. */
export interface LabProps {
  instruments: InstrumentList;
  defaultInstrument: string;
  storage?: StorageAdapter | null;
  storageKey?: string;
  mode?: LabMode;
  /**
   * Optional list of CSS colors used to compose the interstellar theme's
   * cosmic backdrop. Each color becomes one radial-gradient blob on the
   * dark void base. Order maps to a fixed spread of positions; extras wrap
   * around. Ignored unless the resolved mode is dark.
   */
  nebula?: readonly string[];
  title?: string;
  children?: ReactNode;
}

function buildStore(
  instruments: InstrumentList,
  defaultInstrument: string,
  storage: StorageAdapter,
  storageKey: string,
  initialMode: LabMode,
): LabStore {
  const store = createLabStore({ storageKey, storage, initialMode });
  if (store.getState().trials.length === 0) {
    const seeded = addTrialOp([], instruments, defaultInstrument);
    const record = seeded[0];
    if (record) {
      const { undoStack: _undoStack, ...rest } = record;
      store.getState().addTrial(rest);
    }
  }
  return store;
}

// Fixed spread of nebula blob positions / sizes / fall-off stops. Colors
// supplied via the `nebula` prop are slotted into these slots in order;
// callers passing more than 5 wrap around (intentional — keeps the look
// readable and bounded).
const NEBULA_SLOTS = [
  { cx: '18%', cy: '30%', sx: '60%', sy: '80%', stop: '70%' },
  { cx: '78%', cy: '70%', sx: '55%', sy: '90%', stop: '65%' },
  { cx: '50%', cy: '50%', sx: '50%', sy: '70%', stop: '75%' },
  { cx: '12%', cy: '82%', sx: '50%', sy: '70%', stop: '70%' },
  { cx: '85%', cy: '18%', sx: '55%', sy: '80%', stop: '70%' },
] as const;

function buildNebula(colors: readonly string[]): string {
  const blobs = colors.map((c, i) => {
    const p = NEBULA_SLOTS[i % NEBULA_SLOTS.length];
    return `radial-gradient(ellipse ${p.sx} ${p.sy} at ${p.cx} ${p.cy}, color-mix(in srgb, ${c} 22%, transparent), transparent ${p.stop})`;
  });
  blobs.push('radial-gradient(ellipse at center, #0a0a18 0%, #02020a 100%)');
  return blobs.join(', ');
}

/** The lab runtime: creates the store, provides it, and renders one trial
 *  per record in a grid. Each trial runs one of `instruments`. */
export function Lab({
  instruments,
  defaultInstrument,
  storage,
  storageKey,
  mode,
  nebula,
  title,
  children,
}: LabProps) {
  if (process.env.NODE_ENV !== 'production' && instruments.length === 0) {
    throw new Error('[labkit] <Lab> requires a non-empty `instruments` array');
  }

  const storeRef = useRef<LabStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = buildStore(
      instruments,
      defaultInstrument,
      storage ?? noneAdapter,
      storageKey ?? 'labkit',
      mode ?? 'auto',
    );
  }
  const store = storeRef.current;

  const trials = useStore(store, (s) => s.trials);
  const savedSnapshots = useStore(store, (s) => s.savedSnapshots);
  const modeValue = useStore(store, (s) => s.mode);
  const layout = useStore(store, (s) => s.layout);
  const resolvedMode = useResolvedMode(modeValue);

  useEffect(() => {
    if (mode && mode !== store.getState().mode) {
      store.getState().setMode(mode);
    }
  }, [mode, store]);

  const contextValue = useMemo<LabContextValue>(() => {
    const replaceTrials = (next: TrialRecord[]): void => {
      const currentById = new Map(store.getState().trials.map((w) => [w.id, w]));
      const merged = next.map((w) => currentById.get(w.id) ?? w);
      store.setState({ trials: merged });
      // Trigger persistence flush via a tracked action.
      store.getState().setMode(store.getState().mode);
    };

    return {
      instruments,
      trials,
      addTrial: (instrumentName) => {
        const next = addTrialOp(store.getState().trials, instruments, instrumentName);
        replaceTrials(next);
      },
      cloneTrial: (id) => {
        const next = cloneTrialOp(store.getState().trials, id);
        replaceTrials(next);
      },
      closeTrial: (id) => {
        const next = closeTrialOp(store.getState().trials, id);
        replaceTrials(next);
      },
      reorderTrials: (ids) => {
        replaceTrials(reorderTrialsOp(store.getState().trials, ids));
      },
      resetTrial: (id) => {
        const next = resetTrialOp(store.getState().trials, id, instruments);
        const record = next.find((w) => w.id === id);
        if (!record) return;
        store.setState((s) => ({
          trials: s.trials.map((w) =>
            w.id === id
              ? { ...w, config: record.config, state: record.state, view: record.view }
              : w,
          ),
        }));
        store.getState().updateTrialView(id, record.view);
      },
      savedSnapshots,
      saveSnapshot: (trialId, name) => {
        store.getState().saveSnapshot(trialId, name ?? `Save ${new Date().toLocaleString()}`);
      },
      loadSnapshot: (trialId, snapshotId) => {
        store.getState().loadSnapshot(snapshotId, trialId);
      },
      deleteSnapshot: (snapshotId) => {
        store.getState().deleteSnapshot(snapshotId);
      },
      mode: modeValue,
      setMode: (m) => {
        store.getState().setMode(m);
      },
    };
  }, [instruments, trials, savedSnapshots, modeValue, store]);

  // Only override the backdrop in dark, where there is one to override.
  // Setting a CSS custom property is the sanctioned use of inline style.
  const backdropStyle =
    resolvedMode === 'dark' && nebula && nebula.length > 0
      ? ({ ['--wzl-backdrop' as string]: buildNebula(nebula) } as CSSProperties)
      : undefined;

  return (
    <LabStoreContext.Provider value={{ store }}>
      <LabContext.Provider value={contextValue}>
        <ThemeProvider
          theme={interstellarTheme}
          mode={resolvedMode}
          className="lk-lab"
          style={backdropStyle}
        >
          <LabShell title={title ?? 'Labkit'} mode={modeValue} header={children}>
            <Workspace
              ids={trials.map((w) => w.id)}
              resizable
              reorderable
              onReorder={(ids) => contextValue.reorderTrials(ids)}
              layout={layout as TrialLayout}
              onLayoutChange={(next) => store.getState().setLayout(next)}
            >
              {trials.map((w) => (
                <Trial key={w.id} id={w.id} />
              ))}
            </Workspace>
          </LabShell>
        </ThemeProvider>
      </LabContext.Provider>
    </LabStoreContext.Provider>
  );
}
