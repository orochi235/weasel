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
import { useCallback, useMemo, useRef, type MouseEvent } from 'react';
import { useLatest } from '@weasel-js/react';
import { asNodeId } from '../../core/scene/types';
import { scenePaintedPoseOf } from '../../canvas/derivedPath';
import type { Scene } from '../../core/scene/types';
import type { Stroke, Fill } from '@weasel-js/paint';
import { resolveScreenLength } from '@weasel-js/paint';
import { clientToCanvas } from '@weasel-js/routing';
import { findMountedCanvas, type MountedCanvas } from '../../canvas/mountedCanvases';
import type { View } from '../../core/viewport/view';
import type { RectPose } from 'core/geometry/unionBounds';
import { targetTransformOf, worldToLocal } from 'core/geometry/targetFrame';
import { poseFrameOf } from '@weasel-js/geom';
import { caretIndexAt, pointInTextPose, isTextData, type StyledRun, type TextPaint, type TextStyle, type TextVerticalAlign } from '@weasel-js/text';
import { useTextEdit, type TextEditClipRect, type TextEditScreenPose, type UseTextEditReturn } from '@weasel-js/text-dom';

/** Shape the default projections expect `data` to satisfy. All fields
 *  optional so any object satisfies the constraint — projections fill in
 *  the gaps for non-default shapes. */
export interface DefaultTextData {
  text?: string;
  style?: TextStyle;
  runs?: readonly StyledRun[];
  fill?: Fill | null;
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
  };
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

  const read = useMemo(() => projectionsOf(optsRef), [optsRef]);

  const edit = useTextEdit({
    container,
    isEditorChrome: (el) => optsRef.current.isEditorChrome?.(el) ?? false,
    escape: options.escape,
    fontHold: options.fontHold,
    onStart: (id) => optsRef.current.onStart?.(id),
    onEnd: (id) => optsRef.current.onEnd?.(id),
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
      const pose = scenePaintedPoseOf(scene)(node);
      const style = read.style(node.data);
      const at = surface();
      const view = resolveView(optsRef.current.view) ?? at?.canvas.getView();
      const box = screenBoxOf(pose, view, at?.box);
      return {
        ...box,
        // Against `zoom`, the same factor the overlay scales back up by, so a
        // `{ px }` size arrives on screen at the pixel count it names.
        fontSize: resolveScreenLength(
          style?.fontSize ?? optsRef.current.defaultFontSize ?? 16,
          box.zoom,
        ),
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

    // `pointInTextPose` and `caretIndexAt` work in the node's own box: the click
    // is un-projected here, then taken back through the frame the node is drawn in.
    const [canvasX, canvasY] = clientToCanvas(canvas, e.clientX, e.clientY);
    const root = containerRef.current;
    const view = resolveView(optsRef.current.view)
      ?? (root ? findMountedCanvas(root, canvas)?.getView() : undefined);
    const cx = view ? canvasX / view.scale.x + view.x : canvasX;
    const cy = view ? canvasY / view.scale.y + view.y : canvasY;
    // Top-most-first hit test: renderOrder() is back-to-front, so iterate
    // in reverse and break on the first hit.
    const order = sceneRef.current.renderOrderNodes();
    const paintedPoseOf = scenePaintedPoseOf(sceneRef.current);
    for (let i = order.length - 1; i >= 0; i--) {
      const node = order[i];
      if (sceneRef.current.isLocked(node.id) || sceneRef.current.isHidden(node.id)) continue;
      if (!read.isText(node.data)) continue;
      const text = read.text(node.data);
      const at = paintedPoseOf(node);
      const p = worldToLocal(targetTransformOf(at), cx, cy);
      if (!p) continue;
      const pose = {
        x: at.x, y: at.y, width: at.width, height: at.height,
        text,
        runs: read.runs(node.data) as StyledRun[] | undefined,
        style: read.style(node.data),
        verticalAlign: read.verticalAlign(node.data),
      };
      if (!pointInTextPose(p.x, p.y, pose)) continue;

      openedOnRef.current = canvas;
      edit.startEdit(String(node.id), { caret: caretIndexAt(p.x, p.y, pose) });
      return;
    }
  }, [edit, containerRef, optsRef, read, sceneRef]);

  const isTextNode = useCallback((id: string): boolean => {
    const node = sceneRef.current.get(asNodeId(id));
    return node !== undefined && read.isText(node.data);
  }, [read, sceneRef]);

  return { ...edit, onDoubleClick, isTextNode };
}

/**
 * `pose`'s box as the overlay takes it, `origin` being the canvas's corner in
 * container pixels. Only the box center is projected, since the overlay's
 * frame is about it. Width and height stay in world units and reach the
 * screen through the overlay's own `scale(zoom)` — see
 * `TextEditScreenPose.zoom`.
 */
function screenBoxOf(
  pose: RectPose,
  view: View | undefined,
  origin: { x: number; y: number } | undefined,
): Pick<TextEditScreenPose, 'x' | 'y' | 'width' | 'height' | 'frame'> & { zoom: number } {
  const zoom = view ? view.scale.x : 1;
  const zoomY = view ? view.scale.y : 1;
  const cx = (origin?.x ?? 0) + (pose.x + pose.width / 2 - (view?.x ?? 0)) * zoom;
  const cy = (origin?.y ?? 0) + (pose.y + pose.height / 2 - (view?.y ?? 0)) * zoomY;
  return {
    x: cx - (pose.width * zoom) / 2,
    y: cy - (pose.height * zoom) / 2,
    width: pose.width,
    height: pose.height,
    zoom,
    frame: frameLinearOf(pose, zoomY / zoom),
  };
}

/** The linear part of the frame `pose` is drawn in, as the overlay takes it.
 *  `stretch` is the view's y scale over its x scale: the overlay scales both
 *  axes by the x scale, so the frame carries what is left of y. */
function frameLinearOf(pose: unknown, stretch: number): TextEditScreenPose['frame'] {
  const m = poseFrameOf(pose);
  if (!m && stretch === 1) return undefined;
  const [a, b, c, d] = m ?? [1, 0, 0, 1];
  return [a, b * stretch, c, d * stretch];
}
