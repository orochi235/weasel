/**
 * `useSceneTextEdit` — scene-aware wrapper around `useTextEdit`.
 *
 * Every consumer that wires `useTextEdit` against a `useScene`-managed
 * scene writes the same six callbacks: scene lookups for text / style /
 * runs / screen-pose, and `scene.update(id, { data })` for commits. This
 * helper bakes that wiring in. Consumers pass `scene` + `container` and
 * get back the same `UseTextEditReturn` shape (`startEdit`, `isEditing`,
 * `cancelEdit`, `commit`, `editingId`).
 *
 * Defaults assume the node's `data` carries `text` / `style` / `runs`
 * directly — matches the `useScene({ items })` trivial form where
 * `data === item` for text-shaped items, and matches `TextPose`-shaped
 * data. For custom data shapes, override any of the optional projections
 * (`getText` / `getStyle` / `getRuns` / `setText` / `setRuns`).
 *
 * Pose component: the helper reads `(x, y, width, height)` straight off
 * the node's pose (typed `RectPose`). Consumers with non-rect poses or
 * zoom-aware screen mapping should drop down to raw `useTextEdit` and
 * supply their own `getScreenPose`.
 */
import { useCallback, useRef, type MouseEvent } from 'react';
import { asNodeId } from '../../core/scene/types';
import type { Scene } from '../../core/scene/types';
import { clientToCanvas } from '../../core/viewport/clientToCanvas';
import type { RectPose } from '../groups/unionBounds';
import { caretIndexAt, pointInTextPose } from './hitTest';
import type { StyledRun } from './runs';
import type { TextStyle } from './textStyle';
import { useTextEdit, type UseTextEditReturn } from './useTextEdit';

/** Shape the default projections expect `data` to satisfy. All fields
 *  optional so any object satisfies the constraint — projections fill in
 *  the gaps for non-default shapes. */
interface DefaultTextData {
  text?: string;
  style?: TextStyle;
  runs?: readonly StyledRun[];
}

/** All-optional projections + fontSize fallback. */
export interface UseSceneTextEditOptions<TData> {
  /** Read plain text from `data`. Default: `data.text ?? ''`. */
  getText?: (data: TData) => string;
  /** Read style from `data`. Default: `data.style`. */
  getStyle?: (data: TData) => TextStyle | undefined;
  /** Read rich-text runs from `data`. Default: `data.runs`. */
  getRuns?: (data: TData) => readonly StyledRun[] | undefined;
  /** Produce updated data with new text. Default: `{ ...data, text }`. */
  setText?: (data: TData, text: string) => TData;
  /** Produce updated data with new runs. Default: `{ ...data, runs }`. */
  setRuns?: (data: TData, runs: StyledRun[]) => TData;
  /** Fallback fontSize when `style.fontSize` is unset. Default `16`. */
  defaultFontSize?: number;
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
    getScreenPose: (id) => {
      const node = sceneRef.current.get(asNodeId(id));
      if (!node) return null;
      const pose = node.pose;
      const style = optsRef.current.getStyle
        ? optsRef.current.getStyle(node.data)
        : node.data.style;
      return {
        x: pose.x,
        y: pose.y,
        width: pose.width,
        height: pose.height,
        fontSize: style?.fontSize ?? optsRef.current.defaultFontSize ?? 16,
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
  });

  const onDoubleClick = useCallback((e: MouseEvent<HTMLElement>) => {
    // Find the canvas element. The dblclick bubbles from the canvas up to
    // any wrapping container — we want the canvas to read its 2D context
    // for the caret measurement.
    const canvas = e.target instanceof HTMLCanvasElement ? e.target : null;
    if (!canvas) return;

    const [cx, cy] = clientToCanvas(canvas, e.clientX, e.clientY);
    const readText = (data: TData): string =>
      optsRef.current.getText ? optsRef.current.getText(data) : (data.text ?? '');
    const readStyle = (data: TData): TextStyle | undefined =>
      optsRef.current.getStyle ? optsRef.current.getStyle(data) : data.style;

    // Top-most-first hit test: renderOrder() is back-to-front, so iterate
    // in reverse and break on the first hit.
    const order = [...sceneRef.current.renderOrder()];
    for (let i = order.length - 1; i >= 0; i--) {
      const node = sceneRef.current.get(order[i]);
      if (!node) continue;
      const text = readText(node.data);
      const pose = {
        x: node.pose.x,
        y: node.pose.y,
        width: node.pose.width,
        height: node.pose.height,
        text,
        style: readStyle(node.data),
      };
      if (!pointInTextPose(cx, cy, pose)) continue;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        edit.startEdit(String(order[i]));
        return;
      }
      const caret = caretIndexAt(ctx, cx, cy, pose);
      edit.startEdit(String(order[i]), { caret });
      return;
    }
  }, [edit]);

  return { ...edit, onDoubleClick };
}
