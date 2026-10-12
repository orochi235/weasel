/**
 * `useSceneTextEdit` — scene-aware wrapper around `useTextEdit`: scene
 * lookups for text / style / runs / screen-pose, and
 * `scene.update(id, { data })` for commits.
 *
 * Defaults assume the node's `data` carries `text` / `style` / `runs`
 * directly. For custom data shapes, override any of the optional projections.
 * Consumers with non-rect poses should drop down to raw `useTextEdit` and
 * supply their own `getScreenPose`.
 */
import { useCallback, useMemo, useRef, type MouseEvent } from 'react';
import { useLatest } from '@weasel-js/react';
import { asNodeId } from '../../core/scene/types';
import { effectivePose } from '../../core/scene/effectivePose';
import type { Scene } from '../../core/scene/types';
import type { FillStyle, Stroke } from '@weasel-js/paint';
import { resolveScreenLength } from '@weasel-js/paint';
import { clientToCanvas } from '@weasel-js/routing';
import { findMountedCanvas, type MountedCanvas } from '../../canvas/mountedCanvases';
import type { View } from '../../core/viewport/view';
import type { RectPose } from 'core/geometry/unionBounds';
import { caretIndexAt, pointInTextPose, isTextData, type StyledRun, type TextPaint, type TextStyle, type TextVerticalAlign } from '@weasel-js/text';
import { useTextEdit, type TextEditClipRect, type UseTextEditReturn } from '@weasel-js/text-dom';

/** Shape the default projections expect `data` to satisfy. All fields
 *  optional so any object satisfies the constraint — projections fill in
 *  the gaps for non-default shapes. */
export interface DefaultTextData {
  text?: string;
  style?: TextStyle;
  runs?: readonly StyledRun[];
  fill?: FillStyle | null;
  stroke?: Stroke | null;
  verticalAlign?: TextVerticalAlign;
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
  /** Fallback fontSize when `style.fontSize` is unset. Default `16`. */
  defaultFontSize?: number;
  /**
   * The view to project through. Omit it and the view is read live from the
   * weasel canvas mounted inside `container` (the one a double-click landed
   * on, when there are several). With no canvas there, the node's world box
   * is passed through as screen pixels.
   *
   * The overlay takes a single scale factor, so a non-uniform view scale is
   * represented by its `scale.x`; text under `scale.x !== scale.y` will not
   * match the canvas.
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
}

function resolveView(view: View | (() => View) | undefined): View | undefined {
  return typeof view === 'function' ? view() : view;
}

/** Return shape extends `UseTextEditReturn` with an `onDoubleClick`
 *  binding for the canvas container. Double-clicking inside a text
 *  node enters edit mode with the caret seeded at the clicked glyph. */
export interface UseSceneTextEditReturn extends UseTextEditReturn {
  /** Bind to the element wrapping `<SceneCanvas>` (the same element
   *  passed as `container`, or any ancestor that receives the dblclick
   *  bubble). Starts an edit on the top-most text node under the cursor. */
  onDoubleClick: (e: MouseEvent<HTMLElement>) => void;
  /** The `isText` option asked of the node with this id: what
   *  `TextEditDep.isTextNode` wants, so both ways into an edit agree. */
  isTextNode: (id: string) => boolean;
}

/** Wire double-click-to-edit text on a scene: mounts a DOM editing overlay
 *  over the node being edited and writes the result back as an undoable op. */
export function useSceneTextEdit<
  TData extends DefaultTextData,
  TLayer extends string,
  TPose extends RectPose = RectPose,
>(
  scene: Scene<TData, TLayer, TPose>,
  container: HTMLElement | null,
  options: UseSceneTextEditOptions<TData> = {},
): UseSceneTextEditReturn {
  // Refs, so the useTextEdit callbacks always see the current values
  // without re-binding.
  const sceneRef = useLatest(scene);
  const optsRef = useLatest(options);
  const containerRef = useLatest(container);
  // The last double-click's target, so the overlay projects through the
  // canvas the edit was opened on.
  const openedOnRef = useRef<EventTarget | null>(null);

  // The canvas's box in container pixels is both the origin its view projects
  // from and the region its glyphs are clipped to.
  const surface = (): { canvas: MountedCanvas; box: TextEditClipRect } | null => {
    const root = containerRef.current;
    const canvas = root ? findMountedCanvas(root, openedOnRef.current) : null;
    if (!root || !canvas) return null;
    const a = canvas.element.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    return {
      canvas,
      box: {
        x: a.left - b.left - root.clientLeft + root.scrollLeft,
        y: a.top - b.top - root.clientTop + root.scrollTop,
        width: a.width,
        height: a.height,
      },
    };
  };

  const read = useMemo(() => ({
    isText: (data: TData): boolean =>
      optsRef.current.isText ? optsRef.current.isText(data) : isTextData(data),
    text: (data: TData): string =>
      optsRef.current.getText ? optsRef.current.getText(data) : (data.text ?? ''),
    style: (data: TData): TextStyle | undefined =>
      optsRef.current.getStyle ? optsRef.current.getStyle(data) : data.style,
    runs: (data: TData): readonly StyledRun[] | undefined =>
      optsRef.current.getRuns ? optsRef.current.getRuns(data) : data.runs,
    verticalAlign: (data: TData): TextVerticalAlign | undefined =>
      optsRef.current.getVerticalAlign ? optsRef.current.getVerticalAlign(data) : data.verticalAlign,
  }), [optsRef]);

  const edit = useTextEdit({
    container,
    isEditorChrome: (el) => optsRef.current.isEditorChrome?.(el) ?? false,
    escape: options.escape,
    fontHold: options.fontHold,
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
      return get ? get(node.data) : { fill: node.data.fill, stroke: node.data.stroke };
    },
    getScreenPose: (id) => {
      const scene = sceneRef.current;
      const node = scene.get(asNodeId(id));
      if (!node) return null;
      const pose = effectivePose(scene, node);
      const style = read.style(node.data);
      const at = surface();
      const view = resolveView(optsRef.current.view) ?? at?.canvas.getView();
      const zoom = view ? view.scale.x : 1;
      const originX = at?.box.x ?? 0;
      const originY = at?.box.y ?? 0;
      // Only the origin is projected. Width, height and font size stay in
      // world units and reach the screen through the overlay's own
      // `scale(zoom)` — see `TextEditScreenPose.zoom`.
      return {
        x: originX + (view ? (pose.x - view.x) * view.scale.x : pose.x),
        y: originY + (view ? (pose.y - view.y) * view.scale.y : pose.y),
        width: pose.width,
        height: pose.height,
        // Against `zoom`, the same factor the overlay scales back up by, so a
        // `{ px }` size arrives on screen at the pixel count it names.
        fontSize: resolveScreenLength(
          style?.fontSize ?? optsRef.current.defaultFontSize ?? 16,
          zoom,
        ),
        zoom,
        verticalAlign: read.verticalAlign(node.data),
      };
    },
    getClipRect: () => surface()?.box ?? null,
    getRuns: (id) => {
      const node = sceneRef.current.get(asNodeId(id));
      return node ? read.runs(node.data) : undefined;
    },
    commit: (id, { text, runs, style }) => {
      const nid = asNodeId(id);
      const node = sceneRef.current.get(nid);
      if (!node) return;
      const { setText, setRuns, setStyle } = optsRef.current;
      let data = setText ? setText(node.data, text) : { ...node.data, text };
      if (runs) data = setRuns ? setRuns(data, runs) : { ...data, runs };
      if (style) data = setStyle ? setStyle(data, style) : { ...data, style };
      sceneRef.current.update(nid, { data });
    },
  });

