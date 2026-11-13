/**
 * `useSceneTextEdit` — scene-aware wrapper around `useTextEdit`: scene
 * lookups for text / style / runs / screen-pose, and
 * `scene.update(id, { data })` for commits. The overlay and a double-click
 * both read the pose a node is painted at, so text inside a container whose
 * pose is a frame is edited where it is drawn.
 *
 * Defaults assume the node's `data` carries `text` / `style` / `runs`
 * directly. For custom data shapes, override any of the optional projections.
 * Consumers with non-rect poses should drop down to raw `useTextEdit` and
 * supply their own `getScreenPose`.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import { asNodeId } from '../../core/scene/types';
import { scenePaintedPoseOf } from '../../canvas/derivedPath';
import type { Scene } from '../../core/scene/types';
import { drawOneEditing, type EditingDrawOne } from './editingDrawOne';
import { textHitAt } from './textHitAt';
import { registerHostTextEditor, type HostTextEditorHandle } from './hostTextEditors';
import { editedData, sceneTextDrafts } from './sceneTextDrafts';
import type { Stroke, Fill, Inherit } from '@weasel-js/paint';
import { inheritedPaintIn } from '../../canvas/inheritedPaints';
import { withInheritedPaint } from '../../core/scene/inheritedPaint';
import { layoutBoxOf, type Point2 } from '@weasel-js/routing';
import { findMountedCanvas, type MountedCanvas } from '../../canvas/mountedCanvases';
import type { View } from '../../core/viewport/view';
import type { RectPose } from 'core/geometry/unionBounds';
import { isTextData, type StyledRun, type TextFit, type TextPaint, type TextStyle, type TextVerticalAlign } from '@weasel-js/text';
import type { TextOverflow } from '../../canvas/nodeShapes/textPainter';
import { screenPoseOf } from './textEditScreenPose';
import { shownLookup } from '../../core/scene/nodeAsShown';
import { useTextEdit, type TextEditClipRect, type UseTextEditReturn } from '@weasel-js/text-dom';

/** Shape the default projections expect `data` to satisfy. All fields
 *  optional so any object satisfies the constraint — projections fill in
 *  the gaps for non-default shapes. */
export interface DefaultTextData {
  text?: string;
  style?: TextStyle;
  runs?: readonly StyledRun[];
  fill?: Fill | Inherit | null;
  stroke?: Stroke | Inherit | null;
  verticalAlign?: TextVerticalAlign;
  padding?: number;
  overflow?: TextOverflow;
  fit?: TextFit;
}

/** All-optional projections + fontSize fallback. */
export interface UseSceneTextEditOptions<TData> {
  /**
   * Is this node text? A double-click opens an edit only on a node that
   * answers yes, and passes through any other to the text under it. Default:
   * `isTextData`, the test `inferredNodeRouting` classifies a text node by. Pass one when `getText` reads some other shape.
   */
  isText?: (data: TData) => boolean;
  /** Read plain text from `data`. Default: `data.text ?? ''`. */
  getText?: (data: TData) => string;
  /** Read style from `data`. Default: `data.style`. */
  getStyle?: (data: TData) => TextStyle | undefined;
  /** Read the node's paint from `data`. Default: `data.fill` / `data.stroke`. */
  getPaint?: (data: TData) => TextPaint | undefined;
  /** Read rich-text runs from `data`. Default: `data.runs`. */
  getRuns?: (data: TData) => readonly StyledRun[] | undefined;
  /** Read the box vertical alignment from `data`. Default: `data.verticalAlign`. */
  getVerticalAlign?: (data: TData) => TextVerticalAlign | undefined;
  /** Read the inset from the node's box to its text from `data`. Default: `data.padding`. */
  getPadding?: (data: TData) => number | undefined;
  /** Read whether the node cuts its text at its box from `data`. The overlay
   *  then does too, and scrolls the text in the box while it is edited.
   *  Default: `data.overflow`. */
  getOverflow?: (data: TData) => TextOverflow | undefined;
  /** Read how the node's text size answers to its box from `data`. The overlay
   *  sets the text at the size the canvas fits it to. Default: `data.fit`. */
  getFit?: (data: TData) => TextFit | undefined;
  /** Produce updated data with new text. Default: `{ ...data, text }`. */
  setText?: (data: TData, text: string) => TData;
  /** Produce updated data with new runs. Default: `{ ...data, runs }`. */
  setRuns?: (data: TData, runs: StyledRun[]) => TData;
  /**
   * Produce updated data with a new node-wide style. Default:
   * `{ ...data, style }`. Written only when a range toggle has to *clear* a
   * flag the node itself sets — the run algebra is additive, so that edit
   * lowers the node flag and raises it on the runs outside the range. See
   * `useTextEdit`'s `setStyle`.
   *
   * An edit's text, runs, and style are folded through these three and
   * written as one `scene.update`, so a commit is one undo step.
   */
  setStyle?: (data: TData, style: TextStyle) => TData;
  /**
   * The view to project the overlay through. Omit it and the view is read
   * live from the weasel canvas mounted inside `container` (the first, when
   * there are several). With no canvas there, the node's world box is passed
   * through as screen pixels.
   *
   * A thunk is re-read on every projection; a plain `View` is the value from
   * the render that supplied it.
   */
  view?: View | (() => View);
  /**
   * Forwarded to `useTextEdit`: is `el` part of the editor's own chrome?
   * Focus moving into it does not end the edit. Wire it to whatever renders
   * the character controls.
   */
  isEditorChrome?: (el: Element) => boolean;
  /** Forwarded to `useTextEdit`: what Escape does to the edit. */
  escape?: 'cancel' | 'commit';
  /** Forwarded to `useTextEdit`: how long an edit waits for its face. */
  fontHold?: number;
  /** Forwarded to `useTextEdit`: called as an edit of the node `id` opens,
   *  whichever way it was started. */
  onStart?: (id: string) => void;
  /** Forwarded to `useTextEdit`: called as the edit of `id` closes, after
   *  any commit has been written to the scene. */
  onEnd?: (id: string) => void;
}

