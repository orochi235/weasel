/** The shape `restore` needs of a serialized history before it reads one, which arrives from storage or the wire. */
import { isPlainObject } from '@weasel-js/registry';

const isId = (v: unknown): boolean => Number.isSafeInteger(v);
const isOptional = (v: unknown, ok: (v: unknown) => boolean): boolean => v === undefined || ok(v);
const isIdList = (v: unknown): boolean => Array.isArray(v) && v.every((s) => typeof s === 'string');
const isOps = (v: unknown): boolean => Array.isArray(v) && v.every((o) => isPlainObject(o) && typeof o.name === 'string');

function entryFault(e: unknown): string | null {
  if (!isPlainObject(e)) return 'is not an object';
  if (!isId(e.id)) return 'has no integer `id`';
  if (typeof e.label !== 'string') return 'has no string `label`';
  if (!isOps(e.forwardOps)) return 'has `forwardOps` that are not a list of named ops';
  if (!isOps(e.baseOps)) return 'has `baseOps` that are not a list of named ops';
  if (!isOptional(e.timestamp, Number.isFinite)) return 'has a `timestamp` that is not a finite number';
  if (!isOptional(e.pushes, (n) => Number.isSafeInteger(n) && (n as number) >= 1)) return 'has a `pushes` that is not a positive integer';
  if (!isOptional(e.selectionBefore, isIdList) || !isOptional(e.selectionAfter, isIdList)) return 'has a selection that is not a list of ids';
  return null;
}

function entriesFault(list: unknown, where: string): string | null {
  if (!Array.isArray(list)) return `${where} is not a list`;
  for (let i = 0; i < list.length; i++) {
    const fault = entryFault(list[i]);
    if (fault) return `${where} entry ${i} ${fault}`;
  }
  return null;
}

/** What is wrong with `snapshot` as a serialized history, or `null` when `restore` can read it. */
export function snapshotFault(snapshot: unknown): string | null {
  if (!isPlainObject(snapshot)) return 'it is not an object';
  if (snapshot.version !== 1) return `\`version\` is ${JSON.stringify(snapshot.version) ?? 'missing'}, not 1, the only version this reads`;
  if (!isId(snapshot.nextEntryId)) return '`nextEntryId` is not an integer';
  if (!isOptional(snapshot.floor, isId)) return '`floor` is not an integer';
  const fault = entriesFault(snapshot.undoStack, '`undoStack`') ?? entriesFault(snapshot.redoStack, '`redoStack`');
  if (fault) return fault;
  const lists = [snapshot.undoStack, snapshot.redoStack] as { id: number }[][];
  if (snapshot.branches !== undefined) {
    if (!Array.isArray(snapshot.branches)) return '`branches` is not a list';
    for (let i = 0; i < snapshot.branches.length; i++) {
      const b: unknown = snapshot.branches[i];
      if (!isPlainObject(b) || !isId(b.at)) return `branch ${i} has no integer \`at\``;
      const inner = entriesFault(b.entries, `branch ${i}'s \`entries\``);
      if (inner) return inner;
      if ((b.entries as unknown[]).length === 0) return `branch ${i} has no entries`;
      lists.push(b.entries as { id: number }[]);
    }
  }
  const seen = new Set<number>();
  for (const list of lists) {
    for (const { id } of list) {
      if (seen.has(id)) return `it names entry id ${id} more than once`;
      seen.add(id);
    }
  }
  return null;
}
