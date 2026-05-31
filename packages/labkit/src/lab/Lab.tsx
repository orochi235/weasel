import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand/react';
import type { Instrument } from '../instrument/types';
import { noneAdapter } from '../state/adapters';
import { LabStoreContext } from '../state/context';
import { createLabStore, type LabStore } from '../state/store';
import type { StorageAdapter, WorkspaceRecord } from '../state/types';
import { Workspace } from '../workspace/Workspace';
import {
  addWorkspace as addWorkspaceOp,
  cloneWorkspace as cloneWorkspaceOp,
  closeWorkspace as closeWorkspaceOp,
  resetWorkspace as resetWorkspaceOp,
} from '../workspace/workspaceOps';
import { LabContext, type LabContextValue } from './LabContext';
import { LabShell } from './LabShell';
import { WorkspaceGrid } from './WorkspaceGrid';

export interface LabProps {
  instruments: Instrument[];
  defaultInstrument: string;
  storage?: StorageAdapter | null;
  storageKey?: string;
  theme?: 'auto' | 'light' | 'interstellar';
  /**
   * Optional list of CSS colors used to compose the interstellar theme's
   * cosmic backdrop. Each color becomes one radial-gradient blob on the
   * dark void base. Order maps to a fixed spread of positions; extras wrap
   * around. Ignored unless `theme="interstellar"` is active.
   */
  nebula?: readonly string[];
  title?: string;
  children?: ReactNode;
}

function buildStore(
  instruments: Instrument[],
  defaultInstrument: string,
  storage: StorageAdapter,
  storageKey: string,
  initialTheme: 'auto' | 'light' | 'interstellar',
): LabStore {
  const store = createLabStore({ storageKey, storage, initialTheme });
  if (store.getState().workspaces.length === 0) {
    const seeded = addWorkspaceOp([], instruments, defaultInstrument);
    const record = seeded[0];
    if (record) {
      const { undoStack: _undoStack, ...rest } = record;
      store.getState().addWorkspace(rest);
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
    const p = NEBULA_SLOTS[i % NEBULA_SLOTS.length]!;
    return `radial-gradient(ellipse ${p.sx} ${p.sy} at ${p.cx} ${p.cy}, color-mix(in srgb, ${c} 22%, transparent), transparent ${p.stop})`;
  });
  blobs.push('radial-gradient(ellipse at center, #0a0a18 0%, #02020a 100%)');
  return blobs.join(', ');
}

export function Lab({
  instruments,
  defaultInstrument,
  storage,
  storageKey,
  theme,
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
      theme ?? 'auto',
    );
  }
  const store = storeRef.current;

  const workspaces = useStore(store, (s) => s.workspaces);
  const savedSnapshots = useStore(store, (s) => s.savedSnapshots);
  const themeValue = useStore(store, (s) => s.theme);

  useEffect(() => {
    if (theme && theme !== store.getState().theme) {
      store.getState().setTheme(theme);
    }
  }, [theme, store]);

  const contextValue = useMemo<LabContextValue>(() => {
    const replaceWorkspaces = (next: WorkspaceRecord[]): void => {
      const currentById = new Map(store.getState().workspaces.map((w) => [w.id, w]));
      const merged = next.map((w) => currentById.get(w.id) ?? w);
      store.setState({ workspaces: merged });
      // Trigger persistence flush via a tracked action.
      store.getState().setTheme(store.getState().theme);
    };

    return {
      instruments,
      workspaces,
      addWorkspace: (instrumentName) => {
        const next = addWorkspaceOp(store.getState().workspaces, instruments, instrumentName);
        replaceWorkspaces(next);
      },
      cloneWorkspace: (id) => {
        const next = cloneWorkspaceOp(store.getState().workspaces, id);
        replaceWorkspaces(next);
      },
      closeWorkspace: (id) => {
        const next = closeWorkspaceOp(store.getState().workspaces, id);
        replaceWorkspaces(next);
      },
      resetWorkspace: (id) => {
        const next = resetWorkspaceOp(store.getState().workspaces, id, instruments);
        const record = next.find((w) => w.id === id);
        if (!record) return;
        store.setState((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === id
              ? { ...w, config: record.config, state: record.state, view: record.view }
              : w,
          ),
        }));
        store.getState().updateWorkspaceView(id, record.view);
      },
      savedSnapshots,
      saveSnapshot: (workspaceId, name) => {
        store.getState().saveSnapshot(workspaceId, name ?? `Save ${new Date().toLocaleString()}`);
      },
      loadSnapshot: (workspaceId, snapshotId) => {
        store.getState().loadSnapshot(snapshotId, workspaceId);
      },
      deleteSnapshot: (snapshotId) => {
        store.getState().deleteSnapshot(snapshotId);
      },
      theme: themeValue,
      setTheme: (t) => {
        store.getState().setTheme(t);
      },
    };
  }, [instruments, workspaces, savedSnapshots, themeValue, store]);

  const themeClass =
    themeValue === 'light'
      ? 'lk-theme-light'
      : themeValue === 'interstellar'
        ? 'lk-theme-interstellar'
        : '';

  // Only apply the nebula override when interstellar is active and at
  // least one color is provided. Setting a CSS custom property is the
  // sanctioned use of inline style.
  const nebulaStyle =
    themeValue === 'interstellar' && nebula && nebula.length > 0
      ? ({ ['--lk-space-nebula' as string]: buildNebula(nebula) } as CSSProperties)
      : undefined;

  return (
    <LabStoreContext.Provider value={{ store }}>
      <LabContext.Provider value={contextValue}>
        <div className={`lk-lab ${themeClass}`.trim()} style={nebulaStyle}>
          <LabShell title={title ?? 'Labkit'} theme={themeValue} header={children}>
            <WorkspaceGrid>
              {workspaces.map((w) => (
                <Workspace key={w.id} id={w.id} />
              ))}
            </WorkspaceGrid>
          </LabShell>
        </div>
      </LabContext.Provider>
    </LabStoreContext.Provider>
  );
}