function resolveView(view: View | (() => View) | undefined): View | undefined {
  return typeof view === 'function' ? view() : view;
}

/** Return shape extends `UseTextEditReturn` with what the `textEdit` dep
 *  answers: a double-click on a canvas inside `container` reaches the editor
 *  through it, with no handler of the host's. */
export interface UseSceneTextEditReturn extends UseTextEditReturn {
  /** The top-most unlocked text node at world point `at`, and the caret at
   *  the glyph there: what `TextEditDep.textAt` wants. */
  textAt: (at: Point2) => { id: string; caret: number } | null;
  /** The `isText` option asked of the node with this id: what
   *  `TextEditDep.isTextNode` wants, so both ways into an edit agree. */
  isTextNode: (id: string) => boolean;
  /**
   * `defaultDrawOne`, less the glyphs of the node being edited: the overlay
   * stands in for its text, and the rest of the node, a `background` among
   * it, goes on painting. A `<SceneCanvas>` inside `container` drawing this
   * scene already leaves those glyphs out; this is for anything else that
   * draws the node.
   */
  drawOne: EditingDrawOne;
}

/** How each field is read from a node's `data`: the option's projection, else the default shape. */
function projectionsOf<TData extends DefaultTextData>(opts: { readonly current: UseSceneTextEditOptions<TData> }) {
  return {
    isText: (data: TData): boolean =>
      opts.current.isText ? opts.current.isText(data) : isTextData(data),
    text: (data: TData): string =>
      opts.current.getText ? opts.current.getText(data) : (data.text ?? ''),
    style: (data: TData): TextStyle | undefined =>
      opts.current.getStyle ? opts.current.getStyle(data) : data.style,
    runs: (data: TData): readonly StyledRun[] | undefined =>
      opts.current.getRuns ? opts.current.getRuns(data) : data.runs,
    verticalAlign: (data: TData): TextVerticalAlign | undefined =>
      opts.current.getVerticalAlign ? opts.current.getVerticalAlign(data) : data.verticalAlign,
    padding: (data: TData): number | undefined =>
      opts.current.getPadding ? opts.current.getPadding(data) : data.padding,
    overflow: (data: TData): TextOverflow | undefined =>
      opts.current.getOverflow ? opts.current.getOverflow(data) : data.overflow,
    fit: (data: TData): TextFit | undefined =>
      opts.current.getFit ? opts.current.getFit(data) : data.fit,
  };
}

/** Wire in-place text editing on a scene: mounts a DOM editing overlay over
 *  the node being edited and writes the result back as an undoable op.
 *  `<SceneCanvas>`'s own editor stands down for any canvas inside `container`
 *  and answers its `textEdit` dep with this one, so the canvas's double-click
 *  (`enterTextEdit.doubleClick`) and a text tool open this editor, and such a
 *  canvas leaves out the glyphs of the node being edited. */
export function useSceneTextEdit<
  TData extends DefaultTextData,
  TLayer extends string,
  TPose extends RectPose = RectPose,
>(
  scene: Scene<TData, TLayer, TPose>,
  container: HTMLElement | null,
  options: UseSceneTextEditOptions<TData> = {},
): UseSceneTextEditReturn {
  const host = useRef<HostTextEditorHandle | null>(null);
  const edit = useSceneTextEditor(scene, container, options);
  const editRef = useLatest(edit);
  useEffect(() => {
    if (!container) return undefined;
    const handle = registerHostTextEditor(container, scene, {
      startEdit: (id, opts) => editRef.current.startEdit(id, opts),
      textAt: (at) => editRef.current.textAt(at),
      isTextNode: (id) => editRef.current.isTextNode(id),
    });
    host.current = handle;
    return () => {
      handle.dispose();
      if (host.current === handle) host.current = null;
    };
  }, [container, scene, editRef]);
  useEffect(() => { host.current?.setEditing(edit.editingId); }, [edit.editingId, container, scene]);
  return edit;
}

