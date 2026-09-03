/**
 * `useSceneTextEdit` — scene-aware wrapper around `useTextEdit`.
 *
 * Every consumer that wires `useTextEdit` against a `useScene`-managed
 * scene writes the same callbacks: scene lookups for text / style /
 * runs / screen-pose, and `scene.update(id, { data })` for commits. This
 * helper bakes that wiring in. Consumers pass `scene` + `container` and
 * get back the same `UseTextEditReturn` shape (`startEdit`, `isEditing`,
 * `cancelEdit`, `commit`, `editingId`).
 *
 * Defaults assume the node's `data` carries `text` / `style` / `runs`
 * directly — matches the `useScene({ items })` trivial form where
 * `data === item` for text-shaped items, and matches `TextPose`-shaped
 * data. For custom data shapes, override any of the optional projections
 * (`getText` / `getStyle` / `getRuns` / `setText` / `setRuns` / `setStyle`).
 *
 * Pose component: the helper reads `(x, y, width, height)` straight off
 * the node's pose (typed `RectPose`). Pass `view` and it projects that box
 * through the viewport; omit it and world units are handed through as
 * screen pixels, which is correct only for an unpanned, unzoomed canvas.
 * Consumers with non-rect poses should drop down to raw `useTextEdit` and
 * supply their own `getScreenPose`.
 */
import { useCallback, useRef, type MouseEvent } from 'react';
import { asNodeId } from '../../core/scene/types';
import type { Scene } from '../../core/scene/types';
import type { FillStyle, Stroke } from '@weasel-js/paint';
import { clientToCanvas } from '../../core/viewport/clientToCanvas';
import type { View } from '../../core/viewport/view';
import type { RectPose } from 'core/geometry/unionBounds';
import { caretIndexAt, pointInTextPose } from './hitTest';
import type { StyledRun } from '@weasel-js/text';
import type { TextPaint, TextStyle } from '@weasel-js/text';
import { useTextEdit, type UseTextEditReturn } from './useTextEdit';

/** Shape the default projections expect `data` to satisfy. All fields
 *  optional so any object satisfies the constraint — projections fill in
 *  the gaps for non-default shapes. */
export interface DefaultTextData {
  text?: string;
  style?: TextStyle;
  runs?: readonly StyledRun[];
  fill?: FillStyle | null;
  stroke?: Stroke | null;
}

