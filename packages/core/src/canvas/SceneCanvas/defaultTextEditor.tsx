/**
 * `<SceneCanvas>`'s own text editor: the one `enterTextEdit` reaches, from a
 * text or sticky tool or a double-click on a text node, when the host has
 * wired none of its own. It stands down for a host editor: a
 * `useSceneTextEdit` whose container holds the canvas, which the canvas's
 * `textEdit` dep then answers with, or a `textEdit` dep registered over it.
 */
import { useCallback, useLayoutEffect, useMemo, useState, useSyncExternalStore, type MutableRefObject } from 'react';
import { useLatest } from '@weasel-js/react';
import { useDepSource } from '@weasel-js/routing/react';
import type { TextEditDep } from 'interactions/actions/depSchema';
import type { Node, Scene } from 'core/scene/types';
import {
  useSceneTextEditor, type DefaultTextData, type UseSceneTextEditOptions, type UseSceneTextEditReturn,
} from 'domains/text/useSceneTextEdit';
import { hostTextEditDep, hostTextEditing, hostTextEditorHolds, subscribeHostTextEditing } from 'domains/text/hostTextEditors';
import { drawOneEditing, type EditingDrawOne } from 'domains/text/editingDrawOne';
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
  /** The dep of the host's editor over this canvas, or `null` for none. */
  host: () => TextEditDep | null;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the canvas fills elementRef on commit, so every commit rereads it; the guard stops a loop
  useLayoutEffect(() => {
    if (elementRef.current !== element) setElement(elementRef.current);
  });
  const live = on && config !== false;
  const container = live && element ? ((element.offsetParent ?? element.parentElement) as HTMLElement | null) : null;
  const elRef = useLatest(element);
  const edit = useSceneTextEditor(
    scene as unknown as Scene<DefaultTextData, string>, container, (config || {}) as unknown as UseSceneTextEditOptions<DefaultTextData>,
    () => elRef.current,
  );
  const editRef = useLatest(edit);
  const dep = useMemo<TextEditDep>(() => ({
    startEdit: (id, opts) => editRef.current.startEdit(id, opts),
    textAt: (at) => editRef.current.textAt(at),
    isTextNode: (id) => editRef.current.isTextNode(id),
  }), [editRef]);
  const yields = useMemo(() => () => {
    const el = elRef.current;
    return el === null || hostTextEditorHolds(el);
  }, [elRef]);
  const sceneRef = useLatest(scene);
  const host = useMemo(() => () => {
    const el = elRef.current;
    return el === null ? null : hostTextEditDep(el, sceneRef.current);
  }, [elRef, sceneRef]);
  return { edit, dep, element: container ? element : null, yields, host };
}

/**
 * Publishes the editor as the `textEdit` dep, or the editor of a host's
 * `useSceneTextEdit` holding the canvas while there is one. Rendered after
 * the canvas's standard deps and before its children, so it sits over the
 * stub and under any `textEdit` a child registers.
 */
export function DefaultTextEditDep({ editor }: { editor: DefaultTextEditor }): null {
  const { dep, element, yields, host } = editor;
  useDepSource('textEdit', (below) => {
    if (element && !yields()) return dep;
    return host() ?? (below() as TextEditDep);
  });
  return null;
}

/**
 * The canvas's own editor, and its `layers` with the edited node's glyphs left
 * out — the node its own editor has open, or a host's `useSceneTextEdit`
 * holding the canvas. Not mounted under `paintInto`, where the canvas element
 * is the host's.
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
  const hostEditing = useSyncExternalStore(
    subscribeHostTextEditing,
    useCallback(() => (elementRef.current ? hostTextEditing(elementRef.current, scene) : null), [elementRef, scene]),
  );
  const editingId = editor.edit.editingId ?? hostEditing;
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
