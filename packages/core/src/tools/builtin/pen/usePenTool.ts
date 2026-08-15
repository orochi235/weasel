import { useCallback, useMemo, useReducer, useRef, createElement } from 'react';
import { defineTool } from '../../defineTool';
import type { Tool } from '../../types';
import type { ToolPrefGroup } from '../../prefs';
import type { Action } from 'interactions/actions/registry';
import { ActionDisabledReason } from 'interactions/actions/registry';
import type { ActionDeps, InvocationCtx } from 'interactions/actions/invoker';
import type { ViewApi } from 'interactions/actions/depSchema';
import { withinPxRadius } from 'core/viewport/pxExtent';
import { PenIcon } from '../../../icons';
import { PathBuilder } from 'features/paths/builder';
import type { PolygonPath } from 'features/paths/types';
import { constrainTo45 } from '../../../util/constrainTo45';

/**
 * In-progress pen anchor. `outHandle` is set when the anchor was placed via
 * click-drag (smooth anchor); undefined for click-placed corners.
 * `inHandle` is mirrored from the previous anchor's outHandle on segment
 * emission unless `altBroken` is set on that previous anchor.
 */
export interface PenAnchor {
  x: number;
  y: number;
  outHandle?: { x: number; y: number };
  inHandle?: { x: number; y: number };
  /** True when Alt was held during the outgoing-handle drag — the next
   *  anchor's incoming handle is NOT mirrored from this one. */
  altBroken?: boolean;
}

export interface PenSubpath {
  anchors: PenAnchor[]; // LOCAL PenAnchor — in-progress
  closed: boolean;
}

/**
 * Mutable scratch shared across pen-tool gestures. The hook keeps a stable
 * reference to a single instance and `initScratch` returns it on every call,
 * so click-by-click state survives gesture boundaries and the preview layer
 * can read the same object.
 *
 * ## The pen creates paths and nothing else
 *
 * Reshaping an existing path is anchor editing: double-click a path to
 * enter edit mode, then use the `editAnchors` / `insertPathAnchor` /
 * `nudgeAnchors` / `deleteAnchors` / `marqueeAnchors` / `cutPathAtAnchor`
 * Actions.
 *
 * The pen used to carry a second, private implementation of all of that,
 * with its own scratch mode, hit-test override, overlay, and undo
 * plumbing. It was reachable only through a `getPathObj` option whose
 * contract required `pose.kind` to be `'polygon'` or `'rect'` — which no
 * kit-created node has, including the ones the pen itself creates. So it
 * was dead in every consumer while shadowing the live implementation, and
 * the two had drifted. Its geometry now lives in
 * `features/paths/anchorEdits.ts`, driven by those Actions.
 */
export interface PenScratch {
  finishedSubpaths: PenSubpath[];
  current: PenSubpath | null;
  cursor: { x: number; y: number } | null;
  draggingHandleAt: number | null;
  closeHintActive: boolean;
}

export interface UsePenToolOptions<TPose> {
  /** Wrap a finished PolygonPath in the consumer's pose type. */
  wrapPath: (path: PolygonPath, opts: { closed: boolean }) => TPose;
  /** Insert + select adapter. */
  adapter: {
    addNode: (pose: TPose) => string;
    setSelection: (ids: string[]) => void;
  };
  /** Auto-select the new object after commit. Default `true`. */
  autoSelect?: boolean;
  /** When true (default), clicking the first anchor to close a subpath
   *  commits immediately — the closed region renders with its fill right
   *  away. When false, the closed subpath stays in scratch so the user can
   *  start another subpath; commit then fires on Enter / tool-switch /
   *  ⌘-click / double-click, producing a compound path. */
  autoCommitOnClose?: boolean;
  /** Screen-px hit radius for "click first anchor to close". Default `8`.
   *  Measured as a screen-space circle, so it stays round under non-uniform
   *  zoom; aligns with `useSelectTool.handleHitRadius`. */
  closeHitRadius?: number;
  /** Optional point snapper applied to every world-space coordinate the
   *  pen records or previews — anchor positions (corner clicks, smooth-
   *  drag base point), the rubber-band cursor, and the outgoing-handle
   *  target. Receives raw world coords; returns snapped world coords.
   *  Wire to `gridSnapStrategy`-style spacing via the consumer:
   *
   *      snapPoint: (p) => ({
   *        x: Math.round(p.x / SPACING) * SPACING,
   *        y: Math.round(p.y / SPACING) * SPACING,
   *      })
   *
   *  Pen state (anchor handles, etc.) is computed AFTER snapping so the
   *  visible geometry stays grid-aligned. */
  snapPoint?: (p: { x: number; y: number }) => { x: number; y: number };
}