/** All-optional projections + fontSize fallback. */
export interface UseSceneTextEditOptions<TData> {
  /** Read plain text from `data`. Default: `data.text ?? ''`. */
  getText?: (data: TData) => string;
  /** Read style from `data`. Default: `data.style`. */
  getStyle?: (data: TData) => TextStyle | undefined;
  /** Read the node's paint from `data`. Default: `data.fill` / `data.stroke`. */
  getPaint?: (data: TData) => TextPaint | undefined;
  /** Read rich-text runs from `data`. Default: `data.runs`. */
  getRuns?: (data: TData) => readonly StyledRun[] | undefined;
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
   */
  setStyle?: (data: TData, style: TextStyle) => TData;
  /** Fallback fontSize when `style.fontSize` is unset. Default `16`. */
  defaultFontSize?: number;
  /**
   * Current viewport. Supply it on a canvas that pans or zooms: the overlay
   * is then positioned at the node's projected screen origin and CSS-scaled
   * by the view, so every typographic metric on it — including the
   * `fontSize` / `letterSpacing` a *run* carries — stays in world units and
   * scales together. Omit it and the node's world box is passed through as
   * screen pixels (correct at `{x: 0, y: 0, scale: 1}`).
   *
   * The overlay takes a single scale factor, so a non-uniform view scale is
   * represented by its `scale.x`; text under `scale.x !== scale.y` will not
   * match the canvas.
   *
   * A thunk is re-read on every projection, which is what an uncontrolled
   * `SceneCanvas` needs — its camera lives in a ref and moves without a
   * render, so pass the handle's `getView`. A plain `View` is the value from
   * the render that supplied it, which is correct for a controlled consumer.
   */
  view?: View | (() => View);
  /**
   * Forwarded to `useTextEdit`: is `el` part of the editor's own chrome?
   * Focus moving into it does not end the edit. Wire it to whatever renders
   * the character controls.
   */
  isEditorChrome?: (el: Element) => boolean;
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
   *  bubble). The handler looks up the canvas via `e.target`, hits the
   *  top-most text node under the cursor via `pointInTextPose`, resolves
   *  a caret offset via `caretIndexAt`, and starts edit on that node. */
  onDoubleClick: (e: MouseEvent<HTMLElement>) => void;
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
  // Stash scene + options in refs so the useTextEdit callbacks always see
  // the current values without re-binding (the underlying hook also reads
  // its options through a ref, so any re-creation would be churn).
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const optsRef = useRef(options);
  optsRef.current = options;

  const edit = useTextEdit({
    container,
    isEditorChrome: (el) => optsRef.current.isEditorChrome?.(el) ?? false,
    getText: (id) => {
      const node = sceneRef.current.get(asNodeId(id));
      if (!node) return '';
      const get = optsRef.current.getText;
      return get ? get(node.data) : (node.data.text ?? '');
    },
    getStyle: (id) => {
      const node = sceneRef.current.get(asNodeId(id));
      if (!node) return undefined;
      const get = optsRef.current.getStyle;
      return get ? get(node.data) : node.data.style;
    },
    getPaint: (id) => {
      const node = sceneRef.current.get(asNodeId(id));
      if (!node) return undefined;
      const get = optsRef.current.getPaint;
      return get ? get(node.data) : { fill: node.data.fill, stroke: node.data.stroke };
    },
    getScreenPose: (id) => {
      const node = sceneRef.current.get(asNodeId(id));
      if (!node) return null;
      const pose = node.pose;
      const style = optsRef.current.getStyle
        ? optsRef.current.getStyle(node.data)
        : node.data.style;
      const view = resolveView(optsRef.current.view);
      const zoom = view ? view.scale.x : 1;
      // Only the origin is projected. Width, height and font size stay in
      // world units and reach the screen through the overlay's own
      // `scale(zoom)` — see `TextEditScreenPose.zoom`.
      return {
        x: view ? (pose.x - view.x) * view.scale.x : pose.x,
        y: view ? (pose.y - view.y) * view.scale.y : pose.y,
        width: pose.width,
        height: pose.height,
        fontSize: style?.fontSize ?? optsRef.current.defaultFontSize ?? 16,
        zoom,
      };
    },
    setText: (id, text) => {
      const nid = asNodeId(id);
      const node = sceneRef.current.get(nid);
      if (!node) return;
      const setter = optsRef.current.setText;
      const data = setter ? setter(node.data, text) : { ...node.data, text };
      sceneRef.current.update(nid, { data });
    },
    getRuns: (id) => {
      const node = sceneRef.current.get(asNodeId(id));
      if (!node) return undefined;
      const get = optsRef.current.getRuns;
      return get ? get(node.data) : node.data.runs;
    },
    setRuns: (id, runs) => {
      const nid = asNodeId(id);
      const node = sceneRef.current.get(nid);
      if (!node) return;
      const setter = optsRef.current.setRuns;
      const data = setter ? setter(node.data, runs) : { ...node.data, runs };
      sceneRef.current.update(nid, { data });
    },
    setStyle: (id, style) => {
      const nid = asNodeId(id);
      const node = sceneRef.current.get(nid);
      if (!node) return;
      const setter = optsRef.current.setStyle;
      const data = setter ? setter(node.data, style) : { ...node.data, style };
      sceneRef.current.update(nid, { data });
    },
  });

  const onDoubleClick = useCallback((e: MouseEvent<HTMLElement>) => {
    // The dblclick bubbles from the canvas up to any wrapping container; the
    // element it started on is what the click coordinates are relative to.
    const canvas = e.target instanceof HTMLElement ? e.target : null;
    if (!canvas) return;

    // `pointInTextPose` and `caretIndexAt` both work in world units, so the
    // canvas-space click has to be un-projected before either sees it.
    const [canvasX, canvasY] = clientToCanvas(canvas, e.clientX, e.clientY);
    const view = resolveView(optsRef.current.view);
    const cx = view ? canvasX / view.scale.x + view.x : canvasX;
    const cy = view ? canvasY / view.scale.y + view.y : canvasY;
    const readText = (data: TData): string =>
      optsRef.current.getText ? optsRef.current.getText(data) : (data.text ?? '');
    const readStyle = (data: TData): TextStyle | undefined =>
      optsRef.current.getStyle ? optsRef.current.getStyle(data) : data.style;
    const readRuns = (data: TData): readonly StyledRun[] | undefined =>
      optsRef.current.getRuns ? optsRef.current.getRuns(data) : data.runs;

    // Top-most-first hit test: renderOrder() is back-to-front, so iterate
    // in reverse and break on the first hit.
    const order = sceneRef.current.renderOrderNodes();
    for (let i = order.length - 1; i >= 0; i--) {
      const node = order[i];
      const text = readText(node.data);
      const pose = {
        x: node.pose.x,
        y: node.pose.y,
        width: node.pose.width,
        height: node.pose.height,
        text,
        runs: readRuns(node.data) as StyledRun[] | undefined,
        style: readStyle(node.data),
      };
      if (!pointInTextPose(cx, cy, pose)) continue;

      edit.startEdit(String(node.id), { caret: caretIndexAt(cx, cy, pose) });
      return;
    }
  }, [edit]);

  return { ...edit, onDoubleClick };
}
