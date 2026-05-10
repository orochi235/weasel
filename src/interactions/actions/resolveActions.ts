/**
 * Pure resolver for the `actions` prop. Given a `StandardActionsDeps`-shaped
 * deps bundle, the consumer's `actions` prop, and the `defaults` overrides
 * (cloneObject / nudgeStep / etc.), produces the final `Action[]` per spec
 * §D resolution rules.
 *
 * No React imports — `<SceneCanvas>` and `useStandardActions` both wrap this
 * with their own memoization and ref-stabilization.
 *
 * Spec: docs/superpowers/specs/2026-05-09-actions-registry-design.md §D.
 */
import {
  defaultDuplicateAction,
  defaultEscapeAction,
  defaultNudgeActions,
  defaultReorderActions,
  defaultSelectAllAction,
  type NudgeDeps,
} from './defaults';
import type {
  Action,
  ActionEntry,
  ActionsProp,
} from './registry';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';

export interface StandardActionsDeps<TPose> {
  getSelection: () => NodeId[];
  setSelection: (ids: NodeId[]) => void;
  listAll: () => NodeId[];
  getPose: (id: NodeId) => TPose;
  applyBatch: (ops: Op[], label?: string) => void;
  translatePose: (pose: TPose, dx: number, dy: number) => TPose;
}

export interface StandardActionDefaults<TPose> {
  cloneObject?: (id: NodeId, offset: { dx: number; dy: number }) => { id: NodeId };
  duplicateOffset?: { dx: number; dy: number };
  nudgeStep?: number;
  nudgeShiftStep?: number;
  /** TPose-typed slot to keep the generic anchored; unused at runtime. */
  _phantom?: TPose;
}

const warnedMissingDefault = new Set<string>();

export function resetActionResolverWarnings(): void {
  warnedMissingDefault.clear();
}

export function resolveActions<TPose>(
  deps: StandardActionsDeps<TPose>,
  options?: {
    actions?: ActionsProp;
    defaults?: StandardActionDefaults<TPose>;
  },
): Action[] {
  const actions = options?.actions;
  const actionDefaults = options?.defaults;
  if (actions === null) return [];

  const defaults: Record<string, Action> = {
    selectAll: defaultSelectAllAction({
      getSelection: deps.getSelection,
      listAll: deps.listAll,
      setSelection: deps.setSelection,
    }),
    escape: defaultEscapeAction({
      getSelection: deps.getSelection,
      setSelection: deps.setSelection,
    }),
    ...(actionDefaults?.cloneObject
      ? {
          duplicate: defaultDuplicateAction({
            getSelection: deps.getSelection,
            applyBatch: deps.applyBatch,
            cloneObject: actionDefaults.cloneObject,
            ...(actionDefaults.duplicateOffset !== undefined
              ? { offset: actionDefaults.duplicateOffset }
              : {}),
          }),
        }
      : {}),
  };

  const nudgeDeps: NudgeDeps<TPose> = {
    getSelection: deps.getSelection,
    getPose: deps.getPose,
    applyBatch: deps.applyBatch,
    translatePose: deps.translatePose,
    ...(actionDefaults?.nudgeStep !== undefined ? { step: actionDefaults.nudgeStep } : {}),
    ...(actionDefaults?.nudgeShiftStep !== undefined
      ? { shiftStep: actionDefaults.nudgeShiftStep }
      : {}),
  };
  for (const a of defaultNudgeActions<TPose>(nudgeDeps)) defaults[a.id] = a;

  for (const a of defaultReorderActions({
    getSelection: deps.getSelection,
    applyBatch: deps.applyBatch,
  })) {
    defaults[a.id] = a;
  }

  if (actions) {
    for (const [id, entry] of Object.entries(actions)) applyEntry(defaults, id, entry);
  }

  return Object.values(defaults);
}

function applyEntry(
  defaults: Record<string, Action>,
  id: string,
  entry: ActionEntry,
): void {
  if (entry === null) {
    delete defaults[id];
    return;
  }
  const isFull = (e: Partial<Action>): e is Action =>
    typeof e.id === 'string' && typeof e.label === 'string' && typeof e.run === 'function';
  // Full descriptor for a *new* slot id (entry.id matches slot key, or no
  // default exists for this slot): register as-is.
  if (isFull(entry) && (!(id in defaults) || entry.id === id)) {
    defaults[id] = entry;
    return;
  }
  if (id in defaults) {
    // Slot key wins over entry.id. Drop entry.id; merge the rest onto the
    // default. Warn once when the consumer passed an explicit-but-mismatched id.
    if (entry.id !== undefined && entry.id !== id && !warnedMissingDefault.has(`mismatch:${id}`)) {
      warnedMissingDefault.add(`mismatch:${id}`);
      console.warn(
        `weasel actions resolver: actions["${id}"].id="${entry.id}" mismatches the slot key. ` +
        `Ignoring the id field; the action remains at id="${id}".`,
      );
    }
    const { id: _drop, ...rest } = entry;
    void _drop;
    defaults[id] = { ...defaults[id], ...rest };
    return;
  }
  if (!warnedMissingDefault.has(id)) {
    warnedMissingDefault.add(id);
    console.warn(
      `weasel actions resolver: actions["${id}"] is a partial Action but no default ` +
      `with this id exists. Pass a complete {id, label, defaultBinding, run} descriptor.`,
    );
  }
}
