import type { OwnedRecordCache, RecordCache } from '@weasel-js/storage';
import { CURRENT_DOCUMENT_VERSION } from './document';
import { serializeTrials } from './helpers';
import { hydrateSnapshots, hydrateTrials } from './hydrate';
import {
  compareTrialOrder,
  LAYOUT_RECORD,
  type LabMeta,
  META_RECORD,
  parseRecordName,
  saveRecord,
  trialRecord,
  trialValuesPrefix,
  UNDOCK_RECORD,
} from './labRecords';
import type { LabStore } from './store';
import type { SavedSnapshot, SerializedTrial, TrialRecord } from './types';

export interface BindOptions {
  orders: Map<string, number>;
  /** What the store holds that the records do not: written once, at binding. */
  unsaved?: {
    trials: readonly string[];
    saves: readonly string[];
    layout: boolean;
    undock: boolean;
    mode: boolean;
  };
}

function persistedFieldsDiffer(a: TrialRecord, b: TrialRecord): boolean {
  if (a === b) return false;
  const left = a as unknown as Record<string, unknown>;
  const right = b as unknown as Record<string, unknown>;
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (key !== 'history' && !Object.is(left[key], right[key])) return true;
  }
  return false;
}

/** Keep `store` and `records` in step, both ways. Returns the unbinding. */
export function bindLabStore(
  store: LabStore,
  records: RecordCache,
  options: BindOptions,
): () => void {
  const orderOf = new Map(options.orders);
  let applyingRemote = false;

  const nextOrder = (): number => {
    let max = -1;
    for (const order of orderOf.values()) max = Math.max(max, order);
    return max + 1;
  };

  const writeTrial = (trial: TrialRecord): void => {
    const [serialized] = serializeTrials([trial], store.getState().instrumentHooks().serializers);
    records.set(trialRecord(trial.id), { ...serialized, order: orderOf.get(trial.id) });
  };

  const inStoredOrder = (trials: TrialRecord[]): boolean => {
    for (let i = 1; i < trials.length; i++) {
      const a = trials[i - 1] as TrialRecord;
      const b = trials[i] as TrialRecord;
      const at = { trial: a, order: orderOf.get(a.id) ?? 0 };
      const bt = { trial: b, order: orderOf.get(b.id) ?? 0 };
      if (compareTrialOrder(at, bt) >= 0) return false;
    }
    return true;
  };

  const offStore = store.subscribe((state, prev) => {
    if (applyingRemote) return;
    let wrote = false;

    if (state.trials !== prev.trials) {
      const before = new Map(prev.trials.map((t) => [t.id, t]));
      const now = new Set(state.trials.map((t) => t.id));
      for (const t of prev.trials) {
        if (now.has(t.id)) continue;
        records.delete(trialRecord(t.id));
        for (const [name] of records.entries(trialValuesPrefix(t.id))) records.delete(name);
        orderOf.delete(t.id);
        wrote = true;
      }
      const added = state.trials.filter((t) => !before.has(t.id));
      for (const t of added) orderOf.set(t.id, nextOrder());
      if (inStoredOrder(state.trials)) {
        for (const t of state.trials) {
          const old = before.get(t.id);
          if (old && !persistedFieldsDiffer(old, t)) continue;
          writeTrial(t);
          wrote = true;
        }
      } else {
        // A reorder, or a trial inserted mid-list: renumber them all.
        for (const [i, t] of state.trials.entries()) orderOf.set(t.id, i);
        for (const t of state.trials) writeTrial(t);
        wrote = true;
      }
    }

    if (state.savedSnapshots !== prev.savedSnapshots) {
      const before = new Map(prev.savedSnapshots.map((s) => [s.id, s]));
      const now = new Set(state.savedSnapshots.map((s) => s.id));
      for (const s of state.savedSnapshots) {
        if (before.get(s.id) === s) continue;
        records.set(saveRecord(s.id), s);
        wrote = true;
      }
      for (const s of prev.savedSnapshots) {
        if (now.has(s.id)) continue;
        records.delete(saveRecord(s.id));
        wrote = true;
      }
    }

    if (state.layout !== prev.layout) {
      records.set(LAYOUT_RECORD, state.layout);
      wrote = true;
    }
    if (state.undockedPanels !== prev.undockedPanels) {
      records.set(UNDOCK_RECORD, state.undockedPanels);
      wrote = true;
    }
    if (state.mode !== prev.mode || (wrote && !records.has(META_RECORD))) {
      records.set(META_RECORD, {
        version: CURRENT_DOCUMENT_VERSION,
        mode: state.mode,
      } satisfies LabMeta);
    }
  });

  const offRecords = records.subscribe((changes) => {
    const remote = changes.filter((c) => c.origin === 'remote');
    if (remote.length === 0) return;

    const current = store.getState();
    let trials = current.trials;
    let saves = current.savedSnapshots;
    const patch: Partial<Pick<typeof current, 'layout' | 'undockedPanels' | 'mode'>> = {};

    for (const { name, value } of remote) {
      const parsed = parseRecordName(name);
      if (!parsed) continue;
      switch (parsed.kind) {
        case 'trial': {
          const id = parsed.id;
          if (value === undefined || !value || typeof value !== 'object') {
            trials = trials.filter((t) => t.id !== id);
            orderOf.delete(id);
            break;
          }
          const { order, ...rest } = value as SerializedTrial & { order?: unknown };
          orderOf.set(
            id,
            typeof order === 'number' && Number.isFinite(order) ? order : nextOrder(),
          );
          // Hydrating starts an empty undo history: the old one describes a
          // state that no longer exists.
          const hooks = store.getState().instrumentHooks();
          const [replacement] = hydrateTrials([{ ...rest, id }], hooks.serializers, hooks);
          if (!replacement) {
            // Kept, the stale trial's next edit would write over a record this tab cannot read.
            trials = trials.filter((t) => t.id !== id);
            break;
          }
          trials = trials.some((t) => t.id === id)
            ? trials.map((t) => (t.id === id ? replacement : t))
            : [...trials, replacement];
          break;
        }
        case 'save': {
          const id = parsed.id;
          if (value === undefined || !value || typeof value !== 'object') {
            saves = saves.filter((s) => s.id !== id);
            break;
          }
          const [snapshot] = hydrateSnapshots(
            [{ ...(value as SavedSnapshot), id }],
            store.getState().instrumentHooks(),
          );
          if (!snapshot) break;
          saves = saves.some((s) => s.id === id)
            ? saves.map((s) => (s.id === id ? snapshot : s))
            : [...saves, snapshot];
          break;
        }
        case 'layout':
          patch.layout = (value as Record<string, unknown> | undefined) ?? {};
          break;
        case 'undock':
          patch.undockedPanels = (value as typeof current.undockedPanels | undefined) ?? {};
          break;
        case 'meta': {
          const meta = value as Partial<LabMeta> | undefined;
          if (typeof meta?.version === 'number' && meta.version > CURRENT_DOCUMENT_VERSION) {
            console.warn(
              '[labkit] another tab wrote this lab with a newer labkit; no longer persisting',
            );
            if ('stopWriting' in records) (records as OwnedRecordCache).stopWriting();
            break;
          }
          if (meta?.mode === 'light' || meta?.mode === 'dark' || meta?.mode === 'auto') {
            patch.mode = meta.mode;
          }
          break;
        }
      }
    }

    if (trials !== current.trials) {
      trials = [...trials].sort((a, b) =>
        compareTrialOrder(
          { trial: a, order: orderOf.get(a.id) ?? 0 },
          { trial: b, order: orderOf.get(b.id) ?? 0 },
        ),
      );
    }
    applyingRemote = true;
    try {
      store.setState({ ...patch, trials, savedSnapshots: saves });
    } finally {
      applyingRemote = false;
    }
  });

  const { unsaved } = options;
  if (unsaved) {
    const state = store.getState();
    let wrote = unsaved.layout || unsaved.undock;
    for (const t of state.trials) {
      if (!unsaved.trials.includes(t.id)) continue;
      orderOf.set(t.id, nextOrder());
      writeTrial(t);
      wrote = true;
    }
    for (const s of state.savedSnapshots) {
      if (!unsaved.saves.includes(s.id)) continue;
      records.set(saveRecord(s.id), s);
      wrote = true;
    }
    if (unsaved.layout) records.set(LAYOUT_RECORD, state.layout);
    if (unsaved.undock) records.set(UNDOCK_RECORD, state.undockedPanels);
    if (unsaved.mode || (wrote && !records.has(META_RECORD))) {
      records.set(META_RECORD, {
        version: CURRENT_DOCUMENT_VERSION,
        mode: state.mode,
      } satisfies LabMeta);
    }
  }

  return () => {
    offStore();
    offRecords();
  };
}
