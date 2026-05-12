import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useSelectTool, type UseSelectToolOptions } from './useSelectTool';
import { useEditAnchorsTool, type UseEditAnchorsToolOptions } from './useEditAnchorsTool';
import {
  useEditAnchors,
  type EditAnchorsAdapter,
  type UseEditAnchorsOptions,
} from 'interactions/gestures/edit-anchors';
import { useTools, type ToolsApi } from '../useTools';
import type { MoveAdapter, ResizeAdapter, RotateAdapter, AreaSelectAdapter } from 'core/adapters/types';

/** Adapter intersection required for the inner select tool plus the
 *  edit-anchors controller. Same shape as the demo's hand-rolled adapter. */
export type SelectWithAnchorEditAdapter<TNode extends { id: string }, TPose> =
  & MoveAdapter<TNode, TPose>
  & ResizeAdapter<TNode, TPose>
  & RotateAdapter<TNode, TPose>
  & AreaSelectAdapter
  & EditAnchorsAdapter<TNode>;

/** Sub-options forwarded to `useEditAnchors` + `useEditAnchorsTool`. The
 *  `editingId` is owned by the helper and not exposed here — flips happen
 *  via double-click + Escape internally. */
export interface SelectWithAnchorEditAnchorsOptions {
  /** World-space hit radius for anchor + control handles. Default 8. */
  hitRadius?: number;
  /** History label for the anchor-edit transform. Default `'Edit anchors'`. */
  editLabel?: UseEditAnchorsOptions['editLabel'];
  /** Tool id for the edit-anchors slot. Default `'edit-anchors'`. */
  toolId?: UseEditAnchorsToolOptions['id'];
  /** Tool keybinding. Default `{ key: 'A' }`. */
  keybinding?: UseEditAnchorsToolOptions['keybinding'];
  /** Tool cursor. Default `'default'`. */
  cursor?: UseEditAnchorsToolOptions['cursor'];
  /** Visual style overrides for the anchor-edit overlay. */
  overlayStyle?: UseEditAnchorsToolOptions['overlayStyle'];
}

/** Options for the modal select-with-anchor-edit helper. */
export interface UseSelectWithAnchorEditOptions<TNode extends { id: string }, TPose>
  extends UseSelectToolOptions<TNode, TPose> {
  /** Edit-anchors sub-options (hit radius, overlay style, etc.). */
  editAnchors?: SelectWithAnchorEditAnchorsOptions;
  /** Filter applied to the ids `pickEvery` returns at the double-click point.
   *  Return the id to enter anchor-edit mode for, or `null` to stay in select.
   *  Default: `(ids) => ids[0] ?? null`. */
  editingFilter?: (ids: readonly string[]) => string | null;
  /** Convert client (event) coords to world coords for the double-click hit
   *  test. Same signature as `<Canvas clientToWorld>`. Required when the
   *  canvas is rendered under a CSS transform / zoom — without this the
   *  helper falls back to `getBoundingClientRect`-relative coords. */
  clientToWorld?: (canvas: HTMLCanvasElement, cx: number, cy: number) => [number, number];
}

/** Return shape: a tools API for `<Canvas tools={...}>` plus a double-click
 *  handler the consumer wires to the wrapping element. The handler converts
 *  the event to world coords, runs `pickEvery` + `editingFilter`, and flips
 *  the active tool to `edit-anchors` for the picked id. Escape clears the
 *  flip (handled inside `useEditAnchorsTool`). */
export interface UseSelectWithAnchorEditReturn {
  /** Tools API — pass straight to `<Canvas tools={tools}>`. */
  tools: ToolsApi;
  /** Wrap the canvas container with this on `onDoubleClick`. */
  onDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
  /** Currently editing id, if any — exposed for consumer UI (status bars,
   *  cursor hints). Most consumers can ignore this. */
  editingId: string | null;
}

/** Compose `useSelectTool` + `useEditAnchors` + `useEditAnchorsTool` +
 *  `useTools` with the modal "double-click to enter anchor edit, Escape to
 *  exit" state machine wired internally.
 *
 *  - `editingId` lives in the helper. Demos no longer thread it.
 *  - Double-click on a body hit (per `pickEvery`) flips the active tool to
 *    `edit-anchors`, gated by `editingFilter`.
 *  - Escape (handled by `useEditAnchorsTool.onExit`) flips back to `select`.
 *
 *  Returns `{ tools, onDoubleClick, editingId }`. Consumers pass `tools` to
 *  `<Canvas>` and wire `onDoubleClick` to the wrapping element (the
 *  `<canvas>` itself doesn't receive double-click events when nested under a
 *  transformed wrapper — the prior demo pattern). */
