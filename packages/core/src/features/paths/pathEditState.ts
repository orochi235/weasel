/**
 * Which path is being anchor-edited, which of its anchors are selected, and
 * the anchor marquee in flight: one object every reader shares — the
 * `editAnchors` dep, the anchor overlay, the selection overlay's suppressed
 * set, the chrome-caps rule context, and the select tool's shift-click lock.
 */
import { createEmitter } from '@weasel-js/registry';
import type { PathEditHost } from 'canvas/SceneCanvas/pathEditHost';

/** A world-coord rect. */
export interface AnchorMarquee {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * What decides whether a stored edit target is still one: its node exists and
 * is selected, and the mode permits anchor editing. Each is read at the
 * moment of the question.
 */
export interface PathEditSource {
  /** Whether `id` names a node that exists and is selected. Absent means
   *  every id does. */
  isSelectedNode?(id: string): boolean;
  /** A host that owns the id; the state then keeps none of its own. */
  host?(): PathEditHost | undefined;
  /**
   * Whether anchor editing is permitted right now — whether the active mode
   * allows the `edits-anchors` capability.
   *
   * **Omit this when no mode registry is wired.** Absent means "no modality,
   * so nothing revokes edit mode"; a predicate built from an empty capability
   * set would revoke edit mode instantly.
   */
  isAllowed?(): boolean;
}

export interface PathEditState {
  /**
   * The node whose anchors are editable now, or `''`: the stored id, or the
   * host's, while `PathEditSource` still lets it stand. Masked rather than
   * cleared: a host's mode machine can leave path-edit mode without running
   * `exitPathEdit`, and nothing re-renders when it does, so there is no
   * moment to write the id back.
   */
  getEditingId(): string;
  /** `getEditingId()` as the set the selection overlay skips. */
  getEditingIds(): ReadonlySet<string>;
  setEditingId(id: string | null): void;
  /** Selected anchors (flat indices) of the path being edited. */
  getSelectedAnchors(): ReadonlySet<number>;
  setSelectedAnchors(next: ReadonlySet<number>): void;
  /** The in-flight anchor-marquee rect, in the edited path's world. */
  getMarquee(): AnchorMarquee | null;
  setMarquee(rect: AnchorMarquee | null): void;
  /** Index into the edited node's `data.constraints` of the selected constraint mark, or null. */
  getSelectedConstraint(): number | null;
  setSelectedConstraint(index: number | null): void;
  /** Notified when a write changes what the anchor overlay paints. A host
   *  that owns the id announces its own changes. */
  subscribe(listener: () => void): () => void;
}

const NO_IDS: ReadonlySet<string> = new Set();
const NO_ANCHORS: ReadonlySet<number> = new Set();

/** Whether `id` names a node `scene` holds and `selection` includes. */
export function isSelectedNode(
  scene: { get(id: never): unknown },
  selection: { readonly current: readonly string[] },
  id: string,
): boolean {
  return scene.get(id as never) != null && selection.current.includes(id);
}

export function createPathEditState(source: PathEditSource = {}): PathEditState {
  let ownId = '';
  let selectedAnchors = NO_ANCHORS;
  let marquee: AnchorMarquee | null = null;
  let idSet = NO_IDS;
  let selectedConstraint: number | null = null;
  const changed = createEmitter();
  const notify = changed.emit;

  const getEditingId = (): string => {
    const host = source.host?.();
    const id = host ? host.editingId() ?? '' : ownId;
    if (!id) return '';
    if (source.isAllowed && !source.isAllowed()) return '';
    if (source.isSelectedNode && !source.isSelectedNode(id)) return '';
    return id;
  };

  return {
    getEditingId,
    getEditingIds() {
      const id = getEditingId();
      if (!id) return NO_IDS;
      if (!idSet.has(id)) idSet = new Set([id]);
      return idSet;
    },
    setEditingId(id) {
      const host = source.host?.();
      if (host) { host.setEditingId(id); return; }
      const next = id ?? '';
      if (next === ownId) return;
      ownId = next;
      notify();
    },
    getSelectedAnchors: () => selectedAnchors,
    setSelectedAnchors(next) {
      selectedAnchors = next;
      notify();
    },
    getMarquee: () => marquee,
    setMarquee(rect) {
      marquee = rect;
      notify();
    },
    getSelectedConstraint: () => selectedConstraint,
    setSelectedConstraint(index) {
      if (index === selectedConstraint) return;
      selectedConstraint = index;
      notify();
    },
    subscribe: changed.subscribe,
  };
}
