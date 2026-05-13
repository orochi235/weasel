import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  asNodeId,
  Canvas,
  cloneByAltDrag,
  createHistory,
  createMoveToIndexOp,
  dispatchApplyBatch,
  selectFromMarquee,
  useAlign,
  useBooleans,
  useClipboard,
  useCloneTool,
  useDelete,
  useDistribute,
  useDuplicate,
  useEllipseTool,
  useFlip,
  useGroup,
  useHandTool,
  useInsertTool,
  useKeybindings,
  useLassoTool,
  useLineTool,
  useNudge,
  usePencilTool,
  usePolygonTool,
  useReorder,
  useSelectAll,
  useAction,
  useSelection,
  usePublishSelection,
  useSelectTool,
  useStarTool,
  useTextTool,
  useTools,
  useUndoRedo,
  useUngroup,
  useUserPenTool,
  useWheelPanTool,
  useWheelZoomTool,
  useKeyboardZoomTool,
  createTextLayer,
  createPenPreviewLayer,
  createPathLayer,
  scalePathToBounds,
  translatePath,
  createDeleteOp,
  createSetTextOp,
  useTextEdit,
  pointInTextPose,
  caretIndexAt,
  boundsOfPath,
  PathBuilder,
  viewToTransform,
  worldToScreen,
  type ClipboardSnapshot,
  type Group,
  type History,
  type NodeId,
  type Path,
  type PolygonPath,
  type RenderLayer,
  type TextStyle,
} from '@orochi235/weasel';
// `lockAspectWithModifier` is exported only from the `/resize` subpath; the
// top-level kit index omits it (snapToGrid/clampMinSize sit alongside, and
// each has resize/move/insert variants that the top-level can't disambiguate).
// Import directly from the subpath module — vite's `@orochi235/weasel/*` alias
// resolves to `src/subpaths/*` at runtime; the explicit path keeps tsc happy
// without adding a new path mapping.
import { lockAspectWithModifier } from '../../../src/interactions/gestures/resize/behaviors/lockAspect';
import type { DrawCommand } from '@orochi235/weasel/renderer';
import {
  CommandPalette,
  useCommandPaletteShortcut,
  LayerList,
  type LayerListItem,
  PropertiesPanel,
  ToolPalette,
  PropertyRow,
  PropertyAxisInput,
  PropertyColorInput,
  PropertyNumberInput,
  PropertyButton,
  PropertyReadOnly,
  PropertyTextInput,
  PropertySelect,
  PropertyMiniLabel,
  PropertySwatchGrid,
} from '@orochi235/weasel-ui';
import '@orochi235/weasel-theme/tokens.css';
import { ActionBar } from './ActionBar';
import {
  ActiveSwatches,
  DEFAULT_FILL,
  DEFAULT_STROKE,
  paintToString,
  type ActivePaint,
} from './ActiveSwatches';
import { objToSvgNode, svgNodesToObjs, downloadSvg, pickSvgFile } from './svgInterop';
import { parseSvg, serializeSvg } from '@orochi235/weasel-svg';
import { KindIcon, PageIcon } from './kindIcons';

interface View { x: number; y: number; scale: number }

/**
 * Per-document metadata. Sits at the root of Swillustrator's scene: every
 * item lives logically inside a Document, the way SVG elements live
 * inside an `<svg viewBox=...>` root. `size` maps directly to the viewBox
 * dimensions on save/load. v1 holds size only; future fields (title,
 * units, dpi, color profile, …) accumulate here.
 */
interface Document {
  size: { width: number; height: number };
}

/** Synthetic LayerList id representing the document/page row. Never appears
 *  in the scene's selection — swillustrator tracks Page selection in its
 *  own `pageSelected` state so existing selection-aware logic (delete,
 *  duplicate, property updates) no-ops while the Page row is active. */
const PAGE_ROW_ID = '__swill_page__';

/** Paper-size presets in world units (px @ 96 dpi). Driven by the
 *  Properties-panel selector — the user picks a preset, doc.size
 *  follows. A4 is rounded to whole px from 210mm × 297mm. */
const PAPER_PRESETS = {
  letter: { width: 816,  height: 1056 },  // 8.5" × 11"
  a4:     { width: 794,  height: 1123 },  // 210 mm × 297 mm
  legal:  { width: 816,  height: 1344 },  // 8.5" × 14"
} as const;

type PaperSize = keyof typeof PAPER_PRESETS;

const PAPER_SIZE_OPTIONS: Array<{ value: PaperSize; label: string }> = [
  { value: 'letter', label: 'US Letter' },
  { value: 'a4', label: 'A4' },
  { value: 'legal', label: 'Legal' },
];

/** US Letter at 96 dpi. */
const DEFAULT_DOC_SIZE = PAPER_PRESETS.letter;

// Garden-ish palette borrowed from eric. Used by the Colors swatch grid.
const PALETTE: { value: string; label: string }[] = [
  { value: '#7fb069', label: 'Leaf' },
  { value: '#4a7c59', label: 'Forest' },
  { value: '#d4a574', label: 'Sand' },
  { value: '#c97c5d', label: 'Terracotta' },
  { value: '#b03030', label: 'Tomato' },
  { value: '#e8c547', label: 'Sunflower' },
  { value: '#6b8cae', label: 'Sky' },
  { value: '#3a5a7c', label: 'Indigo' },
  { value: '#8e6c8a', label: 'Plum' },
  { value: '#d4c4a8', label: 'Cream' },
  { value: '#3a2e22', label: 'Bark' },
  { value: '#1a130d', label: 'Soil' },
];

type Kind = 'rect' | 'text' | 'path';
interface BaseObj { id: string; kind: Kind; x: number; y: number; width: number; height: number }
interface RectObj extends BaseObj { kind: 'rect'; fill: string; stroke: string; strokeWidth: number }
interface TextObj extends BaseObj { kind: 'text'; text: string; style?: TextStyle }
interface PathObj extends BaseObj { kind: 'path'; path: PolygonPath; closed: boolean; fill: string; stroke: string; strokeWidth: number }
type Obj = RectObj | TextObj | PathObj;
interface Pose { x: number; y: number; width: number; height: number }


/** Translate a single rect-pose-shaped object by (dx, dy). Used for clipboard
 *  paste offset, group bound shifts, and the generic Obj patcher. */
function translateObj(o: Obj, dx: number, dy: number): Obj {
  return { ...o, x: o.x + dx, y: o.y + dy };
}

// ─── Shape-tool geometry builders ───────────────────────────────────────
// Each builder produces a `PolygonPath` from the tool's commit-time inputs.
// Lives at module scope so it's testable in isolation and doesn't capture
// component state.

/** Magic-number for the cubic-Bezier approximation of a circular quadrant.
 *  Gives <1% max error vs. a true circle — the canonical "kappa". */
const ELLIPSE_KAPPA = 0.5522847498307936;

/** Closed ellipse path approximated by 4 cubic-Bezier segments, inscribed
 *  in the given bounding rect. */
function ellipsePath(bounds: { x: number; y: number; width: number; height: number }): PolygonPath {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const rx = bounds.width / 2;
  const ry = bounds.height / 2;
  const ox = rx * ELLIPSE_KAPPA;
  const oy = ry * ELLIPSE_KAPPA;
  const b = new PathBuilder();
  b.moveTo(cx + rx, cy);
  b.curveTo(cx + rx, cy + oy, cx + ox, cy + ry, cx, cy + ry);
  b.curveTo(cx - ox, cy + ry, cx - rx, cy + oy, cx - rx, cy);
  b.curveTo(cx - rx, cy - oy, cx - ox, cy - ry, cx, cy - ry);
  b.curveTo(cx + ox, cy - ry, cx + rx, cy - oy, cx + rx, cy);
  b.close();
  return b.build();
}

/** Open polyline of two anchors — the line tool's geometry. */
function linePath(a: { x: number; y: number }, b: { x: number; y: number }): PolygonPath {
  const pb = new PathBuilder();
  pb.moveTo(a.x, a.y);
  pb.lineTo(b.x, b.y);
  return pb.build();
}

/** Closed regular polygon: N vertices evenly spaced on a circle of `radius`
 *  centered at `center`, rotated so the first vertex lies at `rotation`. */