/** `useSceneTextEdit` without announcing itself as a host's editor: what
 *  `<SceneCanvas>` mounts as its own, projecting through `canvas`, the
 *  element of the canvas it edits for. A host's editor projects through the
 *  first canvas inside `container`. */
export function useSceneTextEditor<
  TData extends DefaultTextData,
  TLayer extends string,
  TPose extends RectPose = RectPose,
>(
  scene: Scene<TData, TLayer, TPose>,
  container: HTMLElement | null,
  options: UseSceneTextEditOptions<TData> = {},
  canvas: () => Element | null = () => null,
): UseSceneTextEditReturn {
  // Refs, so the useTextEdit callbacks always see the current values
  // without re-binding.
  const sceneRef = useLatest(scene);
  const optsRef = useLatest(options);
  const containerRef = useLatest(container);
  const canvasRef = useLatest(canvas);
  const drafts = useMemo(() => sceneTextDrafts(sceneRef, optsRef), [sceneRef, optsRef]);
  useEffect(() => () => drafts.close(), [drafts]);

  // The canvas's box in container pixels is both the origin its view projects
  // from and the region its glyphs are clipped to.
  const surface = (): { canvas: MountedCanvas; box: TextEditClipRect } | null => {
    const root = containerRef.current;
    const canvas = root ? findMountedCanvas(root, canvasRef.current()) : null;
    if (!root || !canvas) return null;
    // Layout boxes: under an ancestor transform a client offset is the container's px times its scale.
    const a = layoutBoxOf(canvas.element);
    const b = layoutBoxOf(root);
    return {
      canvas,
      box: {
        x: (a.left - b.left) / b.scale.x - root.clientLeft + root.scrollLeft,
        y: (a.top - b.top) / b.scale.y - root.clientTop + root.scrollTop,
        width: a.width,
        height: a.height,
      },
    };
  };

  const read = useMemo(() => projectionsOf(optsRef), [optsRef]);

  const edit = useTextEdit({
    container,
    isEditorChrome: (el) => optsRef.current.isEditorChrome?.(el) ?? false,
    escape: options.escape,
    fontHold: options.fontHold,
    onStart: (id) => optsRef.current.onStart?.(id),
    onEnd: (id) => {
      drafts.end(id);
      optsRef.current.onEnd?.(id);
      sceneRef.current.history.seal();
    },
    onDraft: drafts.draft,
    getText: (id) => {
      const node = sceneRef.current.get(asNodeId(id));
      return node ? read.text(node.data) : '';
    },
    getStyle: (id) => {
      const node = sceneRef.current.get(asNodeId(id));
      return node ? read.style(node.data) : undefined;
    },
    getPaint: (id) => {
      const node = sceneRef.current.get(asNodeId(id));
      if (!node) return undefined;
      const get = optsRef.current.getPaint;
      return get ? get(node.data) : shownTextPaint(sceneRef.current, node);
    },
    getScreenPose: (id) => {
      const scene = sceneRef.current;
      const node = shownLookup(scene).get(asNodeId(id)); // As shown, so a fit follows the draft being typed.
      if (!node) return null;
      const at = surface();
      const view = resolveView(optsRef.current.view) ?? at?.canvas.getView();
      return screenPoseOf(node.data, scenePaintedPoseOf(scene)(node), read, view, at?.box);
    },
    getClipRect: () => surface()?.box ?? null,
    getRuns: (id) => {
      const node = sceneRef.current.get(asNodeId(id));
      return node ? read.runs(node.data) : undefined;
    },
    commit: (id, { text, runs, style }) => {
      const nid = asNodeId(id);
      const node = sceneRef.current.get(nid);
      // A node removed or locked during the edit takes no write; the edit still ends.
      if (!node || sceneRef.current.isLocked(nid)) return;
      drafts.commit(id, editedData(node.data, { text, runs, style }, optsRef.current));
    },
  });

  const textAt = useCallback(
    (at: Point2) => textHitAt(sceneRef.current, read, at.x, at.y),
    [read, sceneRef],
  );

  const isTextNode = useCallback((id: string): boolean => {
    const node = sceneRef.current.get(asNodeId(id));
    return node !== undefined && read.isText(node.data);
  }, [read, sceneRef]);

  const drawOne = useMemo(() => drawOneEditing(edit.editingId), [edit.editingId]);
  return { ...edit, textAt, isTextNode, drawOne };
}

/** A text node's paint as the canvas paints it: an inherited one is its container's. */
function shownTextPaint<TData extends DefaultTextData>(
  scene: Scene<TData, string, unknown>,
  node: NonNullable<ReturnType<Scene<TData, string, unknown>['get']>>,
): TextPaint {
  const { fill, stroke } = withInheritedPaint(node.data, inheritedPaintIn(scene, node));
  return { fill, stroke };
}