function freshScratch(): PenScratch {
  return {
    finishedSubpaths: [],
    current: null,
    cursor: null,
    draggingHandleAt: null,
    closeHintActive: false,
  };
}

function resetScratch(s: PenScratch): void {
  s.finishedSubpaths = [];
  s.current = null;
  s.cursor = null;
  s.draggingHandleAt = null;
  s.closeHintActive = false;
}

/** Total anchors across finished subpaths plus the in-progress one. */
function anchorCount(s: PenScratch): number {
  return (s.current ? s.current.anchors.length : 0)
    + s.finishedSubpaths.reduce((n, sp) => n + sp.anchors.length, 0);
}

/** Build a PolygonPath from the pen's accumulated subpaths. Cubic segments
 *  are emitted whenever either endpoint of the segment carries a handle:
 *  the previous anchor's outHandle (or itself if absent) and the current
 *  anchor's inHandle (mirrored from previous outHandle unless altBroken,
 *  or itself if neither). Pure corner segments fall through to L. */
function buildPath(
  subpaths: PenSubpath[],
  trailing: PenSubpath | null,
): PolygonPath {
  const b = new PathBuilder();
  const all = [...subpaths];
  if (trailing && trailing.anchors.length > 0) all.push(trailing);
  for (const sp of all) {
    if (sp.anchors.length === 0) continue;
    const first = sp.anchors[0];
    b.moveTo(first.x, first.y);
    for (let i = 1; i < sp.anchors.length; i++) {
      const prev = sp.anchors[i - 1];
      const curr = sp.anchors[i];
      const out = prev.outHandle;
      const inH = curr.inHandle ?? mirrorHandle(prev, out);
      if (out || curr.inHandle) {
        const c1 = out ?? { x: prev.x, y: prev.y };
        const c2 = inH ?? { x: curr.x, y: curr.y };
        b.curveTo(c1.x, c1.y, c2.x, c2.y, curr.x, curr.y);
      } else {
        b.lineTo(curr.x, curr.y);
      }
    }
    if (sp.closed) {
      // For a closed subpath, the closing segment runs from the last anchor
      // back to the first. If the last anchor has an outHandle, emit a curve.
      const last = sp.anchors[sp.anchors.length - 1];
      const first0 = sp.anchors[0];
      const out = last.outHandle;
      const inH = first0.inHandle ?? mirrorHandle(last, out);
      if (out || first0.inHandle) {
        const c1 = out ?? { x: last.x, y: last.y };
        const c2 = inH ?? { x: first0.x, y: first0.y };
        b.curveTo(c1.x, c1.y, c2.x, c2.y, first0.x, first0.y);
      }
      b.close();
    }
  }
  return b.build();
}

function mirrorHandle(
  anchor: PenAnchor,
  out: { x: number; y: number } | undefined,
): { x: number; y: number } | undefined {
  if (!out || anchor.altBroken) return undefined;
  return { x: 2 * anchor.x - out.x, y: 2 * anchor.y - out.y };
}

/**
 * Active-slot Tool: click + drag to build a `PolygonPath` Illustrator-style.
 *
 * State machine: Idle / Drawing / BetweenSubpaths (see design doc).
 * Click places a corner anchor; click-drag places an anchor with an
 * outgoing bezier handle; click-the-first-anchor closes the subpath; Enter
 * open-finishes; Esc discards; tool-switch commits if ≥2 anchors else
 * discards. Shift constrains the placement-drag handle to 0/45/90/135°;
 * Alt during drag breaks the handle mirror for the next segment.
 *
 * Reshaping an existing path is not this tool's job — see {@link PenScratch}.
 */