export function useSelectWithAnchorEdit<TNode extends { id: string }, TPose>(
  adapter: SelectWithAnchorEditAdapter<TNode, TPose>,
  options: UseSelectWithAnchorEditOptions<TNode, TPose>,
): UseSelectWithAnchorEditReturn {
  const [editingId, setEditingId] = useState<string | null>(null);

  // pickEvery is now optional on UseSelectToolOptions — fall back to the
  // same rect AABB-vs-point default useSelectTool itself uses.
  const poseBoundsForFallback = options.poseBounds ?? ((p: TPose) => p as unknown as { x: number; y: number; width: number; height: number });
  const pickEveryFallback = (worldX: number, worldY: number): string[] => {
    const out: string[] = [];
    for (const obj of adapter.getNodes()) {
      const b = poseBoundsForFallback(adapter.getPose(obj.id));
      if (worldX >= b.x && worldX <= b.x + b.width
          && worldY >= b.y && worldY <= b.y + b.height) {
        out.push(obj.id);
      }
    }
    return out;
  };
  // Latest-value refs so `onDoubleClick` doesn't need to re-bind on every
  // render (and so `pickEvery` / `editingFilter` / `clientToWorld` updates
  // don't churn it).
  const pickEveryRef = useRef<(worldX: number, worldY: number) => string[]>(
    options.pickEvery ?? pickEveryFallback,
  );
  pickEveryRef.current = options.pickEvery ?? pickEveryFallback;
  const editingFilterRef = useRef(options.editingFilter);
  editingFilterRef.current = options.editingFilter;
  const clientToWorldRef = useRef(options.clientToWorld);
  clientToWorldRef.current = options.clientToWorld;

  const select = useSelectTool<TNode, TPose>(adapter, options);

  const editAnchorsOpts = options.editAnchors;
  const editAnchorsCtl = useEditAnchors<TNode>(adapter, {
    editingId,
    hitRadius: editAnchorsOpts?.hitRadius,
    editLabel: editAnchorsOpts?.editLabel,
  });

  const editAnchorsTool = useEditAnchorsTool<TNode>(editAnchorsCtl, {
    id: editAnchorsOpts?.toolId,
    keybinding: editAnchorsOpts?.keybinding,
    cursor: editAnchorsOpts?.cursor,
    overlayStyle: editAnchorsOpts?.overlayStyle,
    onExit: () => setEditingId(null),
  });

  const editAnchorsToolId = editAnchorsOpts?.toolId ?? 'edit-anchors';

  const registry = useMemo(
    () => ({ select, [editAnchorsToolId]: editAnchorsTool }),
    [select, editAnchorsTool, editAnchorsToolId],
  );

  const tools = useTools({
    active: editingId ? editAnchorsToolId : 'select',
    registry,
  });

  // `useTools` only reads `active` on the initial render; later flips have to
  // go through `setActive`. Mirror `editingId` → active slot here so the
  // mode-flip stays a single source of truth (the helper's `editingId`).
  const want = editingId ? editAnchorsToolId : 'select';
  useEffect(() => {
    if (tools.active !== want) tools.setActive(want);
  }, [tools, want]);

  const onDoubleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const canvas = target.tagName === 'CANVAS'
      ? (target as HTMLCanvasElement)
      : target.querySelector('canvas');
    if (!canvas) return;
    let wx: number;
    let wy: number;
    const cw = clientToWorldRef.current;
    if (cw) {
      [wx, wy] = cw(canvas, e.clientX, e.clientY);
    } else {
      const r = canvas.getBoundingClientRect();
      wx = e.clientX - r.left;
      wy = e.clientY - r.top;
    }
    const ids = pickEveryRef.current(wx, wy);
    const filter = editingFilterRef.current ?? ((picked: readonly string[]) => picked[0] ?? null);
    const next = filter(ids);
    if (next !== null) setEditingId(next);
  }, []);

  return { tools, onDoubleClick, editingId };
}
