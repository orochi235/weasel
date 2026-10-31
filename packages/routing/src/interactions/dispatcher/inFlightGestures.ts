/** The ongoing handles a dispatcher has in flight, keyed by gesture id. */
import { resolveCursor, type CursorSpec } from '@weasel-js/cursor';
import { actionCursor, type Action } from '../actions/action';
import type { OngoingHandle } from '../actions/invoker';

const EMPTY_ENGAGED: ReadonlySet<string> = new Set();

export interface InFlightGestures {
  /** Live: it changes as gestures open and end. */
  readonly handles: ReadonlyMap<string, OngoingHandle>;
  /**
   * Put `handle` in flight. `ownerId` is the entry whose binding opened it,
   * `null` for an ambient action or a UI-driven handle; `action` is whose
   * handle it is, where a cursor may be read from it. `over`: its binding
   * is live only while the pointer is over the surface (`BindingOpts.over`).
   */
  open(gestureId: string, handle: OngoingHandle, ownerId: string | null, action?: Action, over?: boolean): void;
  /** Whether the gesture in flight under `gestureId` was opened by an `over` binding. */
  openedOver(gestureId: string): boolean;
  /** Take a gesture out of flight, returning its handle so the caller can end it. */
  take(gestureId: string): OngoingHandle | undefined;
  /** Take every gesture out of flight. */
  takeAll(): Array<[string, OngoingHandle]>;
  /** The ids of the entries that own a gesture in flight: the matcher's `engagedChannels`. */
  engagedOwners(): ReadonlySet<string>;
  /** What the gesture begun last currently is, where its handle or action says. See
   *  `OngoingHandle.cursor` and `Action.activeCursor`. */
  cursor(): CursorSpec | null;
  /** The gesture begun last. */
  latest(): { kind: string | null; id: string | null };
}

export function createInFlightGestures(): InFlightGestures {
  const handles = new Map<string, OngoingHandle>();
  const owners = new Map<string, string | null>();
  const actions = new Map<string, Action>();
  const over = new Set<string>();

  const forget = (gestureId: string): void => {
    handles.delete(gestureId);
    owners.delete(gestureId);
    actions.delete(gestureId);
    over.delete(gestureId);
  };

  return {
    handles,
    open(gestureId, handle, ownerId, action, opensOver) {
      handles.set(gestureId, handle);
      owners.set(gestureId, ownerId);
      if (action) actions.set(gestureId, action);
      if (opensOver) over.add(gestureId);
    },
    openedOver: (gestureId) => over.has(gestureId),
    take(gestureId) {
      const handle = handles.get(gestureId);
      forget(gestureId);
      return handle;
    },
    takeAll() {
      const all = [...handles];
      handles.clear();
      owners.clear();
      actions.clear();
      over.clear();
      return all;
    },
    engagedOwners() {
      if (owners.size === 0) return EMPTY_ENGAGED;
      const out = new Set<string>();
      for (const owner of owners.values()) {
        if (owner != null) out.add(owner);
      }
      return out;
    },
    cursor() {
      // Latest start wins, matching `latest` — with a mouse and a pen in
      // flight together the cursor belongs to the gesture the user just
      // began, not the one they began first. Map iteration is insertion order
      // and each gestureId is set exactly once, so the last entry is the newest.
      let cursor: CursorSpec | null = null;
      for (const [id, handle] of handles) {
        const action = actions.get(id);
        const spec = handle.cursor?.() ?? action?.activeCursor ?? actionCursor(action);
        // The spec, not its CSS form: a painted glyph resolves to 'none', which
        // would tell the pump to hide the cursor and paint nothing.
        if (spec !== undefined && resolveCursor(spec)) cursor = spec;
      }
      return cursor;
    },
    latest() {
      let lastId: string | null = null;
      let lastHandle: OngoingHandle | null = null;
      for (const [id, handle] of handles) {
        lastId = id;
        lastHandle = handle;
      }
      if (lastHandle === null) return { kind: null, id: null };
      return { kind: lastHandle.kind ?? null, id: lastId };
    },
  };
}

/** Whether a handle carries no gesture-processing callbacks or preview data:
 *  the invoker decided at runtime not to engage. */
export function isEmptyOngoingHandle(h: OngoingHandle): boolean {
  return !h.onMove && !h.onEnd && !h.overlay && !h.previewIds && !h.previewPose;
}
