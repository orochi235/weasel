/**
 * The canvas's own text editor: the one `enterTextEdit` reaches, from a text
 * or sticky tool or a double-click on a text node, when the host has wired
 * none of its own. `textPreset` mounts it inside the canvas. It stands down for
 * a host editor: a `useSceneTextEdit` whose container holds the canvas, which
 * the `textEdit` dep then answers with, or a `textEdit` dep registered over it.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type MutableRefObject } from 'react';
import { useLatest } from '@weasel-js/react';
import { useDepSource } from '@weasel-js/routing/react';
import { registerPaintStandIn, type PaintStandIn, type PresetComponentProps, type Scene } from '@weasel-js/core';
import type { TextEditDep } from './textEditDep';
import {
  useSceneTextEditor, type DefaultTextData, type UseSceneTextEditOptions, type UseSceneTextEditReturn,
} from './useSceneTextEdit';
import { hostTextEditDep, hostTextEditorHolds } from './hostTextEditors';
import { withoutText } from './editingDrawOne';
import { useTextEditDepSource } from './textEditStub';

/** The canvas's own editor: `useSceneTextEdit`'s options, or `false` for none. */
export type CanvasTextEditorOptions<TData = DefaultTextData> = false | UseSceneTextEditOptions<TData>;

interface DefaultTextEditor {
  edit: UseSceneTextEditReturn;
  /** Where the overlay mounts: the canvas's containing block, or `null` while it has none. */
  container: HTMLElement | null;
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
function useDefaultTextEditor<TData>(
  scene: Scene<TData, string, unknown>,
  elementRef: MutableRefObject<HTMLElement | null>,
  config: CanvasTextEditorOptions<TData> | undefined,
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
  return { edit, container, dep, element: container ? element : null, yields, host };
}

/**
 * Publishes the editor as the `textEdit` dep, or the editor of a host's
 * `useSceneTextEdit` holding the canvas while there is one. Rendered after
 * the stub, among the canvas's preset components, so it sits over the stub and
 * under any `textEdit` a child of the canvas registers.
 */
function DefaultTextEditDep({ editor }: { editor: DefaultTextEditor }): null {
  const { dep, element, yields, host } = editor;
  useDepSource('textEdit', (below) => {
    if (element && !yields()) return dep;
    return host() ?? (below() as TextEditDep);
  });
  return null;
}

/** While the canvas's own editor has a node open, its overlay stands in for that node's glyphs. */
function useEditingStandIn(scene: object, editor: DefaultTextEditor): void {
  const within = editor.container;
  const editing = editor.edit.editingId;
  const editingRef = useLatest(editing);
  const standIn = useRef<PaintStandIn | null>(null);
  useEffect(() => {
    if (!within) return undefined;
    const held = registerPaintStandIn(scene, within, withoutText);
    held.show(editingRef.current);
    standIn.current = held;
    return () => { held.dispose(); standIn.current = null; };
  }, [scene, within, editingRef]);
  useEffect(() => { standIn.current?.show(editing); }, [editing]);
}

function TextEditStub({ scene }: { scene: Scene<unknown, string, unknown> }): null {
  useTextEditDepSource(scene);
  return null;
}

/**
 * The canvas's own editor as a preset component, configured by `config`: the
 * `textEdit` dep's stub, the editor over it, and its stand-in for the glyphs of
 * the node it has open. Not mounted under `paintInto`, where the canvas element
 * is the host's.
 */
export function canvasTextEditor(config?: CanvasTextEditorOptions): ComponentType<PresetComponentProps> {
  function CanvasTextEditor({ scene, canvasRef, paintsInto }: PresetComponentProps) {
    const editor = useDefaultTextEditor(scene as Scene<DefaultTextData, string, unknown>, canvasRef, config, !paintsInto);
    useEditingStandIn(scene, editor);
    return (
      <>
        <TextEditStub scene={scene} />
        <DefaultTextEditDep editor={editor} />
      </>
    );
  }
  return CanvasTextEditor;
}
