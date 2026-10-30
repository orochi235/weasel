/**
 * The scene's registered ops: the kit's own kinds and a consumer's, each a
 * pair of functions over a serializable payload, and the engine `Op` built
 * from one.
 */
import type { Op } from 'core/ops/types';
import type { RegisteredOp } from './types';

/** What the table asks of the scene when one of its ops runs. */
export interface OpTableEnv {
  /** Whether replaying this op would address a node that is no longer where
   *  its entry left it; such an op reports a no-op. */
  skips(kind: string, payload: unknown, forward: boolean): boolean;
  /** Called after an op built by {@link OpTable.op} has applied, with the
   *  direction it ran in. */
  applied(kind: string, payload: unknown, reverted: boolean): void;
  /** Whether an edit of the scene's is running. An op applied outside one
   *  is a replay by a history the scene does not own: a mode journal's undo,
   *  redo or cancel. */
  driven(): boolean;
  /** Run `step` as a replay step of its own, and notify. */
  replayAlone(step: () => void): void;
}

export interface OpTable {
  handlers: ReadonlyMap<string, RegisteredOp<unknown>>;
  register(kind: string, handler: RegisteredOp<unknown>): void;
  /** Apply a kind's forward half. Throws when nothing is registered for it. */
  run(kind: string, payload: unknown): void;
  /** A registered op as an engine `Op`. `invert()` flips the direction with
   *  the same payload, so undo replays `revert` and redo replays `apply`.
   *  The handler is looked up at apply time, so a re-registered kind takes
   *  effect on replay; that one exists is checked here, to fail at the call
   *  site. */
  op(kind: string, payload: unknown): Op;
}

export function createOpTable(env: OpTableEnv): OpTable {
  const handlers = new Map<string, RegisteredOp<unknown>>();

  function handlerFor(kind: string): RegisteredOp<unknown> {
    const handler = handlers.get(kind);
    if (!handler) throw new Error(`Scene: no registered op for kind "${kind}"`);
    return handler;
  }

  /** Coalesce-grouping key. Kit ops are keyed by the node or layer they
   *  address; a consumer kind only by the `coalesceKey` it declares. Keys
   *  take effect only under `UseSceneOptions.coalesceWindowMs`. */
  function coalesceKeyFor(kind: string, payload: unknown): string | undefined {
    let token: string | undefined;
    if (kind.startsWith('kit:')) {
      if (payload === null || typeof payload !== 'object') return undefined;
      const p = payload as { id?: unknown; layer?: unknown };
      token =
        typeof p.id === 'string' ? p.id
        : typeof p.layer === 'string' ? p.layer
        : undefined;
    } else {
      token = handlers.get(kind)?.coalesceKey?.(payload);
    }
    return token === undefined ? undefined : `${kind}:${token}`;
  }

  function run(kind: string, payload: unknown, forward: boolean): 'noop' | undefined {
    const handler = handlerFor(kind);
    if (env.skips(kind, payload, forward)) return 'noop';
    (forward ? handler.apply : handler.revert)(payload);
    env.applied(kind, payload, !forward);
    return undefined;
  }

  function op(kind: string, payload: unknown, forward = true): Op {
    handlerFor(kind);
    return {
      name: kind,
      args: payload,
      coalesceKey: coalesceKeyFor(kind, payload),
      apply: () => {
        if (env.driven()) return run(kind, payload, forward);
        let result: 'noop' | undefined;
        env.replayAlone(() => { result = run(kind, payload, forward); });
        return result;
      },
      invert: () => op(kind, payload, !forward),
    };
  }

  return {
    handlers,
    register: (kind, handler) => { handlers.set(kind, handler); },
    run: (kind, payload) => handlerFor(kind).apply(payload),
    op: (kind, payload) => op(kind, payload),
  };
}
