/**
 * The containers of every text editor a host mounted with `useSceneTextEdit`,
 * and the `textEdit` dep each answers. The canvas's own editor (`textPreset`)
 * stands down for a canvas inside one and answers with the host's dep instead,
 * so a double-click there opens the host's overlay and no second one. Each
 * host's editor stands in for the glyphs of the node it has open
 * (`registerPaintStandIn`), so the canvas leaves them out.
 */
import { registerPaintStandIn } from '@weasel-js/core';
import type { TextEditDep } from './textEditDep';
import { withoutText } from './editingDrawOne';

interface HostEditor {
  container: HTMLElement;
  scene: object;
  dep: TextEditDep;
}

const editors = new Map<symbol, HostEditor>();

/** A host's editor, registered with {@link registerHostTextEditor}. */
export interface HostTextEditorHandle {
  /** Report the node the editor now has open, `null` for none. */
  setEditing(id: string | null): void;
  dispose(): void;
}

/** Record `container` as holding a host's editor of `scene`, answering `dep`, until the handle is disposed. */
export function registerHostTextEditor(container: HTMLElement, scene: object, dep: TextEditDep): HostTextEditorHandle {
  const key = Symbol('textEditor');
  editors.set(key, { container, scene, dep });
  const standIn = registerPaintStandIn(scene, container, withoutText);
  return {
    setEditing(id) {
      if (editors.has(key)) standIn.show(id);
    },
    dispose() {
      editors.delete(key);
      standIn.dispose();
    },
  };
}

/** Whether a host's editor holds `el`. */
export function hostTextEditorHolds(el: Element): boolean {
  for (const e of editors.values()) if (e.container.contains(el)) return true;
  return false;
}

/** The dep of a host's editor of `scene` holding `el`, or `null` for none. */
export function hostTextEditDep(el: Element, scene: object): TextEditDep | null {
  for (const e of editors.values()) if (e.scene === scene && e.container.contains(el)) return e.dep;
  return null;
}
