/**
 * The containers of every text editor a host mounted with `useSceneTextEdit`,
 * and the node each is editing. `<SceneCanvas>`'s own editor stands down for a
 * canvas inside one, so a host that wires its own never gets a second overlay
 * on the same double-click, and the canvas leaves out the glyphs of the node
 * the host's overlay stands in for.
 */
import { createEmitter } from '@weasel-js/registry';

interface HostEditor {
  container: HTMLElement;
  scene: object;
  editingId: string | null;
}

const editors = new Map<symbol, HostEditor>();
const changed = createEmitter();

/** A host's editor, registered with {@link registerHostTextEditor}. */
export interface HostTextEditorHandle {
  /** Report the node the editor now has open, `null` for none. */
  setEditing(id: string | null): void;
  dispose(): void;
}

/** Record `container` as holding a host's editor of `scene` until the handle is disposed. */
export function registerHostTextEditor(container: HTMLElement, scene: object): HostTextEditorHandle {
  const key = Symbol('textEditor');
  const entry: HostEditor = { container, scene, editingId: null };
  editors.set(key, entry);
  return {
    setEditing(id) {
      if (entry.editingId === id || !editors.has(key)) return;
      entry.editingId = id;
      changed.emit();
    },
    dispose() {
      if (editors.delete(key) && entry.editingId !== null) changed.emit();
    },
  };
}

/** Whether a host's editor holds `el`. */
export function hostTextEditorHolds(el: Element): boolean {
  for (const e of editors.values()) if (e.container.contains(el)) return true;
  return false;
}

/** The node of `scene` a host's editor holding `el` has open, or `null`. */
export function hostTextEditing(el: Element, scene: object): string | null {
  for (const e of editors.values()) {
    if (e.editingId !== null && e.scene === scene && e.container.contains(el)) return e.editingId;
  }
  return null;
}

/** Called whenever a host's editor opens or closes a node. */
export function subscribeHostTextEditing(listener: () => void): () => void {
  return changed.subscribe(listener);
}