function regularPolygonPath(
  center: { x: number; y: number },
  radius: number,
  rotation: number,
  sides: number,
): PolygonPath {
  const b = new PathBuilder();
  for (let i = 0; i < sides; i++) {
    const t = rotation + (i / sides) * Math.PI * 2;
    const x = center.x + radius * Math.cos(t);
    const y = center.y + radius * Math.sin(t);
    if (i === 0) b.moveTo(x, y); else b.lineTo(x, y);
  }
  b.close();
  return b.build();
}

/** Closed star: `2 * points` vertices alternating between `outerRadius` and
 *  `innerRadius`, centered at `center`, rotated so the first outer vertex
 *  lies at `rotation`. */
function starPath(
  center: { x: number; y: number },
  outerRadius: number,
  innerRadius: number,
  rotation: number,
  points: number,
): PolygonPath {
  const b = new PathBuilder();
  const n = points * 2;
  for (let i = 0; i < n; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const t = rotation + (i / n) * Math.PI * 2;
    const x = center.x + r * Math.cos(t);
    const y = center.y + r * Math.sin(t);
    if (i === 0) b.moveTo(x, y); else b.lineTo(x, y);
  }
  b.close();
  return b.build();
}

/** Synthesize a kit-flavored `Path` for any Obj — used by useBooleans to read
 *  a world-space path per selected id. RectObj and TextObj get RectPath;
 *  PathObj returns its embedded polygon. */
function pathForObj(o: Obj): Path {
  if (o.kind === 'path') return o.path;
  return { kind: 'rect', x: o.x, y: o.y, width: o.width, height: o.height };
}

