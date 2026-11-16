/**
 * `createEditingSession` — a second place to edit a scene from: its own
 * selection, pose previews and scroll offsets over the same document and the
 * same history. See `docs/editing-sessions.md`.
 */
import type { History } from '@weasel-js/history';
import { isDocument } from './documentOf';
import { sessionHostOf, type SessionHost, type SessionState } from './sessionHost';
import type { NodeId, Scene } from './types';

/**
 * An editing session over a scene. It is a `Scene` in every respect, so
 * anything that takes a scene takes a session: a `<SceneCanvas>`, a kernel3d
 * world, an action's `scene` dep. Every document member — nodes, edits,
 * history — is the scene's. The session members are its own:
 *
 * - `getSelection` / `setSelection` / `selectable`, and `subscribe` /
 *   `getVersion` hearing its selection rather than the scene's;
 * - `overrides`, the previews a gesture or a text edit shows;
 * - `scroll`, how far each container's content is scrolled.
 *
 * An edit made through a session records that session's selection on its
 * history entry, and an undo or redo made through one restores the selection
 * into it. A removed, hidden or locked node leaves every session's selection.
 */
export interface EditingSession<TData, TLayer extends string, TPose> extends Scene<TData, TLayer, TPose> {
  /** The scene this session edits. */
  readonly document: Scene<TData, TLayer, TPose>;
}

/** Whether `scene` is an {@link EditingSession} rather than the scene it edits. */
export function isEditingSession<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
): scene is EditingSession<TData, TLayer, TPose> {
  return (scene as Partial<EditingSession<TData, TLayer, TPose>>).document !== undefined && sessions.has(scene);
}

const sessions = new WeakSet<object>();

/**
 * The scene `scene` reads: an editing session's scene, the source of a
 * `documentOf` reading, else `scene` itself. A table kept per document — its
 * painters, its pick ids — is keyed on this, so every reading of one scene
 * finds the same entry.
 */
export function documentScene(scene: object): object {
  let s = scene;
  for (;;) {
    if ('overrides' in s && isDocument(s as { readonly overrides: unknown })) s = Object.getPrototypeOf(s) as object;
    else if (sessions.has(s)) s = (s as EditingSession<unknown, string, unknown>).document;
    else return s;
  }
}

/** `target` with each of its methods run while `run` wraps it: the rest read through to `target`. */
function wrapped<T extends object>(target: T, run: <R>(fn: () => R) => R, own: PropertyDescriptorMap = {}): T {
  const methods: PropertyDescriptorMap = {};
  for (const key of Object.getOwnPropertyNames(target)) {
    if (Object.hasOwn(own, key)) continue;
    const held = Object.getOwnPropertyDescriptor(target, key);
    const fn = held?.value as unknown;
    if (typeof fn !== 'function') continue;
    methods[key] = { value: (...args: unknown[]) => run(() => (fn as (...a: unknown[]) => unknown)(...args)) };
  }
  return Object.create(target, { ...methods, ...own }) as T;
}

/** The session members a session holds of its own, over the scene's changes. */
function sessionMembers(scene: Scene<unknown, string, unknown>, state: SessionState): PropertyDescriptorMap {
  const { selection } = state;
  return {
    overrides: { value: state.overrides },
    scroll: { value: state.scroll },
    getSelection: { value: selection.get },
    setSelection: { value: (ids: readonly NodeId[]) => selection.set([...ids]) },
    selectable: { value: selection.legal },
    subscribe: {
      value(listener: () => void) {
        const offScene = scene.subscribe(listener);
        const offSelection = selection.subscribe(listener);
        return () => { offScene(); offSelection(); };
      },
    },
    getVersion: { value: () => scene.getContentVersion() + selection.changes() },
  };
}

/**
 * A new {@link EditingSession} over `scene`, with nothing selected, previewed
 * or scrolled. Given a session, it opens another over that session's scene.
 * The scene holds it weakly: drop every reference and it is gone, with
 * nothing to close.
 *
 * Throws for an object `createScene`, `sceneFromJSON` or `useScene` did not
 * build, and for a `documentOf` reading, which holds no session state.
 */
export function createEditingSession<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
): EditingSession<TData, TLayer, TPose> {
  const document = isEditingSession(scene) ? scene.document : scene;
  if (isDocument(document)) throw new Error('createEditingSession: a documentOf reading holds no session state');
  const host: SessionHost | undefined = sessionHostOf(document);
  if (host === undefined) throw new Error('createEditingSession: not a scene createScene, sceneFromJSON or useScene built');
  const state = host.open();
  const run = <R>(fn: () => R): R => host.actingAs(state, fn);
  const doc = document as Scene<unknown, string, unknown>;
  const history = wrapped<History>(doc.history, run);
  const session = wrapped(doc, run, {
    ...sessionMembers(doc, state),
    history: { value: history },
    document: { value: document },
  }) as EditingSession<TData, TLayer, TPose>;
  sessions.add(session);
  return session;
}