  const onDoubleClick = useCallback((e: MouseEvent<HTMLElement>) => {
    // The dblclick bubbles from the canvas up to any wrapping container; the
    // element it started on is what the click coordinates are relative to.
    const canvas = e.target instanceof HTMLElement ? e.target : null;
    if (!canvas) return;
    // Inside the editor a double-click selects a word, and its target is a run
    // span whose box the click would be measured against as if it were a canvas.
    if (canvas.closest('[contenteditable="true"]')) return;

    // `pointInTextPose` and `caretIndexAt` both work in world units, so the
    // canvas-space click has to be un-projected before either sees it.
    const [canvasX, canvasY] = clientToCanvas(canvas, e.clientX, e.clientY);
    const root = containerRef.current;
    const view = resolveView(optsRef.current.view)
      ?? (root ? findMountedCanvas(root, canvas)?.getView() : undefined);
    const cx = view ? canvasX / view.scale.x + view.x : canvasX;
    const cy = view ? canvasY / view.scale.y + view.y : canvasY;
    // Top-most-first hit test: renderOrder() is back-to-front, so iterate
    // in reverse and break on the first hit.
    const order = sceneRef.current.renderOrderNodes();
    for (let i = order.length - 1; i >= 0; i--) {
      const node = order[i];
      if (sceneRef.current.isLocked(node.id)) continue;
      if (!read.isText(node.data)) continue;
      const text = read.text(node.data);
      const at = effectivePose(sceneRef.current, node);
      const pose = {
        x: at.x,
        y: at.y,
        width: at.width,
        height: at.height,
        text,
        runs: read.runs(node.data) as StyledRun[] | undefined,
        style: read.style(node.data),
        verticalAlign: read.verticalAlign(node.data),
      };
      if (!pointInTextPose(cx, cy, pose)) continue;

      openedOnRef.current = canvas;
      edit.startEdit(String(node.id), { caret: caretIndexAt(cx, cy, pose) });
      return;
    }
  }, [edit, containerRef, optsRef, read, sceneRef]);

  const isTextNode = useCallback((id: string): boolean => {
    const node = sceneRef.current.get(asNodeId(id));
    return node !== undefined && read.isText(node.data);
  }, [read, sceneRef]);

  return { ...edit, onDoubleClick, isTextNode };
}