export function App() {
  // ---- Backing state ----------------------------------------------------
  // `itemsRef.current` is the canonical mutable source of truth. React's
  // `items` mirrors it for rendering. Ops mutate `itemsRef.current` directly
  // (so subsequent ops in the same batch see updates) and then publish to
  // React via setItems. Groups and root z-order live in parallel refs.
  const [items, setItems] = useState<Obj[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [, forcePaint] = useState(0);

  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });

  // The Document is the conceptual root of the scene. All items live inside
  // it. `size` is the only field today; it drives the rendered page area,
  // the SVG viewBox on export, and (eventually) the printable surface.
  const [doc, setDoc] = useState<Document>(() => ({ size: { ...DEFAULT_DOC_SIZE } }));
  // Active fill/stroke — what new shapes use. Independent of selection;
  // changing these doesn't affect existing objects, and selecting an object
  // doesn't update these. The swatch widget in the left sidebar surfaces them.
  const [activeFill, setActiveFill] = useState<ActivePaint>({ kind: 'solid', color: '#7fb069' });
  const [activeStroke, setActiveStroke] = useState<ActivePaint>({ kind: 'solid', color: '#1a130d' });
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(1);
  // Last-focused swatch — `/` toggles its kind between 'solid' and 'none'.
  const [focusedSwatch, setFocusedSwatch] = useState<'fill' | 'stroke'>('fill');
  const [pageSelected, setPageSelected] = useState(false);
  // Refs so the action `run` callbacks read the latest values without
  // having to re-register on every state change.
  const activeFillRef = useRef(activeFill);
  activeFillRef.current = activeFill;
  const activeStrokeRef = useRef(activeStroke);
  activeStrokeRef.current = activeStroke;
  const focusedSwatchRef = useRef(focusedSwatch);
  focusedSwatchRef.current = focusedSwatch;
  // D — reset both swatches to defaults (white fill / black stroke).
  useAction(useMemo(() => ({
    id: 'swill.swatches.defaults',
    label: 'Reset fill/stroke to defaults',
    defaultBinding: { key: 'd' },
    run: () => { setActiveFill(DEFAULT_FILL); setActiveStroke(DEFAULT_STROKE); },
  }), []));
  // X — swap fill and stroke paints.
  useAction(useMemo(() => ({
    id: 'swill.swatches.swap',
    label: 'Swap fill and stroke',
    defaultBinding: { key: 'x' },
    run: () => {
      const f = activeFillRef.current;
      const s = activeStrokeRef.current;
      setActiveFill(s);
      setActiveStroke(f);
    },
  }), []));
  // / — toggle the last-focused swatch between solid and 'none'.
  useAction(useMemo(() => ({
    id: 'swill.swatches.none',
    label: 'Toggle focused swatch / none',
    defaultBinding: { key: '/' },
    run: () => {
      const which = focusedSwatchRef.current;
      if (which === 'fill') {
        const cur = activeFillRef.current;
        setActiveFill(cur.kind === 'none' ? DEFAULT_FILL : { kind: 'none' });
      } else {
        const cur = activeStrokeRef.current;
        setActiveStroke(cur.kind === 'none' ? DEFAULT_STROKE : { kind: 'none' });
      }
    },
  }), []));
  // String-shaped aliases used by the Properties panel (which takes plain
  // hex strings via PropertyColorInput) and the per-object scene fill /
  // stroke fields. `paintToString` returns '' for the 'none' kind, which
  // the renderers treat as "skip this paint".
  const fillColor = paintToString(activeFill);
  const strokeColor = paintToString(activeStroke);
  const strokeWidth = activeStrokeWidth;
  const setFillColor = (c: string) => setActiveFill({ kind: 'solid', color: c });
  const setStrokeColor = (c: string) => setActiveStroke({ kind: 'solid', color: c });
  const setStrokeWidth = setActiveStrokeWidth;
  const [docTitle, setDocTitle] = useState('Untitled');
  // PaperSize is derived from doc.size by reverse-lookup. Choosing a
  // preset writes doc.size through to the new dimensions; the selector
  // highlights whichever preset currently matches (defaults to 'letter'
  // when doc.size is custom or doesn't match any preset).
  const paperSize: PaperSize = useMemo(() => {
    for (const k of Object.keys(PAPER_PRESETS) as PaperSize[]) {
      const p = PAPER_PRESETS[k];
      if (p.width === doc.size.width && p.height === doc.size.height) return k;
    }
    return 'letter';
  }, [doc.size.width, doc.size.height]);
  const setPaperSize = useCallback((next: PaperSize) => {
    setDoc((d) => ({ ...d, size: { ...PAPER_PRESETS[next] } }));
  }, []);
  const [gridDensity, setGridDensity] = useState(8);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteShortcut(paletteOpen, setPaletteOpen);
  // Publish our selection to the surrounding <SelectionContextProvider> so the
  // command palette can show a "N selected" header alongside its commands.

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const selection = useSelection({ mode: 'multi' });
  usePublishSelection(selection.current);
  const fillRef = useRef(fillColor);
  fillRef.current = fillColor;
  const strokeRef = useRef(strokeColor);
  strokeRef.current = strokeColor;
  const strokeWidthRef = useRef(strokeWidth);
  strokeWidthRef.current = strokeWidth;
  const nextId = useRef(1);

  // Cursor position in world coords — pulled by clipboard's getDropPoint so
  // paste lands under the cursor (matching Figma/Illustrator).
  const cursorWorldRef = useRef<{ worldX: number; worldY: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  // Page-shadow div hosts the canvas + the useTextEdit contenteditable overlay.
  const pageShadowRef = useRef<HTMLDivElement | null>(null);
  // Canvas-host size. The canvas DOM element fills its container fully;
  // a ResizeObserver tracks the container so the canvas re-sizes on window
  // resize / sidebar toggles. Starts at zero so the initial-center effect
  // below knows to wait until the first real measurement arrives — using
  // a positive default would race the layout effect and center the doc
  // against the wrong dimensions on first paint.
  const [hostSize, setHostSize] = useState({ width: 0, height: 0 });
  // After the text tool inserts a node, queue an immediate startEdit on it so
  // single-click-to-place lands directly in edit mode (Illustrator-style).
  const pendingTextEditRef = useRef<string | null>(null);

  // ---- Mutable backing helpers -----------------------------------------
  // Publish the backing arrays to React. We re-create the array references
  // so React sees a fresh value — content unchanged otherwise. forcePaint is
  // a fallback for changes that don't go through these setters (rare).
  const publish = useCallback(() => {
    setItems(itemsRef.current.slice());
    setGroups(groupsRef.current.slice());
  }, []);

  // ---- Adapter (shared by every kit hook below) ------------------------
  // Designed for synchronous op application: writers mutate `itemsRef.current`
  // in place, then `publish()` syncs to React. Each individual op call is
  // wrapped through `applyOps` (below) which publishes once per batch.
  const adapterRef = useRef<unknown>(null);

  // History is created once, bound to the live adapter through a Proxy so
  // op.apply receives the current adapter on every dispatch (adapter is
  // rebuilt each render; history holds a stable receiver).
  const historyRef = useRef<History | null>(null);
  if (historyRef.current === null) {
    const proxy = new Proxy({}, {
      get(_target, prop) {
        const a = adapterRef.current as Record<string, unknown> | null;
        return a ? a[prop as string] : undefined;
      },
    });
    historyRef.current = createHistory(proxy, { coalesceWindowMs: 500 });
  }

  // Wrap applyOps through history. The hooks call `dispatchApplyBatch`,
  // which calls our `applyOps`. We delegate to history.applyOps (which
  // applies the ops AND pushes onto the undo stack).
  const applyOps = useCallback((ops: { apply: (a: unknown) => void; invert: () => { apply: (a: unknown) => void; invert: () => unknown } }[], label?: string) => {
    historyRef.current?.applyOps(ops as never, label ?? 'Edit');
    publish();
  }, [publish]);

  // Build the adapter every render but with stable behavior (methods read
  // from refs, never from closure locals). The kit hooks capture `adapter`
  // into their own refs so a new reference here is fine.
  const adapter = useMemo(() => {
    const a = {
      // --- node + pose access ---
      getNode: (id: string): Obj | undefined => itemsRef.current.find((o) => o.id === id),
      getNodes: (): Obj[] => itemsRef.current,
      getPose: (id: string): Pose => {
        const o = itemsRef.current.find((x) => x.id === id);
        return o ? { x: o.x, y: o.y, width: o.width, height: o.height } : { x: 0, y: 0, width: 0, height: 0 };
      },
      setPose: (id: string, pose: Pose) => {
        const i = itemsRef.current.findIndex((o) => o.id === id);
        if (i < 0) return;
        const prev = itemsRef.current[i];
        // For text nodes, scale fontSize proportionally to height so the
        // glyphs fill the resized box. 0.7 ≈ cap-height ratio, matching
        // the rule the text-tool's `commitInsert` uses to seed fontSize.
        // Floor at 8px so tiny boxes stay readable.
        if (prev.kind === 'text' && pose.height !== prev.height) {
          const fontSize = Math.max(8, Math.round(pose.height * 0.7));
          const style = { ...(prev.style ?? {}), fontSize };
          itemsRef.current[i] = { ...prev, ...pose, style };
        } else if (prev.kind === 'path') {
          // Rescale the polygon geometry to fit the new pose so resize
          // handles actually deform the curve, not just the bounding box.
          // Translation-only changes skip the scale (faster path + avoids
          // sub-pixel drift through repeated multiplies).
          const moved = pose.width !== prev.width || pose.height !== prev.height;
          const path = moved
            ? scalePathToBounds(prev.path, {
                kind: 'rect',
                x: pose.x, y: pose.y,
                width: pose.width, height: pose.height,
              }) as PolygonPath
            : translatePath(prev.path, pose.x - prev.x, pose.y - prev.y) as PolygonPath;
          itemsRef.current[i] = { ...prev, ...pose, path };
        } else {
          itemsRef.current[i] = { ...prev, ...pose };
        }
      },
      // Used by createSetTextOp; called from useTextEdit's commit through applyOps.
      setText: (id: string, text: string) => {
        const i = itemsRef.current.findIndex((o) => o.id === id);
        if (i < 0) return;
        const o = itemsRef.current[i];
        if (o.kind !== 'text') return;
        itemsRef.current[i] = { ...o, text };
      },
      // --- structural mutators (ops use these directly) ---
      insertNode: (n: Obj) => {
        // Re-add at original index if we have one (helps undo of mid-stack
        // deletes restore the right z-order). Otherwise push to top.
        if (!itemsRef.current.find((o) => o.id === n.id)) {
          itemsRef.current.push(n);
        }
      },
      removeNode: (id: string) => {
        const i = itemsRef.current.findIndex((o) => o.id === id);
        if (i >= 0) itemsRef.current.splice(i, 1);
        // Cascade: drop the id from any group memberships so dangling refs
        // don't survive an undo cycle. Groups themselves are removed by
        // dissolveGroupOp (the ungroup hook batches that explicitly).
        for (const g of groupsRef.current) {
          const j = g.members.indexOf(id);
          if (j >= 0) g.members.splice(j, 1);
        }
      },
      // --- selection ---
      // `adapterMethods.getSelection` returns the branded `NodeId[]`. Action
      // hooks (Delete, Duplicate, Group, etc.) type-check against NodeId[];
      // the lower-level Insert/Move/Resize adapters declare `string[]` —
      // since NodeId is a branded string, NodeId[] structurally satisfies
      // both.
      getSelection: selection.adapterMethods.getSelection,
      setSelection: selection.adapterMethods.setSelection,
      // --- hit-testing ---
      hitTestArea: (rect: Pose) =>
        itemsRef.current
          .filter((o) => o.x < rect.x + rect.width && o.x + o.width > rect.x && o.y < rect.y + rect.height && o.y + o.height > rect.y)
          .map((o) => o.id),
      hitTestLasso: (polygon: { x: number; y: number }[]) => {
        // Default behavior matches what useLassoTool's selectFromLasso wants:
        // simple AABB-intersect against the polygon's bounding box. Good
        // enough for v1 — the kit's selectFromLasso applies the real
        // polygon-vs-rect test internally via a separate adapter path; if
        // that's missing the lasso falls back to the rect intersect we feed
        // here (close enough for Swillustrator's simple shapes).
        if (polygon.length < 3) return [];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of polygon) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        const rect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        return itemsRef.current
          .filter((o) => o.x < rect.x + rect.width && o.x + o.width > rect.x && o.y < rect.y + rect.height && o.y + o.height > rect.y)
          .map((o) => o.id);
      },
      // --- batch dispatch (labeled → history, no label → transient) ---
      applyOps,
      // --- z-order (sibling order = items array order) ---
      getParent: (_id: string): string | null => null,
      getChildren: (parentId: string | null): string[] => {
        // Virtual groups are flat — they only matter for selection/group ops,
        // not for sibling z-order. Treat every leaf as a root child.
        if (parentId !== null) return [];
        return itemsRef.current.map((o) => o.id);
      },
      setChildOrder: (parentId: string | null, ids: string[]) => {
        if (parentId !== null) return;
        const byId = new Map(itemsRef.current.map((o) => [o.id, o] as const));
        const next: Obj[] = [];
        for (const id of ids) {
          const o = byId.get(id);
          if (o) next.push(o);
        }
        // Preserve any items missing from `ids` (shouldn't happen — reorder
        // ops always pass the full child list — but be defensive).
        for (const o of itemsRef.current) {
          if (!ids.includes(o.id)) next.push(o);
        }
        itemsRef.current.length = 0;
        itemsRef.current.push(...next);
      },
      // --- groups (virtual) ---
      getGroup: (id: string): Group | undefined => groupsRef.current.find((g) => g.id === id),
      getGroupsForMember: (id: string): string[] =>
        groupsRef.current.filter((g) => g.members.includes(id)).map((g) => g.id),
      insertGroup: (g: Group) => {
        if (!groupsRef.current.find((x) => x.id === g.id)) groupsRef.current.push({ ...g, members: [...g.members] });
      },
      removeGroup: (id: string) => {
        const i = groupsRef.current.findIndex((g) => g.id === id);
        if (i >= 0) groupsRef.current.splice(i, 1);
      },
      addToGroup: (gid: string, ids: string[]) => {
        const g = groupsRef.current.find((x) => x.id === gid);
        if (!g) return;
        for (const id of ids) if (!g.members.includes(id)) g.members.push(id);
      },
      removeFromGroup: (gid: string, ids: string[]) => {
        const g = groupsRef.current.find((x) => x.id === gid);
        if (!g) return;
        g.members = g.members.filter((m) => !ids.includes(m));
      },
      // --- clipboard / insert ---
      commitInsert: (b: Pose): Obj => {
        const id = `r${nextId.current++}`;
        return {
          id, kind: 'rect',
          x: b.x, y: b.y, width: b.width, height: b.height,
          fill: fillRef.current, stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
        };
      },
      commitPaste: (
        clip: ClipboardSnapshot,
        offset: { dx: number; dy: number },
        ctx?: { dropPoint?: { worldX: number; worldY: number } },
      ): Obj[] => {
        const src = clip.items as Obj[];
        if (src.length === 0) return [];
        let dx = offset.dx;
        let dy = offset.dy;
        if (ctx?.dropPoint) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const o of src) {
            if (o.x < minX) minX = o.x;
            if (o.y < minY) minY = o.y;
            if (o.x + o.width > maxX) maxX = o.x + o.width;
            if (o.y + o.height > maxY) maxY = o.y + o.height;
          }
          dx = ctx.dropPoint.worldX - (minX + maxX) / 2;
          dy = ctx.dropPoint.worldY - (minY + maxY) / 2;
        }
        return src.map((o) => ({ ...translateObj(o, dx, dy), id: `${o.kind[0]}${nextId.current++}` } as Obj));
      },
      getPasteOffset: (): { dx: number; dy: number } => ({ dx: 16, dy: 16 }),
      snapshotSelection: (ids: string[]): ClipboardSnapshot => ({
        items: ids
          .map((id) => itemsRef.current.find((o) => o.id === id))
          .filter((o): o is Obj => !!o)
          .map((o) => ({ ...o })),
      }),
      // --- booleans helpers ---
      getWorldPath: (id: string): Path | undefined => {
        const o = itemsRef.current.find((x) => x.id === id);
        return o ? pathForObj(o) : undefined;
      },
      compareZ: (aId: string, bId: string): number => {
        const ai = itemsRef.current.findIndex((o) => o.id === aId);
        const bi = itemsRef.current.findIndex((o) => o.id === bId);
        return ai - bi;
      },
      createPathNode: (path: Path): { id: string } => {
        // Wrap a Path as a PathObj. useBooleans always returns PolygonPath
        // from its kernels, so the rect branch is just an escape hatch.
        const id = `b${nextId.current++}`;
        if (path.kind === 'rect') {
          const rectNode: RectObj = {
            id, kind: 'rect',
            x: path.x, y: path.y, width: path.width, height: path.height,
            fill: fillRef.current, stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
          };
          return rectNode;
        }
        const b = boundsOfPath(path);
        const pathNode: PathObj = {
          id, kind: 'path',
          x: b.x, y: b.y, width: b.width, height: b.height,
          path, closed: true,
          fill: fillRef.current, stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
        };
        return pathNode;
      },
      getZOrder: (id: string): { parentId: string | null; index: number } | undefined => {
        const idx = itemsRef.current.findIndex((o) => o.id === id);
        if (idx < 0) return undefined;
        return { parentId: null, index: idx };
      },
      // --- duplicate ---
      // useDuplicate calls this for each selected id; we mint a fresh id and
      // translate by the hook's default (dx:8, dy:8). Returns the new Obj
      // which the kit wraps in an InsertOp. The NodeId brand is structural
      // (a tagged string) so we cast on the way out.
      cloneNode: (id: NodeId, offset: { dx: number; dy: number }): { id: NodeId } & Obj => {
        const src = itemsRef.current.find((o) => o.id === id);
        const newId = `${(src?.kind ?? 'r')[0]}${nextId.current++}`;
        if (!src) {
          const stub: RectObj = {
            id: newId, kind: 'rect', x: 0, y: 0, width: 0, height: 0,
            fill: fillRef.current, stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
          };
          return stub as { id: NodeId } & Obj;
        }
        const next = { ...translateObj(src, offset.dx, offset.dy), id: newId };
        return next as { id: NodeId } & Obj;
      },
    };
    return a;
  }, [applyOps, selection]);
  adapterRef.current = adapter;

  // ---- Host-size observation ------------------------------------------
  // The canvas fills its host div; we track the host's CSS size so the
  // canvas's pixel buffer matches and the scene layer knows how much area
  // to fill. Initial layout uses an effect to read clientWidth on mount.
  // useLayoutEffect (not useEffect) so the first measurement lands and
  // commits BEFORE the browser paints — the user sees the canvas at its
  // real size from frame one, and the initial-center effect below sees
  // real dimensions on its first run.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    setHostSize({ width: el.clientWidth, height: el.clientHeight });
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setHostSize({ width: cr.width, height: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Center the doc in the viewport on first layout. useLayoutEffect so
  // the centered view commits before paint — no flash of an off-center
  // doc on initial load. Runs once when the host size is first known;
  // after that, the user drives panning via wheelPan / hand tool, so we
  // don't auto-re-center on resize.
  const didInitialCenter = useRef(false);
  useLayoutEffect(() => {
    if (didInitialCenter.current) return;
    if (hostSize.width <= 0 || hostSize.height <= 0) return;
    didInitialCenter.current = true;
    setView((v) => ({
      x: doc.size.width / 2 - hostSize.width / (2 * v.scale),
      y: doc.size.height / 2 - hostSize.height / (2 * v.scale),
      scale: v.scale,
    }));
  }, [hostSize.width, hostSize.height, doc.size.width, doc.size.height]);

  // ---- Tools -----------------------------------------------------------
  const select = useSelectTool<Obj, Pose>(adapter, {
    pickEvery: (wx, wy) =>
      itemsRef.current
        .filter((o) => wx >= o.x && wx <= o.x + o.width && wy >= o.y && wy <= o.y + o.height)
        .map((o) => o.id),
    boundsOf: (id) => {
      const o = itemsRef.current.find((x) => x.id === id);
      return o ? { x: o.x, y: o.y, width: o.width, height: o.height } : null;
    },
    drawGhost: (obj, pose): DrawCommand[] => {
      if (!obj) return [];
      if (obj.kind === 'rect') {
        const cmds: DrawCommand[] = [{
          kind: 'path',
          path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
          fill: { color: obj.fill },
        }];
        if (obj.strokeWidth > 0) {
          cmds.push({
            kind: 'path',
            path: { kind: 'rect', x: pose.x + 0.5, y: pose.y + 0.5, width: pose.width, height: pose.height },
            stroke: { paint: { color: obj.stroke }, width: obj.strokeWidth },
          });
        }
        return cmds;
      }
      return [{
        kind: 'path',
        path: { kind: 'rect', x: pose.x + 0.5, y: pose.y + 0.5, width: pose.width, height: pose.height },
        stroke: { paint: { color: '#888' }, width: 1, dash: [3, 3] },
      }];
    },
    getNode: (id) => itemsRef.current.find((o) => o.id === id) ?? null,
    // Shift-drag a resize handle for aspect-locked scale; matches the
    // Illustrator / Figma convention.
    resize: { behaviors: [lockAspectWithModifier()] },
    // Marquee is opt-in at the kit level — illustration apps want
    // rubber-band selection across drawn objects.
    areaSelect: { behaviors: [selectFromMarquee()] },
  });

  const insert = useInsertTool<Obj, Pose>(adapter, { minBounds: { width: 4, height: 4 } });
  const hand = useHandTool();
  const text = useTextTool<TextObj>({
    hitExisting: ({ x: worldX, y: worldY }) => {
      const hit = [...itemsRef.current].reverse().find(
        (o): o is TextObj => o.kind === 'text'
          && worldX >= o.x && worldX <= o.x + o.width
          && worldY >= o.y && worldY <= o.y + o.height,
      );
      return hit ? hit.id : null;
    },
    pointInsert: ({ x: worldX, y: worldY }) => {
      const id = `t${nextId.current++}`;
      pendingTextEditRef.current = id;
      return {
        id, kind: 'text',
        x: worldX, y: worldY, width: 180, height: 28,
        text: '',
        style: { fontSize: 16, fill: { fill: 'solid', color: fillRef.current } },
      };
    },
    commitInsert: ({ x, y, width, height }) => {
      const id = `t${nextId.current++}`;
      pendingTextEditRef.current = id;
      // Match font size to box height so the text actually fills the marquee.
      // 0.7 ≈ glyph cap-height ratio for most sans-serifs; rounds to a sane
      // px size and floors at 8 so wee boxes stay readable.
      const fontSize = Math.max(8, Math.round(height * 0.7));
      return {
        id, kind: 'text',
        x, y, width, height,
        text: '',
        style: { fontSize, fill: { fill: 'solid', color: fillRef.current } },
      };
    },
  });

  // ---- In-place text editing (contenteditable overlay) -------------------
  // Mounts a contenteditable above the canvas while a text node is being
  // edited. `setText` flows through history so undo restores prior content.
  const textEdit = useTextEdit({
    container: pageShadowRef.current,
    getText: (id) => {
      const o = itemsRef.current.find((x) => x.id === id);
      return o?.kind === 'text' ? o.text : '';
    },
    getStyle: (id) => {
      const o = itemsRef.current.find((x) => x.id === id);
      return o?.kind === 'text' ? o.style : undefined;
    },
    getScreenPose: (id) => {
      const o = itemsRef.current.find((x) => x.id === id);
      if (!o || o.kind !== 'text') return null;
      return {
        x: o.x, y: o.y, width: o.width, height: o.height,
        fontSize: o.style?.fontSize ?? 16,
      };
    },
    setText: (id, text) => {
      const o = itemsRef.current.find((x) => x.id === id);
      if (!o || o.kind !== 'text') return;
      // Commit with empty text deletes the node — matches Illustrator's
      // behavior and prevents invisible orphan text boxes from being left
      // behind by stray clicks or all-content-deleted edits.
      if (text === '') {
        applyOps([createDeleteOp({ node: o, label: 'Delete empty text' })], 'Delete empty text');
        return;
      }
      const from = o.text;
      if (from === text) return;
      applyOps([createSetTextOp({ id, from, to: text, label: 'Edit text' })], 'Edit text');
    },
  });

  // Detect a freshly-inserted text node (queued in `pendingTextEditRef` by the
  // text tool's pointInsert/commitInsert) and immediately enter edit mode so
  // a single click places + types — matching Illustrator's behavior.
  useEffect(() => {
    const pid = pendingTextEditRef.current;
    if (!pid) return;
    if (!items.some((o) => o.id === pid)) return;
    pendingTextEditRef.current = null;
    textEdit.startEdit(pid);
  }, [items, textEdit]);

  // Clear Page selection whenever a scene selection appears through any
  // other path (marquee, viewport click, keyboard select-all, etc.).
  // Length-only dep is intentional: we only react to the empty → non-empty
  // transition. Content swaps within a non-empty selection don't matter
  // because `pageSelected` is already false in that case.
  useEffect(() => {
    if (pageSelected && selection.current.length > 0) {
      setPageSelected(false);
    }
  }, [pageSelected, selection.current.length]);

  const wheelZoom = useWheelZoomTool();
  const wheelPan = useWheelPanTool();
  const keyZoom = useKeyboardZoomTool();

  const pen = useUserPenTool<PathObj>({
    wrapPath: (path, { closed }): PathObj => {
      const b = boundsOfPath(path);
      const id = `p${nextId.current++}`;
      return {
        id, kind: 'path',
        x: b.x, y: b.y, width: b.width, height: b.height,
        path, closed,
        fill: fillRef.current, stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
      };
    },
    adapter: {
      addNode: (pose) => {
        // Skip history for in-flight pen previews — they're not user-visible
        // edits. The final wrapped path lands as a single insert below.
        itemsRef.current.push(pose);
        publish();
        return pose.id;
      },
      setSelection: () => {},
    },
  });

  // ---- Shape tools (ellipse / line / polygon / star / pencil) ----------
  // Each tool produces a `PathObj` from a kit-built `PolygonPath`. Fill /
  // stroke / strokeWidth are pulled from the current refs so palette
  // selections apply immediately.

  /** Wrap a freshly-built path as a `PathObj` with the current style. */
  const pathToObj = useCallback((path: PolygonPath, closed: boolean): PathObj => {
    const b = boundsOfPath(path);
    return {
      id: `p${nextId.current++}`,
      kind: 'path',
      x: b.x, y: b.y, width: b.width, height: b.height,
      path, closed,
      fill: fillRef.current,
      stroke: strokeRef.current,
      strokeWidth: strokeWidthRef.current,
    };
  }, []);

  const ellipse = useEllipseTool<PathObj>({
    minBounds: { width: 2, height: 2 },
    create: (bounds) => pathToObj(ellipsePath(bounds), true),
  });

  const line = useLineTool<PathObj>({
    minLength: 2,
    create: (a, b) => pathToObj(linePath(a, b), false),
  });

  const polygon = usePolygonTool<PathObj>({
    minRadius: 2,
    sides: 6,
    create: (center, radius, rotation, sides) =>
      pathToObj(regularPolygonPath(center, radius, rotation, sides), true),
  });

  const star = useStarTool<PathObj>({
    minRadius: 2,
    points: 5,
    innerRatio: 0.5,
    create: (center, outer, inner, rotation, points) =>
      pathToObj(starPath(center, outer, inner, rotation, points), true),
  });

  const pencil = usePencilTool<PathObj>({
    tolerance: 1.5,
    closeThreshold: 8,
    create: (path, { closed }) => pathToObj(path, closed),
  });

  // Lasso selects shapes whose AABB intersects the lasso polygon (via
  // hitTestArea on the lasso's bounding box — Swillustrator's shapes are
  // simple enough that this lines up with user expectations).
  const lasso = useLassoTool(adapter, { mode: 'intersect' });

  // Alt-drag clone — `cloneSelection: true` clones the whole selection when
  // the down-id is part of it (Figma/Illustrator UX).
  const clone = useCloneTool<Obj, Pose>(adapter, {
    behaviors: [cloneByAltDrag()],
    drawOne: (obj, pose): DrawCommand[] => {
      if (obj.kind === 'rect') {
        return [{
          kind: 'path',
          path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
          fill: { color: obj.fill },
        }];
      }
      return [{
        kind: 'path',
        path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
        stroke: { paint: { color: '#888' }, width: 1, dash: [3, 3] },
      }];
    },
    cloneSelection: true,
  });

  // `clone` lives in the ambient slot: it only claims when alt is held at
  // pointerdown over a body, so plain drags fall through to whichever
  // registered tool is active. Putting it in `registry` would require the
  // user to switch tools to enable alt-drag clone.
  const tools = useTools({
    active: 'select',
    registry: { select, lasso, insert, ellipse, line, polygon, star, pen, pencil, hand, text },
    ambient: [wheelZoom, wheelPan, keyZoom, clone],
  });
  useKeybindings(tools, {
    overrides: {
      select: { key: 'V' },
      insert: { key: 'R' },
      lasso: { key: 'L' },
      ellipse: { key: 'E' },
      line: { key: '\\' },
      polygon: { key: 'G' },
      pencil: { key: 'N' },
    },
  });

  // ---- Selection-aware actions (each binds keys + exposes a callable) --
  useSelectAll({
    getSelection: () => [...selection.current],
    listAll: () => itemsRef.current.map((o) => asNodeId(o.id)),
    setSelection: (ids) => selection.set(ids),
  });
  const { deleteSelection } = useDelete(adapter);
  const { duplicate } = useDuplicate<Pose>(adapter);
  useNudge<Pose>(adapter, { step: 1, shiftStep: 10 });
  const { bringForward, sendBackward, bringToFront, sendToBack } = useReorder(adapter);
  const { group } = useGroup(adapter);
  const { ungroup } = useUngroup(adapter);
  const { align } = useAlign<Pose>(adapter);
  const { distribute } = useDistribute<Pose>(adapter);
  const { flip } = useFlip<Pose>(adapter, { pivot: 'union' });
  const booleans = useBooleans(adapter);
  const { undo, redo } = useUndoRedo(historyRef.current, { bindKeyboard: true });

  // Track clipboard emptiness for the ActionBar enable/disable. Bumped via
  // a state tick after every copy/cut.
  const [clipboardTick, setClipboardTick] = useState(0);
  const clipboard = useClipboard<Obj>(adapter, {
    getSelection: () => selection.current.map((id) => asNodeId(id)),
    getDropPoint: () => cursorWorldRef.current,
    onPaste: () => setClipboardTick((n) => n + 1),
  });

  // canUndo/canRedo for the ActionBar — re-evaluated on every render. The
  // hook returns adapter-bound booleans; we read them directly from the
  // History instance instead of through useUndoRedo (which only emits
  // imperative callables).
  const canUndo = historyRef.current.canUndo();
  const canRedo = historyRef.current.canRedo();

  // ---- Cursor tracking for paste & drop point -------------------------
  // Pulled by useClipboard's getDropPoint. We track in screen space and
  // convert per-call so view zoom/pan is honored.
  const onStagePointerMove = (e: React.PointerEvent) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Convert client → page-local → world. Page-local is the SCSS-padded
    // stage; world is page-local minus the view offset, scaled by 1/scale.
    // Canvas is positioned at the page-shadow center via margin auto, so
    // bounding rect already accounts for the offset.
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    cursorWorldRef.current = {
      worldX: (localX - view.x) / view.scale,
      worldY: (localY - view.y) / view.scale,
    };
  };
  const onStagePointerLeave = () => { cursorWorldRef.current = null; };

  // ---- Render layers ---------------------------------------------------

  // Page layer: draws the document's printable surface as a white rect
  // with a soft drop-shadow at world (0, 0). Rendered below the scene so
  // user content paints inside it.
  const pageLayer: RenderLayer<unknown> = useMemo(
    () => ({
      id: 'doc-page',
      label: 'Document page',
      space: 'screen' as const,
      draw: (_data, view) => {
        const t = viewToTransform(view);
        const w = doc.size.width * view.scale;
        const h = doc.size.height * view.scale;
        const [x0, y0] = worldToScreen(0, 0, t);
        // Multi-step soft shadow approximation — DrawCommands have no
        // blur primitive today, so we stack three offset rects with
        // falling alpha to fake the falloff.
        const shadowSteps: DrawCommand[] = [
          { kind: 'path', path: { kind: 'rect', x: x0 + 6, y: y0 + 10, width: w, height: h }, fill: { fill: 'solid', color: 'rgba(0, 0, 0, 0.12)' } },
          { kind: 'path', path: { kind: 'rect', x: x0 + 3, y: y0 + 6,  width: w, height: h }, fill: { fill: 'solid', color: 'rgba(0, 0, 0, 0.16)' } },
          { kind: 'path', path: { kind: 'rect', x: x0 + 1, y: y0 + 3,  width: w, height: h }, fill: { fill: 'solid', color: 'rgba(0, 0, 0, 0.20)' } },
        ];
        return [
          ...shadowSteps,
          { kind: 'path', path: { kind: 'rect', x: x0, y: y0, width: w, height: h }, fill: { fill: 'solid', color: '#fafafa' } },
        ];
      },
    }),
    [doc.size],
  );

  const textLayer: RenderLayer<unknown> = createTextLayer<TextObj>({
    getTexts: () => itemsRef.current.filter((o): o is TextObj => o.kind === 'text'),
    getPose: (n) => {
      // Consult the active tool's previewPose so move/resize gestures
      // show the text rendered at its in-flight pose (not the committed
      // one) while a drag is in progress.
      const tool = tools.registry[tools.hotkeyEngaged ?? tools.active];
      const preview = tool?.previewPose?.(n.id) as Pose | undefined;
      const pose = preview ?? { x: n.x, y: n.y, width: n.width, height: n.height };
      // For text, mid-drag we also need to scale fontSize from preview height
      // so the glyphs visibly resize with the box (mirrors the setPose rule).
      const style = pose.height !== n.height
        ? { ...(n.style ?? {}), fontSize: Math.max(8, Math.round(pose.height * 0.7)) }
        : n.style;
      return { ...pose, text: n.text, style };
    },
    // Hide the currently-editing node — the contenteditable overlay draws it.
    isHidden: (n) => textEdit.isEditing(n.id),
    // Clip glyphs to the declared bounds so an oversized string doesn't
    // bleed past its box.
    clipToBounds: true,
  });

  const pathLayer: RenderLayer<unknown> = createPathLayer<PathObj>({
    id: 'paths',
    label: 'Paths',
    getNodes: () => itemsRef.current.filter((o): o is PathObj => o.kind === 'path'),
    getPath: (n) => {
      // Consult the active tool's previewPose so a drag/move/resize shows
      // the path at its in-flight pose. Pure translation takes the fast
      // path; any dimension change goes through scalePathToBounds so the
      // curve deforms with the handles in real time.
      const tool = tools.registry[tools.hotkeyEngaged ?? tools.active];
      const preview = tool?.previewPose?.(n.id) as Pose | undefined;
      if (!preview) return n.path;
      const scaled = preview.width !== n.width || preview.height !== n.height;
      if (scaled) {
        return scalePathToBounds(n.path, {
          kind: 'rect',
          x: preview.x, y: preview.y,
          width: preview.width, height: preview.height,
        });
      }
      const dx = preview.x - n.x;
      const dy = preview.y - n.y;
      return dx === 0 && dy === 0 ? n.path : translatePath(n.path, dx, dy);
    },
    getFill: (n) => n.closed ? { fill: 'solid', color: n.fill, alpha: 0.6 } : null,
    getStroke: (n) => ({ paint: { fill: 'solid', color: n.stroke }, width: n.strokeWidth }),
  });

  const penPreview: RenderLayer<unknown> = useMemo(
    () => createPenPreviewLayer({ penTool: pen }),
    [pen],
  );

  const activeOrEngaged = tools.hotkeyEngaged ?? tools.active;

  // --- Selection-aware mutation helpers ---
  // Re-read items each call so back-to-back changes within a render coalesce.
  // Routed through applyOps so each property change is an undo step.
  const updateSelected = (patch: (o: Obj) => Obj): void => {
    const ids = new Set<string>(selection.current);
    if (ids.size === 0) return;
    setItems((cur) => cur.map((o) => (ids.has(o.id) ? patch(o) : o)));
    // Mirror to backing store immediately (so the next action sees the
    // mutation). Inputs that emit per-keystroke skip history for now —
    // wiring transform ops per keystroke would coalesce into history but
    // requires capturing from/to per id. Keep it simple: direct mutation,
    // future work can wrap these in transform ops.
    for (let i = 0; i < itemsRef.current.length; i++) {
      const o = itemsRef.current[i];
      if (ids.has(o.id)) itemsRef.current[i] = patch(o);
    }
  };

  const selectedItems = items.filter((o) => (selection.current as readonly string[]).includes(o.id));
  const primary = selectedItems[0];
  const hasStrokeProps = primary && primary.kind !== 'text';

  // Apply property changes to all selected items that support the property,
  // including kind-specific paths (text fill lives in style.fill.color).
  const applyFillToSelection = (color: string): void => {
    updateSelected((o) => {
      if (o.kind === 'rect' || o.kind === 'path') return { ...o, fill: color };
      if (o.kind === 'text') {
        const prevFill = o.style?.fill;
        const nextFill = prevFill && prevFill.fill === 'solid'
          ? { ...prevFill, color }
          : { fill: 'solid' as const, color };
        return { ...o, style: { ...(o.style ?? {}), fill: nextFill } };
      }
      return o;
    });
  };
  const applyStrokeToSelection = (color: string): void => {
    updateSelected((o) => (o.kind === 'rect' || o.kind === 'path') ? { ...o, stroke: color } : o);
  };
  const applyStrokeWidthToSelection = (w: number): void => {
    updateSelected((o) => (o.kind === 'rect' || o.kind === 'path') ? { ...o, strokeWidth: w } : o);
  };

  // Read primary's current values for the panel inputs.
  const primaryFill = primary
    ? (primary.kind === 'text'
        ? (primary.style?.fill?.fill === 'solid' ? primary.style.fill.color : '#000000')
        : primary.fill)
    : fillColor;
  const primaryStroke = primary && primary.kind !== 'text' ? primary.stroke : strokeColor;
  const primaryStrokeWidth = primary && primary.kind !== 'text' ? primary.strokeWidth : strokeWidth;

  // ---- LayerList items (top of stack first) ----------------------------
  // Items array is bottom-up (index 0 = back). LayerList shows top first
  // so we reverse for display and translate the targetIndex back to a
  // bottom-up scene index in onReorder.
  const layerItems: LayerListItem[] = useMemo(() => {
    const objectRows: LayerListItem[] = [...items].reverse().map((o) => ({
      id: o.id,
      label: (
        <span className="swill-layer-label">
          <KindIcon kind={o.kind} />
          <span>{o.id}</span>
        </span>
      ),
    }));
    const pageRow: LayerListItem = {
      id: PAGE_ROW_ID,
      locked: true,
      label: (
        <span className="swill-layer-label swill-layer-label-page">
          <PageIcon />
          <span>Page</span>
        </span>
      ),
    };
    return [...objectRows, pageRow];
  }, [items]);
  const onLayerReorder = (ids: string[], targetIndex: number) => {
    // LayerList index is top-down. Scene index is bottom-up.
    const total = itemsRef.current.length;
    // After deletes of `ids` (the move pulls them out of their old slots),
    // the destination row sits at `total - targetIndex - ids.length` in
    // bottom-up coords. Clamp at 0 just in case.
    const sceneIndex = Math.max(0, total - targetIndex - ids.length);
    dispatchApplyBatch(
      adapter,
      [createMoveToIndexOp({ ids, parentId: null, index: sceneIndex })],
      'Reorder',
    );
  };

  // forcePaint isn't currently triggered anywhere but kept for future
  // direct-mutation paths that bypass setItems.
  void forcePaint;

  return (
    <div className="swill-app">
      <div className="swill-disclaimer">
        This dumpster fire is not associated with Adobe or Illustrator. Obviously.
      </div>

      <ActionBar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => { undo(); publish(); }}
        onRedo={() => { redo(); publish(); }}
        hasSelection={selection.current.length > 0}
        hasMultiSelection={selection.current.length >= 2}
        selectionSize={selection.current.length}
        onDelete={() => deleteSelection()}
        onDuplicate={() => duplicate()}
        onCopy={() => clipboard.copy()}
        onCut={() => clipboard.cut()}
        onPaste={() => clipboard.paste()}
        clipboardEmpty={clipboard.isEmpty()}
        onBringForward={() => bringForward()}
        onSendBackward={() => sendBackward()}
        onBringToFront={() => bringToFront()}
        onSendToBack={() => sendToBack()}
        onGroup={() => group()}
        onUngroup={() => ungroup()}
        onAlign={(edge) => align(edge)}
        onDistribute={(axis) => distribute(axis)}
        onFlip={(axis) => flip(axis)}
        booleansAdapter={adapter}
        booleansActions={booleans}
        onNew={(size) => {
          // Reset the scene, history, selection, and document size. The
          // initial-center effect won't re-fire on its own (it's gated by
          // `didInitialCenter`), so we apply the centered view inline using
          // the new dimensions and current host size.
          itemsRef.current = [];
          groupsRef.current = [];
          historyRef.current?.clear();
          selection.set([]);
          const preset = PAPER_PRESETS[size];
          setDoc({ size: { ...preset } });
          setView((v) => ({
            x: preset.width / 2 - hostSize.width / (2 * v.scale),
            y: preset.height / 2 - hostSize.height / (2 * v.scale),
            scale: v.scale,
          }));
          publish();
        }}
        onSaveSvg={() => {
          const svgNodes = itemsRef.current.map(objToSvgNode);
          const svg = serializeSvg(svgNodes, {
            viewBox: { x: 0, y: 0, width: doc.size.width, height: doc.size.height },
          });
          downloadSvg(svg, `${docTitle || 'untitled'}.svg`);
        }}
        onOpenSvg={async () => {
          const text = await pickSvgFile();
          if (text == null) return;
          const { nodes, warnings } = parseSvg(text);
          if (warnings.length > 0) {
            // eslint-disable-next-line no-console
            console.warn('Open SVG warnings:', warnings);
          }
          const next = svgNodesToObjs(nodes, () => `i${nextId.current++}`);
          itemsRef.current = next;
          groupsRef.current = [];
          historyRef.current?.clear();
          selection.set([]);
          publish();
        }}
      />

      <div className="swill-body">
        <aside className="swill-sidebar">
          <ToolPalette tools={tools} />
          <ActiveSwatches
            fill={activeFill}
            stroke={activeStroke}
            focused={focusedSwatch}
            onChangeFill={setActiveFill}
            onChangeStroke={setActiveStroke}
            onFocus={setFocusedSwatch}
          />
          <div className="swill-sidebar-spacer" />
          <button
            className="swill-tool-button"
            onClick={() => setView({ x: 0, y: 0, scale: 1 })}
            title="Reset view"
            type="button"
          >
            <span>Reset</span>
            <span className="key">view</span>
          </button>
        </aside>

        <main
          ref={stageRef}
          className="swill-stage"
          onPointerMove={onStagePointerMove}
          onPointerLeave={onStagePointerLeave}
        >
          <div
            ref={pageShadowRef}
            className="swill-canvas-host"
            onDoubleClick={(e) => {
              const canvas = e.target instanceof HTMLCanvasElement ? e.target : null;
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              // Canvas pixel coords → world coords via the active view.
              const cx = (e.clientX - rect.left) / view.scale + view.x;
              const cy = (e.clientY - rect.top) / view.scale + view.y;
              const texts = itemsRef.current.filter((o): o is TextObj => o.kind === 'text');
              let target: TextObj | null = null;
              for (let i = texts.length - 1; i >= 0; i--) {
                if (pointInTextPose(cx, cy, texts[i])) { target = texts[i]; break; }
              }
              if (!target) return;
              const ctx = canvas.getContext('2d');
              if (!ctx) { textEdit.startEdit(target.id); return; }
              const caret = caretIndexAt(ctx, cx, cy, {
                x: target.x, y: target.y, width: target.width, height: target.height,
                text: target.text, style: target.style,
              });
              textEdit.startEdit(target.id, { caret });
            }}
          >
            <Canvas
              // The canvas fills its host area fully. View pan/zoom
              // navigate within the canvas; the document page itself is
              // drawn as `pageLayer` (a white rect at world origin) so
              // the canvas is no longer page-shaped.
              width={hostSize.width}
              height={hostSize.height}
              adapter={adapter as never}
              items={items}
              setItems={setItems}
              view={view}
              onViewChange={setView}
              tools={tools}
              selection={selection}
              layers={{
                doc: { layer: pageLayer, before: 'scene' },
                scene: {
                  drawOne: (_obj, pose): DrawCommand[] => {
                    const o = pose as unknown as Obj;
                    if (o.kind !== 'rect') return [];
                    const cmds: DrawCommand[] = [{
                      kind: 'path',
                      path: { kind: 'rect', x: o.x, y: o.y, width: o.width, height: o.height },
                      fill: { color: o.fill },
                    }];
                    if (o.strokeWidth > 0) {
                      cmds.push({
                        kind: 'path',
                        path: { kind: 'rect', x: o.x + 0.5, y: o.y + 0.5, width: o.width, height: o.height },
                        stroke: { paint: { color: o.stroke }, width: o.strokeWidth },
                      });
                    }
                    return cmds;
                  },
                },
                text: { layer: textLayer, before: 'selectionOverlay' },
                paths: { layer: pathLayer, before: 'selectionOverlay' },
                penPreview: { layer: penPreview, before: 'selectionOverlay' },
                selectionOverlay: { rotationHandle: true },
              }}
            />
          </div>
        </main>

        <div
          className="swill-sidebar-resize"
          onPointerDown={(e) => {
            e.preventDefault();
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            const startX = e.clientX;
            const startW = sidebarWidth;
            const move = (ev: PointerEvent) => {
              const next = Math.max(220, Math.min(420, startW + (startX - ev.clientX)));
              setSidebarWidth(next);
            };
            const up = () => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
        />
        <RightSidebar
          width={sidebarWidth}
          primary={primary}
          selectedItems={selectedItems}
          primaryFill={primaryFill}
          primaryStroke={primaryStroke}
          primaryStrokeWidth={primaryStrokeWidth}
          hasStrokeProps={!!hasStrokeProps}
          fillColor={fillColor}
          setFillColor={setFillColor}
          strokeColor={strokeColor}
          setStrokeColor={setStrokeColor}
          strokeWidth={strokeWidth}
          setStrokeWidth={setStrokeWidth}
          docTitle={docTitle}
          setDocTitle={setDocTitle}
          paperSize={paperSize}
          setPaperSize={setPaperSize}
          gridDensity={gridDensity}
          setGridDensity={setGridDensity}
          view={view}
          setView={setView}
          itemsLen={items.length}
          updateSelected={updateSelected}
          applyFillToSelection={applyFillToSelection}
          applyStrokeToSelection={applyStrokeToSelection}
          applyStrokeWidthToSelection={applyStrokeWidthToSelection}
          deselect={() => selection.clear()}
          deleteSelection={deleteSelection}
          layerItems={layerItems}
          selectedIds={pageSelected ? [PAGE_ROW_ID] : selection.current.map((id) => String(id))}
          onSelectLayers={(ids) => {
            if (ids.length === 1 && ids[0] === PAGE_ROW_ID) {
              setPageSelected(true);
              selection.set([]);
            } else {
              setPageSelected(false);
              selection.set(ids.map((id) => asNodeId(id)));
            }
          }}
          onLayerReorder={onLayerReorder}
          // Force a re-publish whenever the clipboard tick advances —
          // ensures the paste-button's clipboardEmpty flag stays current.
          clipboardTick={clipboardTick}
          pageSelected={pageSelected}
        />
      </div>

      <div className="swill-statusbar">
        <span>tool: {activeOrEngaged}</span>
        <span>sel: {selection.current.length}</span>
        <span>groups: {groups.length}</span>
        <span>fill: {fillColor}</span>
        <span>stroke: {strokeColor}</span>
        <span>zoom: {(view.scale * 100).toFixed(0)}%</span>
        <span className="swill-statusbar-spacer">⌘K for commands</span>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

// ----------------------------------------------------------------------
// RightSidebar — split out so the main App stays readable. Receives every
// piece of state it touches as props; no internal state of its own.
interface RightSidebarProps {
  width: number;
  primary: Obj | undefined;
  selectedItems: Obj[];
  primaryFill: string;
  primaryStroke: string;
  primaryStrokeWidth: number;
  hasStrokeProps: boolean;
  fillColor: string;
  setFillColor: (s: string) => void;
  strokeColor: string;
  setStrokeColor: (s: string) => void;
  strokeWidth: number;
  setStrokeWidth: (n: number) => void;
  docTitle: string;
  setDocTitle: (s: string) => void;
  paperSize: PaperSize;
  setPaperSize: (s: PaperSize) => void;
  gridDensity: number;
  setGridDensity: (n: number) => void;
  view: View;
  setView: (updater: (cur: View) => View) => void;
  itemsLen: number;
  updateSelected: (patch: (o: Obj) => Obj) => void;
  applyFillToSelection: (color: string) => void;
  applyStrokeToSelection: (color: string) => void;
  applyStrokeWidthToSelection: (w: number) => void;
  deselect: () => void;
  deleteSelection: () => NodeId[];
  layerItems: LayerListItem[];
  selectedIds: string[];
  onSelectLayers: (ids: string[]) => void;
  onLayerReorder: (ids: string[], targetIndex: number) => void;
  clipboardTick: number;
  pageSelected: boolean;
}

function RightSidebar(p: RightSidebarProps) {
  // clipboardTick is only present so React re-renders this subtree when
  // the clipboard mutates; the value itself is unused.
  useEffect(() => { /* re-render on clipboardTick change */ }, [p.clipboardTick]);
  const { primary, selectedItems } = p;
  return (
    <aside
      className="swill-sidebar right"
      // CSS custom property — a width drag handle has no class-based
      // equivalent; the variable lets CSS handle min/max clamping.
      style={{ ['--swill-right-width' as string]: `${p.width}px` } as React.CSSProperties}
    >
      {p.pageSelected ? (
        <PropertiesPanel title="Page">
          <PropertyRow label="Title">
            <PropertyTextInput value={p.docTitle} onChange={p.setDocTitle} />
          </PropertyRow>
          <PropertyRow label="Paper">
            <PropertySelect
              value={p.paperSize}
              onChange={p.setPaperSize}
              options={PAPER_SIZE_OPTIONS}
            />
          </PropertyRow>
        </PropertiesPanel>
      ) : primary ? (
        <PropertiesPanel title={`Selection (${selectedItems.length})`}>
          <PropertyRow label="Kind">
            <PropertyReadOnly>
              {primary.kind}{selectedItems.length > 1 ? ` +${selectedItems.length - 1}` : ''}
            </PropertyReadOnly>
          </PropertyRow>
          <PropertyRow label="Position">
            <PropertyAxisInput axis="X" value={Math.round(primary.x)} onChange={(v) => p.updateSelected((o) => ({ ...o, x: v }))} />
            <PropertyAxisInput axis="Y" value={Math.round(primary.y)} onChange={(v) => p.updateSelected((o) => ({ ...o, y: v }))} />
          </PropertyRow>
          <PropertyRow label="Size">
            <PropertyAxisInput axis="W" value={Math.round(primary.width)} onChange={(v) => p.updateSelected((o) => ({ ...o, width: Math.max(1, v) }))} min={1} />
            <PropertyAxisInput axis="H" value={Math.round(primary.height)} onChange={(v) => p.updateSelected((o) => ({ ...o, height: Math.max(1, v) }))} min={1} />
          </PropertyRow>
          <PropertyRow label="Fill">
            <PropertyColorInput value={p.primaryFill} onChange={p.applyFillToSelection} />
          </PropertyRow>
          {p.hasStrokeProps && (
            <>
              <PropertyRow label="Stroke">
                <PropertyColorInput value={p.primaryStroke} onChange={p.applyStrokeToSelection} />
              </PropertyRow>
              <PropertyRow label="Width">
                <PropertyNumberInput value={p.primaryStrokeWidth} onChange={p.applyStrokeWidthToSelection} min={0} max={20} step={1} span={4} />
              </PropertyRow>
            </>
          )}
          <PropertyRow>
            <PropertyButton onClick={p.deselect} span={6}>Deselect</PropertyButton>
            <PropertyButton variant="danger" span={6} onClick={() => p.deleteSelection()}>
              Delete
            </PropertyButton>
          </PropertyRow>
        </PropertiesPanel>
      ) : (
        <PropertiesPanel title="Defaults">
          <PropertyRow label="Fill">
            <PropertyColorInput value={p.fillColor} onChange={p.setFillColor} />
          </PropertyRow>
          <PropertyRow label="Stroke">
            <PropertyColorInput value={p.strokeColor} onChange={p.setStrokeColor} />
          </PropertyRow>
          <PropertyRow label="Width">
            <PropertyNumberInput value={p.strokeWidth} onChange={p.setStrokeWidth} min={0} max={20} step={1} span={4} />
          </PropertyRow>
        </PropertiesPanel>
      )}

      <PropertiesPanel title="Colors">
        <PropertyRow>
          <PropertySwatchGrid
            value={primary ? p.primaryFill : p.fillColor}
            options={PALETTE}
            onChange={(v) => (primary ? p.applyFillToSelection(v) : p.setFillColor(v))}
          />
        </PropertyRow>
      </PropertiesPanel>

      <PropertiesPanel title="Layers">
        <div className="swill-layerlist-host">
          <LayerList
            items={p.layerItems}
            selectedIds={p.selectedIds}
            onSelect={p.onSelectLayers}
            onReorder={p.onLayerReorder}
            empty="No objects yet"
          />
        </div>
      </PropertiesPanel>

      <PropertiesPanel title="Document">
        <PropertyRow label="Title">
          <PropertyTextInput value={p.docTitle} onChange={p.setDocTitle} />
        </PropertyRow>
        <PropertyRow label="Paper">
          <PropertySelect
            value={p.paperSize}
            onChange={p.setPaperSize}
            options={PAPER_SIZE_OPTIONS}
          />
        </PropertyRow>
      </PropertiesPanel>

      <PropertiesPanel title="View">
        <PropertyRow label="Zoom">
          <PropertyMiniLabel span={2}>%</PropertyMiniLabel>
          <PropertyNumberInput
            value={Math.round(p.view.scale * 100)}
            onChange={(v) => p.setView((cur) => ({ ...cur, scale: Math.max(0.1, v / 100) }))}
            span={4}
            min={10}
            max={400}
            step={10}
          />
        </PropertyRow>
        <PropertyRow label="Grid">
          <PropertyNumberInput value={p.gridDensity} onChange={p.setGridDensity} span={4} min={2} max={64} step={1} />
        </PropertyRow>
        <PropertyRow>
          <PropertyButton onClick={() => p.setView(() => ({ x: 0, y: 0, scale: 1 }))} span={12}>
            Reset view
          </PropertyButton>
        </PropertyRow>
      </PropertiesPanel>

      <div className="swill-section-label swill-scene-label">Scene</div>
      <div className="swill-scene-count">
        {p.itemsLen} object{p.itemsLen === 1 ? '' : 's'}
      </div>
    </aside>
  );
}
