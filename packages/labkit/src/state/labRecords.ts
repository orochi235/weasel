import type { LabDocument, SavedSnapshot, SerializedTrial } from './types';

/** Every record of the lab stored under `storageKey` starts with this. The key
 *  is URI-encoded, so it holds no `:` and one lab's prefix can never reach into
 *  another lab's records. */
export function labPrefix(storageKey: string): string {
  return `lk:${encodeURIComponent(storageKey)}:`;
}

export const META_RECORD = 'meta';
export const LAYOUT_RECORD = 'layout';
export const UNDOCK_RECORD = 'undock';

export function trialRecord(id: string): string {
  return `trial:${encodeURIComponent(id)}`;
}

export function saveRecord(id: string): string {
  return `save:${encodeURIComponent(id)}`;
}

/** The prefix every value scoped to one trial shares. */
export function trialValuesPrefix(trialId: string): string {
  return `value:trial:${encodeURIComponent(trialId)}:`;
}

/** Where a `usePersistedState` value lives: under its trial, or — with a null
 *  trial — under the lab. */
export function valueRecord(trialId: string | null, name: string): string {
  const encoded = encodeURIComponent(name);
  return trialId === null ? `value:lab:${encoded}` : `${trialValuesPrefix(trialId)}${encoded}`;
}

/** What a record name addresses, or null for a name no lab writes. */
export type RecordName =
  | { kind: 'meta' | 'layout' | 'undock' | 'value' }
  | { kind: 'trial' | 'save'; id: string };

export function parseRecordName(name: string): RecordName | null {
  const parts = name.split(':');
  try {
    switch (parts[0]) {
      case 'meta':
      case 'layout':
      case 'undock':
        return parts.length === 1 ? { kind: parts[0] } : null;
      case 'trial':
      case 'save':
        return parts.length === 2 && parts[1]
          ? { kind: parts[0], id: decodeURIComponent(parts[1]) }
          : null;
      case 'value':
        return (parts[1] === 'lab' && parts.length === 3) ||
          (parts[1] === 'trial' && parts.length === 4)
          ? { kind: 'value' }
          : null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/** The fields of the meta record. */
export interface LabMeta {
  version: number;
  mode: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** A document as the records a lab stores it in, `meta` last — so a write in
 *  this order that stops partway leaves no `meta`, and the next open folds the
 *  old storage again rather than trusting a partial set. */
export function recordsOfDocument(doc: LabDocument): [string, unknown][] {
  return [
    ...doc.trials.map((t, order): [string, unknown] => [trialRecord(t.id), { ...t, order }]),
    ...doc.saves.map((s): [string, unknown] => [saveRecord(s.id), s]),
    [LAYOUT_RECORD, doc.layout],
    [UNDOCK_RECORD, doc.undockedPanels],
    [META_RECORD, { version: doc.version, mode: doc.mode } satisfies LabMeta],
  ];
}

/** Records joined back into an unmigrated document, with each trial's stored
 *  order. Null when there is no `meta` record — no lab has been stored here in
 *  this form. */
export function documentOfRecords(
  entries: Iterable<[string, unknown]>,
): { doc: Record<string, unknown>; orders: Map<string, number> } | null {
  let meta: unknown;
  let layout: unknown;
  let undock: unknown;
  const trials: { trial: SerializedTrial; order: number }[] = [];
  const saves: SavedSnapshot[] = [];

  for (const [name, value] of entries) {
    const parsed = parseRecordName(name);
    if (!parsed) continue;
    switch (parsed.kind) {
      case 'meta':
        meta = value;
        break;
      case 'layout':
        layout = value;
        break;
      case 'undock':
        undock = value;
        break;
      case 'trial':
        if (isObject(value)) {
          const { order, ...rest } = value;
          trials.push({
            trial: { ...rest, id: parsed.id } as SerializedTrial,
            order: typeof order === 'number' && Number.isFinite(order) ? order : Infinity,
          });
        }
        break;
      case 'save':
        if (isObject(value)) saves.push({ ...value, id: parsed.id } as SavedSnapshot);
        break;
    }
  }
  if (!isObject(meta)) return null;

  trials.sort(compareTrialOrder);
  const orders = new Map<string, number>();
  let next = 0;
  for (const { trial, order } of trials) {
    const at = Number.isFinite(order) ? order : next;
    orders.set(trial.id, at);
    next = Math.max(next, at + 1);
  }
  saves.sort((a, b) => a.savedAt - b.savedAt);

  return {
    doc: {
      version: meta.version,
      mode: meta.mode,
      trials: trials.map((t) => t.trial),
      saves,
      layout,
      undockedPanels: undock,
    },
    orders,
  };
}

/** Stored order first; two trials added at once in two tabs can share an
 *  order, so the id breaks the tie the same way everywhere. */
export function compareTrialOrder(
  a: { trial: { id: string }; order: number },
  b: { trial: { id: string }; order: number },
): number {
  if (a.order !== b.order) return a.order < b.order ? -1 : 1;
  return a.trial.id < b.trial.id ? -1 : a.trial.id > b.trial.id ? 1 : 0;
}