export function usePenTool<TPose>(
  options: UsePenToolOptions<TPose>,
): Tool<PenScratch> {
  const { wrapPath, adapter, autoSelect = true, autoCommitOnClose = true, closeHitRadius = 8, snapPoint } = options;

  // Persistent scratch: single ref reused across gestures so multi-click
  // state survives the dispatcher's per-gesture initScratch contract.
  const scratchRef = useRef<PenScratch | null>(null);
  if (scratchRef.current === null) scratchRef.current = freshScratch();

  // Latest options stashed so handlers see fresh values without rebuilding
  // the Tool record (which would lose scratch identity in the dispatcher).
  const optsRef = useRef({ wrapPath, adapter, autoSelect, autoCommitOnClose, closeHitRadius, snapPoint });
  optsRef.current = { wrapPath, adapter, autoSelect, autoCommitOnClose, closeHitRadius, snapPoint };

  // Scratch is a mutable ref (so click-by-click state survives the
  // dispatcher's per-gesture initScratch contract). Mutations alone don't
  // trigger React re-renders, so Canvas never re-paints and the preview
  // layer stays invisible until something else (e.g. commit) bumps host
  // state. Force a render after every scratch mutation so the host's
  // <Canvas layers={{...}}> literal gets a new identity and the paint
  // useEffect fires. Pull the trigger via ref so the memoized Tool record
  // doesn't need to rebuild.
  const [, forceRenderInternal] = useReducer((x: number) => x + 1, 0);
  const forceRenderRef = useRef(forceRenderInternal);
  forceRenderRef.current = forceRenderInternal;

  // Geometry helpers shared by the actions below. They read `optsRef` so a
  // re-render with new options is visible without rebuilding the actions
  // (which would lose the scratch identity `penPreviewLayer` reads through
  // `Tool.initScratch`).
  const commit = useCallback((s: PenScratch): void => {
    const trailing = s.current && s.current.anchors.length > 0 ? s.current : null;
    if (s.finishedSubpaths.length === 0 && !trailing) return;
    const allClosed =
      s.finishedSubpaths.every((sp) => sp.closed) &&
      (trailing === null || trailing.closed);
    const path = buildPath(s.finishedSubpaths, trailing);
    const pose = optsRef.current.wrapPath(path, { closed: allClosed });
    const id = optsRef.current.adapter.addNode(pose);
    if (optsRef.current.autoSelect) optsRef.current.adapter.setSelection([id]);
    resetScratch(s);
  }, []);

  const snap = useCallback((x: number, y: number): { x: number; y: number } => {
    const fn = optsRef.current.snapPoint;
    return fn ? fn({ x, y }) : { x, y };
  }, []);

  /** Is a world point within the close-hit radius of `(ax, ay)`? Measured as a
   *  screen-space circle, so the zone stays round under non-uniform zoom. */
  const withinCloseRadius = useCallback(
    (deps: ActionDeps, ax: number, ay: number, wx: number, wy: number): boolean => {
      const view = (deps.view as ViewApi | undefined)?.get();
      const scale = view?.scale ?? { x: 1, y: 1 };
      return withinPxRadius(ax - wx, ay - wy, optsRef.current.closeHitRadius, scale);
    },
    [],
  );

  /**
   * Actions the pen owns, registered by `useToolActions` from inside the
   * ActionsProvider — see `ToolDef.actions`.
   *
   * They close over `scratchRef`, which is why the pen needs no `Selector`
   * exposing tool scratch to the action layer: the state never leaves the
   * hook. `useMemo([])` keeps their identity stable for the same reason
   * `scratchRef` is a ref — the preview layer reads that one object.
   */
  const actions = useMemo<Action[]>(() => {
    const s = () => scratchRef.current!;

    return [
      {
        id: 'pen.placeAnchor',
        label: 'Pen — place anchor',
        eligible: { capability: 'creates-paths' },
        requires: ['view'],
        invoker: {
          timing: 'immediate' as const,
          run: (deps, params) => {
            const p = params as { pressX?: number; pressY?: number } | undefined;
            if (p?.pressX === undefined || p.pressY === undefined) return;
            // The press point, not the release: a click may drift up to the
            // drag threshold, and an anchor should land where you put the
            // pointer down. Snapping happens here rather than at press time
            // so the snapped value is what the geometry records.
            const { x: wx, y: wy } = snap(p.pressX, p.pressY);
            const scratch = s();

            // Close-on-first-anchor (>= 3 anchors). With `autoCommitOnClose`
            // on (default) this commits right away so the closed region
            // renders with its fill — Illustrator-style. With it off the
            // closed subpath stays in scratch for compound-path builds and
            // commits on Enter / tool switch.
            if (scratch.current && scratch.current.anchors.length >= 3) {
              const first = scratch.current.anchors[0];
              if (withinCloseRadius(deps, first.x, first.y, wx, wy)) {
                scratch.current.closed = true;
                scratch.finishedSubpaths.push(scratch.current);
                scratch.current = null;
                scratch.closeHintActive = false;
                if (optsRef.current.autoCommitOnClose) commit(scratch);
                forceRenderRef.current();
                return;
              }
            }

            // Otherwise: append a corner anchor, starting a subpath if needed.
            if (!scratch.current) scratch.current = { anchors: [], closed: false };
            scratch.current.anchors.push({ x: wx, y: wy });
            forceRenderRef.current();
          },
        },
      },

      {
        id: 'pen.finishOpen',
        label: 'Pen — finish open path',
        eligible: { capability: 'creates-paths' },
        // Needs an actual path to commit. Declining also lets the gesture
        // fall through: a ⌘-click with fewer than two anchors reaches the
        // plain-click binding and places an anchor instead.
        enabled: () => (anchorCount(s()) >= 2 ? true : ActionDisabledReason.NotApplicable),
        invoker: {
          timing: 'immediate' as const,
          run: (_deps, params) => {
            const scratch = s();
            const p = params as { viaDoubleClick?: boolean } | undefined;

            // A double click arrives AFTER both of its clicks, so the second
            // one has already appended an anchor. Undo exactly that before
            // committing: pop it, and drop the subpath entirely if it was the
            // only anchor in it (which happens when the FIRST click closed a
            // subpath and the second started a fresh one). The net effect
            // matches the pen's old private 300ms detector — one anchor
            // placed, path finished — while using the dispatcher's single
            // definition of a double click.
            //
            // No position check is needed: the anchor to drop is by
            // construction the one the second click just appended.
            if (p?.viaDoubleClick && scratch.current) {
              scratch.current.anchors.pop();
              if (scratch.current.anchors.length === 0) scratch.current = null;
            }

            commit(scratch);
            forceRenderRef.current();
          },
        },
      },

      {
        id: 'pen.dragHandle',
        label: 'Pen — drag out a bezier handle',
        eligible: { capability: 'creates-paths' },
        invoker: {
          timing: 'ongoing' as const,
          start: (ctx: InvocationCtx) => {
            const scratch = s();
            // `drag.start` is the pointerdown position — the dispatcher
            // buffers the press and releases it at the drag threshold, so the
            // anchor lands where the user pressed rather than where the
            // threshold happened to be crossed.
            const origin = ctx.drag?.start ?? ctx.world;
            const { x: ax, y: ay } = snap(origin.x, origin.y);
            if (!scratch.current) scratch.current = { anchors: [], closed: false };
            scratch.current.anchors.push({ x: ax, y: ay });
            scratch.draggingHandleAt = scratch.current.anchors.length - 1;
            applyOutHandle(scratch, ctx.world, ctx.modifiers.shift, optsRef.current.snapPoint);
            if (ctx.modifiers.alt) {
              scratch.current.anchors[scratch.draggingHandleAt].altBroken = true;
            }
            forceRenderRef.current();

            return {
              onMove: (moveCtx: InvocationCtx) => {
                const sm = s();
                if (sm.draggingHandleAt === null) return;
                applyOutHandle(sm, moveCtx.world, moveCtx.modifiers.shift, optsRef.current.snapPoint);
                if (moveCtx.modifiers.alt && sm.current) {
                  sm.current.anchors[sm.draggingHandleAt].altBroken = true;
                }
                forceRenderRef.current();
              },
              onEnd: (endCtx: InvocationCtx, reason: 'commit' | 'cancel') => {
                const se = s();
                if (reason === 'cancel') {
                  se.draggingHandleAt = null;
                  forceRenderRef.current();
                  return;
                }
                if (se.draggingHandleAt !== null) {
                  applyOutHandle(se, endCtx.world, endCtx.modifiers.shift, optsRef.current.snapPoint);
                  if (endCtx.modifiers.alt && se.current) {
                    se.current.anchors[se.draggingHandleAt].altBroken = true;
                  }
                  se.draggingHandleAt = null;
                }
                forceRenderRef.current();
              },
            };
          },
        },
      },

      {
        id: 'pen.finish',
        label: 'Pen — finish path',
        eligible: { capability: 'creates-paths' },
        enabled: () => (anchorCount(s()) > 0 ? true : ActionDisabledReason.NotApplicable),
        invoker: {
          timing: 'immediate' as const,
          run: () => {
            commit(s());
            forceRenderRef.current();
          },
        },
      },

      {
        id: 'pen.cancel',
        label: 'Pen — discard path',
        eligible: { capability: 'creates-paths' },
        // Declining with nothing drawn is what keeps Escape's first-match
        // ladder intact: an empty pen passes the key to `escape`, which goes
        // on to clear the selection / return to the default tool.
        enabled: () => {
          const scratch = s();
          return scratch.current !== null || scratch.finishedSubpaths.length > 0
            ? true
            : ActionDisabledReason.NotApplicable;
        },
        invoker: {
          timing: 'immediate' as const,
          run: () => {
            resetScratch(s());
            forceRenderRef.current();
          },
        },
      },
    ];
  }, [commit, snap, withinCloseRadius]);

  return useMemo(() => {
    return defineTool<PenScratch>({
      id: 'pen',
      capabilities: ['creates-paths'],
      hookName: 'usePenTool',
      // Reads the tool's own ref rather than a scratch handed in by a
      // dispatcher — the pen owns this state and nothing else needs it.
      cursor: () => (scratchRef.current?.closeHintActive ? 'pointer' : 'crosshair'),
      presentation: {
        label: 'Pen',
        icon: createElement(PenIcon),
        group: 'draw',
      },
      // Persistent-ref scratch. `penPreviewLayer` reads the in-progress path
      // by calling `Tool.initScratch()` and getting this same object back, so
      // the identity is load-bearing.
      initScratch: () => scratchRef.current!,
      actions,

      onDeactivate: () => {
        // Anything still in scratch is by definition incomplete — the user
        // hasn't closed it (close-on-first-anchor), open-finished it
        // (cmd-click), or pressed Enter. Switching tools mid-path should
        // discard, not auto-commit a stub polyline that the user didn't
        // ask for. Mirrors Escape's behavior so "stop drawing" is
        // consistent across exits.
        resetScratch(scratchRef.current!);
        forceRenderRef.current();
      },

      bindings: [
        // Plain click places an anchor; ⌘/Ctrl-click open-finishes
        // (Illustrator). Strict modifier matching keeps the two apart, and
        // `mod` resolves to meta on mac / ctrl elsewhere — the tool-route
        // grammar's modifier matcher accepted either key on either platform.
        { spec: { kind: 'click' as const, mods: { shift: 'optional' as const, alt: 'optional' as const } }, actionId: 'pen.placeAnchor' },
        { spec: { kind: 'click' as const, mods: { mod: true, shift: 'optional' as const, alt: 'optional' as const } }, actionId: 'pen.finishOpen' },
        // Double-click on the last anchor also open-finishes. This used to be
        // a private 300ms/radius check inside the click route — a fourth
        // double-click detector in a codebase that had just collapsed three
        // into one (audit 3.3).
        {
          spec: { kind: 'doubleClick' as const, mods: { shift: 'optional' as const, alt: 'optional' as const } },
          actionId: 'pen.finishOpen',
          opts: { params: { viaDoubleClick: true } },
        },
        { spec: { kind: 'drag' as const, mods: { shift: 'optional' as const, alt: 'optional' as const } }, actionId: 'pen.dragHandle' },
        { spec: { kind: 'key' as const, key: 'Enter' }, actionId: 'pen.finish' },
        { spec: { kind: 'key' as const, key: 'Escape' }, actionId: 'pen.cancel' },
      ],
    });
  }, [actions]);
}

usePenTool.prefs = {
  name: 'Pen',
  description: 'Pen-tool behavior.',
  children: {
    autoCommitOnClose: {
      kind: 'boolean',
      name: 'Auto-commit pen on close',
      description: "When you click the pen tool's first anchor to close a region, commit immediately so it renders with its fill. Off: keep the path in preview until you press Enter (lets you build a compound path from multiple closed subpaths).",
      default: true,
    },
  },
} satisfies ToolPrefGroup;

/** Point the anchor's outgoing handle at `target`, optionally snapped and
 *  optionally constrained to 45° steps. */
function applyOutHandle<S extends PenScratch>(
  s: S,
  target: { x: number; y: number },
  shift: boolean,
  snap?: (p: { x: number; y: number }) => { x: number; y: number },
): void {
  if (s.current === null || s.draggingHandleAt === null) return;
  const anchor = s.current.anchors[s.draggingHandleAt];
  const to = snap ? snap(target) : target;
  let dx = to.x - anchor.x;
  let dy = to.y - anchor.y;
  if (shift) {
    const c = constrainTo45(dx, dy);
    dx = c.dx;
    dy = c.dy;
  }
  anchor.outHandle = { x: anchor.x + dx, y: anchor.y + dy };
}
