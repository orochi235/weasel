/**
 * The last operation: the latest run of an action that declares `params` and
 * committed one history entry, kept so its params can be changed after the
 * fact. A change undoes that entry and runs the action again in its place: an
 * immediate action is run again with the params it was handed, and a gesture
 * is replayed by its handle (`OngoingHandle.replay`).
 */
import type { History } from '@weasel-js/history';
import { prefLeaves, type PrefGroup } from '@weasel-js/prefs';
import { createEmitter } from '@weasel-js/registry';
import type { Action } from './action';
import { resolveParams, type ImmediateInvoker, type OngoingHandle, type OngoingInvoker } from './invoker';
import type { ActionTuning } from './tuning';

/** One operation that can still be adjusted. */
export interface LastOperation {
  id: string;
  label: string;
  /** The action's `params` form. */
  schema: PrefGroup;
  /** What it ran with, one value per leaf of `schema`, by the leaf's path. */
  values: Readonly<Record<string, unknown>>;
}

/** The last operation of one actions tree, and the two things to do with it. */
export interface LastOperationStore {
  /** The operation, or `null` once anything else reached the history, or it was dismissed. */
  get(): LastOperation | null;
  subscribe(listener: () => void): () => void;
  /**
   * Undo the operation's entry, put back the selection it ran on, and run it again with `patch` laid over its
   * values (a gesture is replayed by its handle), keeping the entry that makes in place of the old one: the history still holds one entry for it. The
   * merged values become the action's params for the rest of the session, under any tuning. Returns whether it
   * ran.
   */
  adjust(patch: Readonly<Record<string, unknown>>): boolean;
  /** Forget the operation; the scene and the history stay as they are. */
  dismiss(): void;
}

/** Every selection a host holds, captured: calling what `take` returns puts all of it back. */
export interface SelectionSnapshotDep {
  take(): () => void;
}

/** What the store reads from the scope an operation ran in. */
export interface LastOperationHost {
  history(): History | null;
  takeSelection(): (() => void) | null;
  /** The params a run of `id` handed `given` starts with: every tuning's, `given` laid over them. */
  paramsOf(id: string, given: Record<string, unknown> | undefined): Record<string, unknown>;
  /** Run the action live for `id` here with `params`, as `trigger` would. */
  rerun(id: string, params: Record<string, unknown>): void;
}

interface Held {
  op: LastOperation;
  entry: number | null;
  history: History;
  restore: (() => void) | null;
  /** Run the operation again with `values`, laid over what its first run was handed beyond them, such as the
   *  point a binding carried. */
  rerun: (values: Record<string, unknown>) => void;
  unobserve: () => void;
}

/** Watch `history` from now: `stop` answers the id of the entry pushed meanwhile when exactly one was, later
 *  pushes having coalesced into it, and nothing else changed the history. Seals first, so the entry stands alone
 *  rather than coalescing into the one before it. */
function watchEntry(history: History): { stop(): number | null } {
  history.seal();
  let entry: number | null = null;
  let clean = true;
  const off = history.observe((step) => {
    if (step.kind === 'push' && entry === null && step.entries.length === 1) entry = step.entries[0]!.id;
    else if (!(step.kind === 'coalesce' && step.entries[0]?.id === entry && entry !== null)) clean = false;
  });
  return {
    stop: () => {
      off();
      return clean ? entry : null;
    },
  };
}

/** Run `run`, and the id of the entry it pushed as {@link watchEntry} counts it. */
function soleEntry<T>(history: History, run: () => T): { out: T; entry: number | null } {
  const watch = watchEntry(history);
  let out: T;
  try {
    out = run();
  } catch (err) {
    watch.stop();
    throw err;
  }
  return { out, entry: watch.stop() };
}

/** `params`, reduced to the leaves of `schema`, each filled from its default where `params` has none. */
function formValues(schema: PrefGroup, params: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, leaf] of prefLeaves(schema)) out[path] = params[path] !== undefined ? params[path] : leaf.default;
  return out;
}

function without(params: Record<string, unknown> | undefined, keys: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params ?? {})) if (!(k in keys)) out[k] = v;
  return out;
}

/** The store one actions tree keeps at its root. `onSession` is told when an action's session params change. */
export class LastOperationKeeper implements LastOperationStore {
  private held: Held | null = null;
  private busy = false;
  private readonly listeners = createEmitter();
  private readonly session = new Map<string, ActionTuning>();

  constructor(private readonly onSession: () => void) {}

  readonly get = (): LastOperation | null => this.held?.op ?? null;

