import { isPlainObject } from '@weasel-js/core';
import type { OwnedRecordCache, RecordCache, RecordChange } from '@weasel-js/storage';
import { isColorModePreference } from '@weasel-js/theme';
import { CURRENT_DOCUMENT_VERSION } from './document';
import { hydrateSnapshots, hydrateTrials, withoutUnreadable } from './hydrate';
import { compareTrialOrder, type LabMeta, parseRecordName } from './labRecords';
import type { PersistedState } from './labRecordWrites';
import { nextOrderIn } from './labRecordWrites';
import type {
  InstrumentHooks,
  SavedSnapshot,
  SerializedTrial,
  TrialRecord,
  UnreadableRecord,
} from './types';
import type { UndockedPanels } from './undock';
import { isFiniteNumber } from '@weasel-js/registry';

/**
 * `trials` with the record another tab wrote for trial `id`: replaced, added, or gone. The trial
 * hydrates with that tab's undo, which describes the state it wrote.
 */
function remoteTrial(
  hooks: InstrumentHooks,
  trials: TrialRecord[],
  id: string,
  value: unknown,
  orderOf: Map<string, number>,
  failed: (u: UnreadableRecord) => void,
): TrialRecord[] {
  if (!isPlainObject(value)) {
    orderOf.delete(id);
    return trials.filter((t) => t.id !== id);
  }
  const { order, ...rest } = value as SerializedTrial & { order?: unknown };
  orderOf.set(
    id,
    isFiniteNumber(order) ? order : nextOrderIn(orderOf),
  );
  const [replacement] = hydrateTrials([{ ...rest, id }], hooks.serializers, hooks, failed);
  // Kept, the stale trial's next edit would write over a record this tab cannot read.
  if (!replacement) return trials.filter((t) => t.id !== id);
  return trials.some((t) => t.id === id)
    ? trials.map((t) => (t.id === id ? replacement : t))
    : [...trials, replacement];
}

/** `saves` with the record another tab wrote for snapshot `id`: replaced, added, or gone. */
function remoteSnapshot(
  hooks: InstrumentHooks,
  saves: SavedSnapshot[],
  id: string,
  value: unknown,
  failed: (u: UnreadableRecord) => void,
): SavedSnapshot[] {
  if (!isPlainObject(value)) return saves.filter((s) => s.id !== id);
  const [snapshot] = hydrateSnapshots([{ ...value, id } as SavedSnapshot], hooks, failed);
  if (!snapshot) return saves;
  return saves.some((s) => s.id === id)
    ? saves.map((s) => (s.id === id ? snapshot : s))
    : [...saves, snapshot];
}

/** The color mode another tab wrote in the lab's meta record, if it is one; stops `records` writing when that tab
 *  runs a newer labkit. */
function remoteMode(records: RecordCache, value: unknown): PersistedState['mode'] | undefined {
  const meta = value as Partial<LabMeta> | undefined;
  if (typeof meta?.version === 'number' && meta.version > CURRENT_DOCUMENT_VERSION) {
    console.warn('[labkit] another tab wrote this lab with a newer labkit; no longer persisting');
    if ('stopWriting' in records) (records as OwnedRecordCache).stopWriting();
    return undefined;
  }
  return isColorModePreference(meta?.mode) ? meta.mode : undefined;
}

/** `current` with the records other tabs wrote: what the store is set to so it holds them. */
export function remoteState(
  current: PersistedState,
  hooks: () => InstrumentHooks,
  records: RecordCache,
  remote: readonly RecordChange[],
  orderOf: Map<string, number>,
): Partial<PersistedState> {
  let trials = current.trials;
  let saves = current.savedSnapshots;
  let unreadable = current.unreadable;
  const failed = (u: UnreadableRecord): void => {
    unreadable = [...unreadable, u];
  };
  const patch: Partial<Pick<PersistedState, 'layout' | 'undockedPanels' | 'mode'>> = {};

  for (const { name, value } of remote) {
    const parsed = parseRecordName(name);
    if (!parsed) continue;
    switch (parsed.kind) {
      case 'trial':
        unreadable = withoutUnreadable(unreadable, 'trial', parsed.id);
        trials = remoteTrial(hooks(), trials, parsed.id, value, orderOf, failed);
        break;
      case 'save':
        unreadable = withoutUnreadable(unreadable, 'snapshot', parsed.id);
        saves = remoteSnapshot(hooks(), saves, parsed.id, value, failed);
        break;
      case 'layout':
        patch.layout = isPlainObject(value) ? value : {};
        break;
      case 'undock':
        patch.undockedPanels = isPlainObject(value) ? (value as UndockedPanels) : {};
        break;
      case 'meta': {
        const mode = remoteMode(records, value);
        if (mode !== undefined) patch.mode = mode;
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
  return { ...patch, trials, savedSnapshots: saves, unreadable };
}
