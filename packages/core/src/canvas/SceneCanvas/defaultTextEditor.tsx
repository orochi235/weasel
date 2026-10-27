/**
 * `<SceneCanvas>`'s own text editor: the one a text or sticky tool's
 * `enterTextEdit` reaches, and a double-click on a text node opens, when the
 * host has wired none of its own. It stands down for a host editor — a
 * `useSceneTextEdit` whose container holds the canvas, or a `textEdit` dep
 * registered over it.
 */
import { useEffect, useLayoutEffect, useMemo, useState, type MutableRefObject } from 'react';
import { useLatest } from '@weasel-js/react';
import { useDepRegistry, useDepSource } from '@weasel-js/routing/react';
import type { TextEditDep } from 'interactions/actions/depSchema';
import type { Node, Scene } from 'core/scene/types';
import {
  useSceneTextEditor, type DefaultTextData, type UseSceneTextEditOptions, type UseSceneTextEditReturn,
} from 'features/text/useSceneTextEdit';
import { hostTextEditorHolds } from 'features/text/hostTextEditors';
import { drawOneEditing, type EditingDrawOne } from 'features/text/editingDrawOne';
import { defaultDrawOne, defaultPaintBounds, paintBoundsFor } from '../defaultDrawOne';
import { isCustomEntry } from '../layerSlots';
import type { SceneCanvasLayers } from './props';

/** `<SceneCanvas textEditor>`: its own editor's options, or `false` for none. */
export type SceneCanvasTextEditor<TData> = false | UseSceneTextEditOptions<TData>;

export interface DefaultTextEditor {
  edit: UseSceneTextEditReturn;
  /** The `textEdit` dep this editor answers with while it is the one standing. */
  dep: TextEditDep;
  element: HTMLElement | null;
  /** Whether the host has an editor of its own over this canvas. */
  yields: () => boolean;
}

/**
 * The editor, mounted into the canvas's containing block — its offset parent,
 * else its parent — so the overlay is positioned against the box it is
 * measured from. `on` false mounts it nowhere.
 */
export function useDefaultTextEditor<TData>(
  scene: Scene<TData, string, unknown>,
  elementRef: MutableRefObject<HTMLElement | null>,
  config: SceneCanvasTextEditor<TData> | undefined,
  on: boolean,
): DefaultTextEditor {
  const [element, setElement] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (elementRef.current !== element) setElement(elementRef.current);
  });
  const live = on && config !== false;
  const container = live && element ? ((element.offsetParent ?? element.parentElement) as HTMLElement | null) : null;
  const edit = useSceneTextEditor(
    scene as unknown as Scene<DefaultTextData, string>, container, (config || {}) as unknown as UseSceneTextEditOptions<DefaultTextData>,
  );
  const editRef = useLatest(edit);
  const elRef = useLatest(element);
  const dep = useMemo<TextEditDep>(() => ({
    startEdit: (id, opts) => editRef.current.startEdit(id, opts),
    isTextNode: (id) => editRef.current.isTextNode(id),
  }), [editRef]);
  const yields = useMemo(() => () => {
    const el = elRef.current;
    return el === null || hostTextEditorHolds(el);
  }, [elRef]);
  return { edit, dep, element: container ? element : null, yields };
}

/**
 * Publishes the editor as the `textEdit` dep and opens it on a double-click.
 * Rendered after the canvas's standard deps and before its children, so it
 * sits over the stub and under any `textEdit` a child registers.
 */
export function DefaultTextEditDep({ editor, onDoubleClick }: {
  editor: DefaultTextEditor;
  /** Whether a double-click on a text node opens it: the `edit` feature. */
  onDoubleClick: boolean;
}): null {
  const { dep, element, yields, edit } = editor;
  const registry = useDepRegistry();
  const editRef = useLatest(edit);
  useDepSource('textEdit', (below) => (element && !yields() ? dep : (below() as TextEditDep)));
  useEffect(() => {
    if (!element || !onDoubleClick) return;
    const open = (e: MouseEvent) => {
      if (registry.get('textEdit') === dep) editRef.current.onDoubleClick(e);
    };
    element.addEventListener('dblclick', open);
    return () => element.removeEventListener('dblclick', open);
  }, [element, onDoubleClick, registry, dep, editRef]);
  return null;
}

/**
 * The canvas's own editor, and its `layers` with the edited node's glyphs left
 * out. Not mounted under `paintInto`, where the canvas element is the host's.
 */
export function useCanvasTextEditor<TData, TLayer extends string, TPose>(
  scene: Scene<TData, string, unknown>,
  elementRef: MutableRefObject<HTMLElement | null>,
  props: {
    textEditor?: SceneCanvasTextEditor<TData>;
    paintInto?: unknown;
    layers?: SceneCanvasLayers<Node<TData, TLayer, TPose>, TPose>;
  },
): { editor: DefaultTextEditor; layers: SceneCanvasLayers<Node<TData, TLayer, TPose>, TPose> | undefined } {
  const editor = useDefaultTextEditor(scene, elementRef, props.textEditor, !props.paintInto);
  const editingId = editor.edit.editingId;
  const layers = useMemo(() => layersWhileEditing(props.layers, editingId), [props.layers, editingId]);
  return { editor, layers };
}

/**
 * `layers` with the scene slot's `drawOne` leaving out the glyphs of the node
 * `editingId` names, which the overlay stands in for; `layers` itself when
 * nothing is being edited, or the slot is not the kit's.
 */
export function layersWhileEditing<TData, TLayer extends string, TPose>(
  layers: SceneCanvasLayers<Node<TData, TLayer, TPose>, TPose> | undefined,
  editingId: string | null,
): SceneCanvasLayers<Node<TData, TLayer, TPose>, TPose> | undefined {
  if (editingId === null) return layers;
  const slot = layers?.scene;
  if (slot === null || isCustomEntry(slot)) return layers;
  const base = (slot?.drawOne ?? defaultDrawOne) as EditingDrawOne;
  const paintBounds = slot && 'paintBounds' in slot
    ? slot.paintBounds
    : slot?.drawOne ? paintBoundsFor(base) : defaultPaintBounds;
  return {
    ...layers, scene: { ...slot, drawOne: drawOneEditing(editingId, base), paintBounds },
  } as SceneCanvasLayers<Node<TData, TLayer, TPose>, TPose>;
}