  readonly subscribe = (listener: () => void): (() => void) => this.listeners.subscribe(listener);

  readonly dismiss = (): void => {
    const held = this.held;
    if (!held) return;
    this.held = null;
    held.unobserve();
    this.listeners.emit();
  };

  readonly adjust = (patch: Readonly<Record<string, unknown>>): boolean => {
    const held = this.held;
    if (!held || this.busy) return false;
    const { history } = held;
    if (held.entry !== null && history.entries().undo.at(-1)?.id !== held.entry) {
      this.dismiss();
      return false;
    }
    const values = formValues(held.op.schema, { ...held.op.values, ...patch });
    this.busy = true;
    try {
      if (held.entry !== null) history.undo();
      held.restore?.();
      held.entry = soleEntry(history, () => {
        try {
          held.rerun(values);
        } catch (err) {
          console.error(`weasel last operation: rerunning "${held.op.id}" threw`, err);
        }
      }).entry;
    } finally {
      this.busy = false;
    }
    held.op = { ...held.op, values };
    this.remember(held.op.id, values);
    this.listeners.emit();
    return true;
  };

  /** The tuning holding `id`'s session params, laid under every other; `null` before it has any. */
  sessionTuning(id: string): ActionTuning | null {
    return this.session.get(id) ?? null;
  }

  /** `action` with its run kept as the last operation when it commits one entry: an immediate action declaring
   *  `params`, or an ongoing one declaring them whose gesture's handle can `replay`, and in either case only a
   *  run its `params` answers a form for. Any other action comes back as it is. */
  wrap(action: Action, host: LastOperationHost): Action {
    const { params: form, invoker } = action;
    if (!form || !invoker) return action;
    const schemaOf = typeof form === 'function' ? form : () => form;
    if (invoker.timing === 'ongoing') return { ...action, invoker: this.ongoing(action.id, action.label, schemaOf, invoker, host) };
    const run: ImmediateInvoker['run'] = (deps, given) => {
      const history = this.busy ? null : host.history();
      if (!history) return invoker.run(deps, given);
      const resolved = host.paramsOf(action.id, given);
      const schema = schemaOf(resolved);
      if (!schema) return invoker.run(deps, given);
      const restore = host.takeSelection();
      const values = formValues(schema, resolved);
      const { out, entry } = soleEntry(history, () => invoker.run(deps, given));
      if (entry !== null && out !== 'pass') {
        const rest = without(given, values);
        const op = { id: action.id, label: action.label, schema, values };
        this.hold({ op, entry, history, restore, rerun: (v) => host.rerun(action.id, { ...rest, ...v }) });
      }
      return out;
    };
    return { ...action, invoker: { timing: 'immediate', run } };
  }

  /** `invoker` with each gesture whose handle can `replay` kept as the last operation when its commit leaves
   *  one entry. The selection is taken at the press and the params at the release, as the commit read them. */
  private ongoing(id: string, label: string, schemaOf: (params: Readonly<Record<string, unknown>>) => PrefGroup | null, invoker: OngoingInvoker, host: LastOperationHost): OngoingInvoker {
    const start: OngoingInvoker['start'] = (ctx, opts) => {
      const history = this.busy ? null : host.history();
      const restore = history ? host.takeSelection() : null;
      const handle = invoker.start(ctx, opts);
      const { onEnd, replay } = handle;
      if (!history || !onEnd || !replay) return handle;
      const watch = watchEntry(history);
      const ended: OngoingHandle['onEnd'] = (endCtx, reason) => {
        let entry: number | null = null;
        try {
          onEnd.call(handle, endCtx, reason);
        } finally {
          entry = watch.stop();
        }
        if (reason !== 'commit' || entry === null) return;
        const resolved = host.paramsOf(id, resolveParams(opts?.params));
        const schema = schemaOf(resolved);
        if (!schema) return;
        const values = formValues(schema, resolved);
        const rest = without(resolved, values);
        this.hold({ op: { id, label, schema, values }, entry, history, restore, rerun: (v) => replay.call(handle, { ...rest, ...v }) });
      };
      return { ...handle, onEnd: ended };
    };
    return { ...invoker, start };
  }

  private hold(held: Omit<Held, 'unobserve'>): void {
    this.held?.unobserve();
    const unobserve = held.history.observe(() => {
      if (!this.busy) this.dismiss();
    });
    this.held = { ...held, unobserve };
    this.remember(held.op.id, held.op.values);
    this.listeners.emit();
  }

  private remember(id: string, values: Readonly<Record<string, unknown>>): void {
    this.session.set(id, { params: { ...values } });
    this.onSession();
  }
}
