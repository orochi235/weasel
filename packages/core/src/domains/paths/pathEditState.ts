/**
 * Which path is being anchor-edited, which of its anchors are selected, and
 * the anchor marquee in flight: one object every reader shares — the
 * `editAnchors` dep, the anchor overlay, the selection overlay's suppressed
 * set, the chrome-caps rule context, and the select tool's shift-click lock.
 */
import { createEmitter } from '@weasel-js/registry';
import type { PathEditHost } from 'canvas/SceneCanvas/pathEditHost';
import type { HandleLocks } from 'interactions/actions/edit-anchors/params';
import type { PathEditExtension, PathEditMark } from './pathEditExtension';
import type { NodeId, Scene } from 'core/scene/types';
import { effectSourceFor } from 'domains/pathEffects/effectSources';

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
  /** The extensions it starts with; `setExtensions` replaces them. */
  extensions?: readonly PathEditExtension[];
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
  /** The extension mark selected in place of anchors, or null. */
  getSelectedMark(): PathEditMark | null;
  setSelectedMark(mark: PathEditMark | null): void;
  /** The canvas's path-edit extensions, in order. */
  getExtensions(): readonly PathEditExtension[];
  /** Replace the extensions; the overlay repaints when they change. */
  setExtensions(next: readonly PathEditExtension[]): void;
  /** The handle locks the `handleLock.*` toggles set; null until one is
   *  pressed. Not tied to the edited path, so they outlast a change of it. */
  getHandleLocks(): HandleLocks | null;
  setHandleLocks(next: HandleLocks): void;
  /**
   * The path-edit tool in use, or null for plain anchor editing. Path edit has
   * a set of named tools, one active at a time, each changing what a plain
   * drag does: `'simplifyBrush'` brushes the path simpler. A tool belongs to
   * the open path; with none open, or a different one, there is none.
   */
  getTool(): string | null;
  /** Switch tool, or pass null to go back to plain anchor editing. Ignored
   *  with no path open. */
  setTool(id: string | null): void;
  /** Notified when a write changes what the anchor overlay paints. A host
   *  that owns the id announces its own changes. */
  subscribe(listener: () => void): () => void;
}

const NO_IDS: ReadonlySet<string> = new Set();
const NO_EXTENSIONS: readonly PathEditExtension[] = [];
const NO_ANCHORS: ReadonlySet<number> = new Set();

/** Whether `id` names a node `scene` holds and `selection` includes, or the path a selected effect hides and is edited
 *  through. */
export function isSelectedNode(
  scene: Pick<Scene<unknown, string, unknown>, 'get'>,
  selection: { readonly current: readonly string[] },
  id: string,
): boolean {
  if (scene.get(id as NodeId) == null) return false;
  return selection.current.includes(id)
    || selection.current.some((sel) => effectSourceFor(scene, sel as NodeId, 'path') === id);
}

export function createPathEditState(source: PathEditSource = {}): PathEditState {
  let ownId = '';
  let selectedAnchors = NO_ANCHORS;
  let marquee: AnchorMarquee | null = null;
  let handleLocks: HandleLocks | null = null;
  let ownTool: { id: string; on: string } | null = null;
  let idSet = NO_IDS;
  let selectedMark: PathEditMark | null = null;
  let extensions = source.extensions ?? NO_EXTENSIONS;
  const changed = createEmitter();
  const notify = changed.emit;

  const next = (id: string | null): string => id ?? '';
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
      if (next(id) !== getEditingId()) ownTool = null;
      if (host) { host.setEditingId(id); return; }
      if (next(id) === ownId) return;
      ownId = next(id);
      notify();
    },
    getSelectedAnchors: () => {
      const host = source.host?.();
      return host?.selectedAnchors && host.setSelectedAnchors ? host.selectedAnchors() : selectedAnchors;
    },
    setSelectedAnchors(next) {
      const host = source.host?.();
      if (host?.selectedAnchors && host.setSelectedAnchors) { host.setSelectedAnchors(next); return; }
      selectedAnchors = next;
      notify();
    },
    getMarquee: () => marquee,
    setMarquee(rect) {
      marquee = rect;
      notify();
    },
    getSelectedMark: () => selectedMark,
    setSelectedMark(mark) {
      if (mark?.owner === selectedMark?.owner && mark?.index === selectedMark?.index) return;
      selectedMark = mark;
      notify();
    },
    getExtensions: () => extensions,
    setExtensions(next) {
      if (next === extensions) return;
      extensions = next;
      notify();
    },
    getHandleLocks: () => handleLocks,
    setHandleLocks(next) {
      handleLocks = { angle: next.angle, length: next.length };
      notify();
    },
    getTool() {
      const on = getEditingId();
      const host = source.host?.();
      if (host?.tool) return on ? host.tool() : null;
      // Dropped on the read that finds its path gone: a host can close the
      // path without telling this state.
      if (ownTool && ownTool.on !== on) ownTool = null;
      return ownTool?.id ?? null;
    },
    setTool(id) {
      const host = source.host?.();
      if (host?.tool && host.setTool) { host.setTool(id); return; }
      const on = getEditingId();
      const tool = id && on ? { id, on } : null;
      if (tool?.id === ownTool?.id && tool?.on === ownTool?.on) return;
      ownTool = tool;
      notify();
    },
    subscribe: changed.subscribe,
  };
}
