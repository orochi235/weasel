import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  asNodeId,
  Canvas,
  cloneByAltDrag,
  createHistory,
  gridSnapStrategy,
  pointSnapToGrid,
  snap as snapBehavior,
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
  useEyedropperTool,
  useFlip,
  useGroup,
  useHandTool,
  useInsertTool,
  useKeybinding,
  useKeybindings,
  useLassoTool,
  useLineTool,
  useNudge,
  usePencilTool,
  usePolygonTool,
  useReorder,
  canBringForward,
  canSendBackward,
  useSelectAll,
  useSelection,
  usePublishSelection,
  useSelectTool,
  useResizeTool,
  useRotateTool,
  useStarTool,
  useTextTool,
  useTools,
  useUndoRedo,
  useUngroup,
  usePenTool,
  useWheelPanTool,
  useWheelZoomTool,
  useKeyboardZoomTool,
  createPenPreviewLayer,
  scalePathToBounds,
  translatePath,
  createDeleteOp,
  createInsertOp,
  createSetTextOp,
  createTransformOp,
  useTextEdit,
  pointInTextPose,
  caretIndexAt,
  boundsOfPath,
  pathContainsPoint,
  pathDistanceToPoint,
  PathBuilder,
  PATH_M,
  PATH_L,
  PATH_Z,
  rotatePoint,
  splitSubpaths,
  viewToTransform,
  worldToScreen,
  type AnyTool,
  type BooleanOp,
  type ClipboardSnapshot,
  type Group,
  type History,
  type NodeId,
  type Op,
  type Path,
  type PathFillRule,
  type PolygonPath,
  type RenderLayer,
} from '@orochi235/weasel';
// `lockAspectWithModifier` is exported only from the `/resize` subpath; the
// top-level kit index omits it (snapToGrid/clampMinSize sit alongside, and
// each has resize/move/insert variants that the top-level can't disambiguate).
// Import directly from the subpath module — vite's `@orochi235/weasel/*` alias
// resolves to `src/subpaths/*` at runtime; the explicit path keeps tsc happy
// without adding a new path mapping.
import { lockAspectWithModifier } from '../../../src/interactions/gestures/resize/behaviors/lockAspect';
// `useGridFeature` isn't on the kit's top-level barrel (only the low-level
// primitives are). Mirrors the lockAspect import above — relative path into
// `src/`, no new subpath needed.
import { useGridFeature } from '../../../src/features/grid/useGridFeature';
import type { DrawCommand } from '@orochi235/weasel/renderer';
import { viewToMat3 } from '@orochi235/weasel/renderer';
import { resolveTextStyle, toRuns, resolveRuns, dlog } from '@orochi235/weasel';
import { wrapWithRotation } from './rotationRender';
import { pointInRotatedAabb } from './rotationHitTest';
import { Sidebar, SidebarPanel, type LayerListItem } from '@orochi235/weasel-ui';
import {
  CommandPalette,
  useCommandPaletteShortcut,
  LayerList,
  HistoryList,
  type HistoryListItem,
  PropertiesPanel,
  ToolPalette,
  PropertyRow,
  PropertyAxisInput,
  PropertyColorInput,
  PropertyNumberInput,
  PropertySliderInput,
  PropertyButton,
  PropertyReadOnly,
  PropertyTextInput,
  PropertySelect,
  PropertyMiniLabel,
  PropertySwatchGrid,
} from './ui';
import '@orochi235/weasel-theme/tokens.css';
import { ActionBar } from './ActionBar';
import { PreferencesModal } from './PreferencesModal';
import {
  ActiveSwatches,
  paintToString,
  mergeAlphaFromPrev,
  toHex8,
  getAlpha01,
  withAlpha01,
  type ActivePaint,
} from './ActiveSwatches';
import { useActiveColors } from './useActiveColors';
import {
  objsToSvgNodes,
  svgNodesToObjsWithGroups,
  downloadSvg,
  pickSvgFile,
  docToSerializeOptions,
  parsedToDoc,
  SWILL_NAMESPACES,
} from './svgInterop';
import { createGroupAdapter } from './groupMembership';
import { parseSvg, serializeSvg } from '@orochi235/weasel-svg';
import { ToolIcon, PageIcon } from './kindIcons';
import { Toasts, type Toast } from './Toasts';
import { applyPoseToObj, type Obj, type Pose, type TextObj, type PathObj, type ToolKind, type PathParams } from './poseUpdate';
import { readPref, usePref } from './prefs';
import { matchesRegistryFilter } from './registry/types';
import { usePersistedScene } from './usePersistedScene';
import { createRecorder, type Recorder, type Recording } from './recorder';
import { replayRecording } from './replay';
import type { SceneSnapshot } from './sceneStore';

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

// 99-color palette laid out as 9 neutrals in row 1 (alongside the leading
// transparent swatch) + 9 hue ramps × 10 shades. Renders 10 per row in the
// Colors panel; total 100 cells including transparent.
const PALETTE: { value: string; label: string }[] = [
  { value: '#ffffffff', label: 'White' },
  { value: '#e5e5e5ff', label: 'Gray 200' },
  { value: '#d4d4d4ff', label: 'Gray 300' },
  { value: '#a3a3a3ff', label: 'Gray 400' },
  { value: '#737373ff', label: 'Gray 500' },
  { value: '#525252ff', label: 'Gray 600' },
  { value: '#404040ff', label: 'Gray 700' },
  { value: '#262626ff', label: 'Gray 800' },
  { value: '#000000ff', label: 'Black' },
  { value: '#fef2f2ff', label: 'Red 50' },
  { value: '#fee2e2ff', label: 'Red 100' },
  { value: '#fecacaff', label: 'Red 200' },
  { value: '#fca5a5ff', label: 'Red 300' },
  { value: '#f87171ff', label: 'Red 400' },
  { value: '#ef4444ff', label: 'Red 500' },
  { value: '#dc2626ff', label: 'Red 600' },
  { value: '#b91c1cff', label: 'Red 700' },
  { value: '#991b1bff', label: 'Red 800' },
  { value: '#7f1d1dff', label: 'Red 900' },
  { value: '#fff7edff', label: 'Orange 50' },
  { value: '#ffedd5ff', label: 'Orange 100' },
  { value: '#fed7aaff', label: 'Orange 200' },
  { value: '#fdba74ff', label: 'Orange 300' },
  { value: '#fb923cff', label: 'Orange 400' },
  { value: '#f97316ff', label: 'Orange 500' },
  { value: '#ea580cff', label: 'Orange 600' },
  { value: '#c2410cff', label: 'Orange 700' },
  { value: '#9a3412ff', label: 'Orange 800' },
  { value: '#7c2d12ff', label: 'Orange 900' },
  { value: '#fefce8ff', label: 'Yellow 50' },
  { value: '#fef9c3ff', label: 'Yellow 100' },
  { value: '#fef08aff', label: 'Yellow 200' },
  { value: '#fde047ff', label: 'Yellow 300' },
  { value: '#facc15ff', label: 'Yellow 400' },
  { value: '#eab308ff', label: 'Yellow 500' },
  { value: '#ca8a04ff', label: 'Yellow 600' },
  { value: '#a16207ff', label: 'Yellow 700' },
  { value: '#854d0eff', label: 'Yellow 800' },
  { value: '#713f12ff', label: 'Yellow 900' },
  { value: '#f0fdf4ff', label: 'Green 50' },
  { value: '#dcfce7ff', label: 'Green 100' },
  { value: '#bbf7d0ff', label: 'Green 200' },
  { value: '#86efacff', label: 'Green 300' },
  { value: '#4ade80ff', label: 'Green 400' },
  { value: '#22c55eff', label: 'Green 500' },
  { value: '#16a34aff', label: 'Green 600' },
  { value: '#15803dff', label: 'Green 700' },
  { value: '#166534ff', label: 'Green 800' },
  { value: '#14532dff', label: 'Green 900' },
  { value: '#f0fdfaff', label: 'Teal 50' },
  { value: '#ccfbf1ff', label: 'Teal 100' },
  { value: '#99f6e4ff', label: 'Teal 200' },
  { value: '#5eead4ff', label: 'Teal 300' },
  { value: '#2dd4bfff', label: 'Teal 400' },
  { value: '#14b8a6ff', label: 'Teal 500' },
  { value: '#0d9488ff', label: 'Teal 600' },
  { value: '#0f766eff', label: 'Teal 700' },
  { value: '#115e59ff', label: 'Teal 800' },
  { value: '#134e4aff', label: 'Teal 900' },
  { value: '#ecfeffff', label: 'Cyan 50' },
  { value: '#cffafeff', label: 'Cyan 100' },
  { value: '#a5f3fcff', label: 'Cyan 200' },
  { value: '#67e8f9ff', label: 'Cyan 300' },
  { value: '#22d3eeff', label: 'Cyan 400' },
  { value: '#06b6d4ff', label: 'Cyan 500' },
  { value: '#0891b2ff', label: 'Cyan 600' },
  { value: '#0e7490ff', label: 'Cyan 700' },
  { value: '#155e75ff', label: 'Cyan 800' },
  { value: '#164e63ff', label: 'Cyan 900' },
  { value: '#eff6ffff', label: 'Blue 50' },
  { value: '#dbeafeff', label: 'Blue 100' },
  { value: '#bfdbfeff', label: 'Blue 200' },
  { value: '#93c5fdff', label: 'Blue 300' },
  { value: '#60a5faff', label: 'Blue 400' },
  { value: '#3b82f6ff', label: 'Blue 500' },
  { value: '#2563ebff', label: 'Blue 600' },
  { value: '#1d4ed8ff', label: 'Blue 700' },
  { value: '#1e40afff', label: 'Blue 800' },
  { value: '#1e3a8aff', label: 'Blue 900' },
  { value: '#faf5ffff', label: 'Purple 50' },
  { value: '#f3e8ffff', label: 'Purple 100' },
  { value: '#e9d5ffff', label: 'Purple 200' },
  { value: '#d8b4feff', label: 'Purple 300' },
  { value: '#c084fcff', label: 'Purple 400' },
  { value: '#a855f7ff', label: 'Purple 500' },
  { value: '#9333eaff', label: 'Purple 600' },
  { value: '#7e22ceff', label: 'Purple 700' },
  { value: '#6b21a8ff', label: 'Purple 800' },
  { value: '#581c87ff', label: 'Purple 900' },
  { value: '#fdf2f8ff', label: 'Pink 50' },
  { value: '#fce7f3ff', label: 'Pink 100' },
  { value: '#fbcfe8ff', label: 'Pink 200' },
  { value: '#f9a8d4ff', label: 'Pink 300' },
  { value: '#f472b6ff', label: 'Pink 400' },
  { value: '#ec4899ff', label: 'Pink 500' },
  { value: '#db2777ff', label: 'Pink 600' },
  { value: '#be185dff', label: 'Pink 700' },
  { value: '#9d174dff', label: 'Pink 800' },
  { value: '#831843ff', label: 'Pink 900' },
];

/** Translate a single rect-pose-shaped object by (dx, dy). Used for clipboard
 *  paste offset, group bound shifts, and the generic Obj patcher. */
function translateObj(o: Obj, dx: number, dy: number): Obj {
  if (o.tool !== 'text') {
    return { ...o, x: o.x + dx, y: o.y + dy, path: translatePath(o.path, dx, dy) };
  }
  return { ...o, x: o.x + dx, y: o.y + dy };
}

/** Op: apply a partial-Obj patch to a node, with a snapshot of the inverse
 *  for undo. Used by `updateSelected` to make property-panel + color-picker
 *  edits undoable. */
function createUpdateNodeOp(args: {
  id: string;
  from: Partial<Obj>;
  to: Partial<Obj>;
  label?: string;
  coalesceKey?: string;
}): Op {
  const { id, from, to, label } = args;
  // Default coalesceKey collapses a slider drag's burst of per-keystroke ops
  // into a single undo entry within the history's coalesce window.
  const coalesceKey = args.coalesceKey ?? `update:${id}`;
  return {
    label,
    coalesceKey,
    apply(adapter) {
      (adapter as { updateNode: (id: string, patch: Partial<Obj>) => void }).updateNode(id, to);
    },
    invert() {
      return createUpdateNodeOp({ id, from: to, to: from, label, coalesceKey });
    },
  };
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
 *  a world-space path per selected id. TextObj gets a synthetic RectPath;
 *  PathObj returns its embedded path (which may itself be a RectPath, so the
 *  rect fast-path holds through boolean inputs). */
/** Distance from (px, py) to an axis-aligned rect's perimeter. Returns 0
 *  if the point is inside the rect (treated as a filled region, like the
 *  closed-path case in the weighted pick). Used by the picker for non-path
 *  objects (text). */
function pointToRectDistanceXYWH(
  px: number, py: number,
  rx: number, ry: number, rw: number, rh: number,
): number {
  if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) return 0;
  const dx = Math.max(rx - px, px - (rx + rw), 0);
  const dy = Math.max(ry - py, py - (ry + rh), 0);
  return Math.hypot(dx, dy);
}

function pathForObj(o: Obj): Path {
  if (o.tool !== 'text') return o.path;
  return { kind: 'rect', x: o.x, y: o.y, width: o.width, height: o.height };
}

/** Apply an Obj's `rotation` (radians) to its raw path, returning a polygon
 *  path whose coords reflect the rotated geometry. Boolean ops read this so
 *  the result honors the visible (rotated) shape instead of the underlying
 *  unrotated path. A RectPath rotates to a 4-anchor closed polygon; a
 *  PolygonPath rotates each coord in place. Identity passthrough when the
 *  obj has no rotation. */
function bakeRotation(o: Obj): Path {
  const raw = pathForObj(o);
  const rot = o.rotation ?? 0;
  if (!rot) return raw;
  const cx = o.x + o.width / 2;
  const cy = o.y + o.height / 2;
  if (raw.kind === 'rect') {
    const corners = [
      { x: raw.x, y: raw.y },
      { x: raw.x + raw.width, y: raw.y },
      { x: raw.x + raw.width, y: raw.y + raw.height },
      { x: raw.x, y: raw.y + raw.height },
    ].map((p) => rotatePoint(p.x, p.y, cx, cy, rot));
    const coords = new Float32Array(8);
    corners.forEach((p, i) => { coords[i * 2] = p.x; coords[i * 2 + 1] = p.y; });
    return {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords,
      fillRule: 'nonzero',
    };
  }
  // PolygonPath: rotate every (x, y) pair in coords. Command stream is
  // unchanged — anchors stay in the same order, just at new positions.
  const next = new Float32Array(raw.coords.length);
  for (let i = 0; i < raw.coords.length; i += 2) {
    const p = rotatePoint(raw.coords[i], raw.coords[i + 1], cx, cy, rot);
    next[i] = p.x;
    next[i + 1] = p.y;
  }
  return { ...raw, coords: next };
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
  // Active fill/stroke/focus + the D / X / Shift+X / / keybindings live
  // in `useActiveColors`. Color sources (swatch grids, palettes, eyedropper)
  // dispatch through `colors.setFocused(paint)` rather than poking
  // setActiveFill / setActiveStroke directly.
  const colors = useActiveColors({
    initialFill: { kind: 'solid', color: '#7fb069ff' },
    initialStroke: { kind: 'solid', color: '#1a130dff' },
  });
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(1);
  const [pageSelected, setPageSelected] = useState(false);
  // Refs so non-React callbacks (gesture handlers, ops, history) can
  // read the latest active paint without re-registering.
  const activeFillRef = useRef(colors.fill);
  activeFillRef.current = colors.fill;
  const activeStrokeRef = useRef(colors.stroke);
  activeStrokeRef.current = colors.stroke;
  const focusedSwatchRef = useRef(colors.focused);
  focusedSwatchRef.current = colors.focused;
  // String-shaped aliases used by the Properties panel (which takes plain
  // hex strings via PropertyColorInput) and the per-object scene fill /
  // stroke fields. `paintToString` returns '' for the 'none' kind, which
  // the renderers treat as "skip this paint".
  const fillColor = paintToString(colors.fill);
  const strokeColor = paintToString(colors.stroke);
  const strokeWidth = activeStrokeWidth;
  const { setFillColor, setStrokeColor } = colors;
  const setStrokeWidth = setActiveStrokeWidth;
  // Back-compat aliases for the in-flight gesture / op code below that
  // still reaches for setActiveFill / setActiveStroke / setFocusedSwatch
  // by name.
  const setActiveFill = colors.setFill;
  const setActiveStroke = colors.setStroke;
  const setFocusedSwatch = colors.setFocus;
  const activeFill = colors.fill;
  const activeStroke = colors.stroke;
  const focusedSwatch = colors.focused;
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
  const [gridDensity, setGridDensity] = usePref('view.gridDensity');
  const [gridVisible, setGridVisible] = usePref('view.gridVisible');
  const toggleGrid = useCallback(() => setGridVisible((v) => !v), [setGridVisible]);
  useKeybinding({ key: ['3', '#'], shift: true }, toggleGrid);
  const [snapToGrid, setSnapToGrid] = usePref('view.snapToGrid');
  const toggleSnap = useCallback(() => setSnapToGrid((v) => !v), [setSnapToGrid]);
  // Preferences modal — Cmd-, opens (and toggles) it. Browsers reserve
  // this chord for tab/site settings, so the keybinding must preventDefault
  // (which `useKeybinding` does by default).
  const [prefsOpen, setPrefsOpen] = useState(false);
  useKeybinding({ key: ',', mod: true }, () => setPrefsOpen((o) => !o));

  // Record/replay — captures pointer + keyboard input for later replay
  // against the canvas. The recorder is created lazily and reads the
  // current canvas element each time it needs to classify an event target.
  // `canvasElRef` is set via a one-shot effect after first paint that
  // queries the DOM (the kit's <Canvas> exposes an extension API ref, not
  // the element itself).
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const [recording, setRecording] = useState(false);
  // Snap helpers exposed as refs so callbacks declared later (the adapter,
  // each shape tool's `create`) read the latest snap state without recreating
  // the adapter or tools when the toggle flips. `.current` is rebound on
  // every render below.
  const snapPointToGridRef = useRef<(p: { x: number; y: number }) => { x: number; y: number }>((p) => p);
  const snapBoundsToGridRef = useRef<<B extends { x: number; y: number; width: number; height: number }>(b: B) => B>(
    (b) => b,
  );
  {
    const enabled = snapToGrid;
    const spacing = gridDensity;
    const r = (v: number) => Math.round(v / spacing) * spacing;
    snapPointToGridRef.current = (p) => (enabled ? { x: r(p.x), y: r(p.y) } : p);
    snapBoundsToGridRef.current = <B extends { x: number; y: number; width: number; height: number }>(b: B): B => {
      if (!enabled) return b;
      const x0 = r(b.x);
      const y0 = r(b.y);
      const x1 = r(b.x + b.width);
      const y1 = r(b.y + b.height);
      return { ...b, x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
    };
  }
  // Renamed from `sidebarWidth` when the prefs layer landed — the right
  // sidebar's width is persisted alongside (future) `leftSidebarWidth`.
  const [rightSidebarWidth, setRightSidebarWidth] = usePref('ui.rightSidebarWidth');
  const [panels, setPanels] = usePref('ui.panels');
  const [disclaimerDismissed, setDisclaimerDismissed] = usePref('ui.disclaimerDismissed');
  // Plays the fall animation; the pref flips to true on animation end so
  // the banner unmounts only after the visual finishes (the next reload
  // shows nothing because the pref is persisted).
  const [disclaimerDismissing, setDisclaimerDismissing] = useState(false);
  // Panel-state setters bound to the persisted `panels` map. Both the
  // in-sidebar header chevron + close button (PropertiesPanel) and the
  // Preferences modal's panels editor flip the same shape, so wiring
  // either surface keeps the other in sync.
  const setPanelHidden = useCallback(
    (k: string, hidden: boolean) => {
      setPanels((prev) => ({ ...prev, [k]: { ...prev[k], hidden } }));
    },
    [setPanels],
  );
  const setPanelCollapsed = useCallback(
    (k: string, collapsed: boolean) => {
      setPanels((prev) => ({ ...prev, [k]: { ...prev[k], collapsed } }));
    },
    [setPanels],
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteShortcut(paletteOpen, setPaletteOpen);

  // Transient toast notifications (e.g. SVG parse warnings). Auto-dismiss
  // after a timeout; users can also close them manually.
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const pushToast = useCallback((title: string, messages: string[]) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, title, messages }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  // Publish our selection to the surrounding <SelectionContextProvider> so the
  // command palette can show a "N selected" header alongside its commands.

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  // Group-aware geometry helpers. Used by both useSelectTool (selection chrome
  // bounds, pickBest) and <Canvas> (selection-overlay bounds resolution) so a
  // group id resolves to the union AABB of its member rects and gestures
  // started on a group expand to its leaves.
  const boundsOfId = useCallback((id: string): { x: number; y: number; width: number; height: number } | null => {
    const o = itemsRef.current.find((x) => x.id === id);
    if (o) return { x: o.x, y: o.y, width: o.width, height: o.height };
    const g = groupsRef.current.find((x) => x.id === id);
    if (!g) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let any = false;
    for (const mid of g.members) {
      const m = itemsRef.current.find((x) => x.id === mid);
      if (!m) continue;
      any = true;
      if (m.x < minX) minX = m.x;
      if (m.y < minY) minY = m.y;
      if (m.x + m.width > maxX) maxX = m.x + m.width;
      if (m.y + m.height > maxY) maxY = m.y + m.height;
    }
    return any ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
  }, []);

  const expandGroupIds = useCallback((ids: string[]): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      const g = groupsRef.current.find((x) => x.id === id);
      if (g) {
        for (const m of g.members) {
          if (seen.has(m)) continue;
          seen.add(m);
          out.push(m);
        }
      } else if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  }, []);

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

  // Subscribe to history changes so the History panel re-renders on every
  // push/undo/redo/clear/coalesce. The kit's History bumps an internal
  // version and notifies listeners; we mirror it into React state so any
  // history-derived UI (the panel) updates on the next render.
  const [historyVersion, setHistoryVersion] = useState(0);
  useEffect(() => {
    const h = historyRef.current;
    if (!h) return;
    return h.subscribe(() => setHistoryVersion((v) => v + 1));
  }, []);

  // Persist the scene to IndexedDB. On mount we load any saved snapshot,
  // replace the backing refs in place, publish to React, and bump nextId
  // past the loaded ids so newly-created shapes don't collide. After
  // restore, the hook debounces writes (300ms idle) on subsequent renders.
  usePersistedScene({
    itemsRef,
    groupsRef,
    setItems,
    setGroups,
    doc,
    setDoc,
    view,
    setView,
    publish,
    resetHistory: () => { historyRef.current?.clear(); },
    getSelection: () => [...selection.current],
    setSelection: (ids) => { selection.set(ids.map((id) => asNodeId(id))); },
    getHistory: () => historyRef.current!.serialize(),
    setHistory: (snap) => { historyRef.current?.restore(snap); },
  });

  // After a restore the highest existing id may overlap with `nextId`'s
  // start value. Walk every restored id once and bump nextId past the max
  // numeric suffix. The id pattern across tools is `<letter><n>` (e.g. r12,
  // b3, t7) so we capture the trailing-digits group.
  const seededNextIdRef = useRef(false);
  useEffect(() => {
    if (seededNextIdRef.current) return;
    if (itemsRef.current.length === 0 && groupsRef.current.length === 0) return;
    let max = 0;
    const scan = (id: string) => {
      const m = /(\d+)$/.exec(id);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > max) max = n;
      }
    };
    for (const o of itemsRef.current) scan(o.id);
    for (const g of groupsRef.current) scan(g.id);
    if (max >= nextId.current) nextId.current = max + 1;
    seededNextIdRef.current = true;
  }, [items, groups]);

  // Wrap applyOps through history. The hooks call `dispatchApplyBatch`,
  // which calls our `applyOps`. We delegate to history.applyOps (which
  // applies the ops AND pushes onto the undo stack).
  const applyOps = useCallback((ops: { apply: (a: unknown) => void; invert: () => { apply: (a: unknown) => void; invert: () => unknown } }[], label?: string) => {
    // Debug-level trace of every history push. Enable via
    // `localStorage.setItem('weasel.debug', '1')` (or 'swillustrator.debug').
    // Useful when an op shows up unexpectedly (e.g. extra entries pushed
    // by a single gesture).
    dlog('[history.applyOps]', label ?? 'Edit', 'opCount:', ops.length, 'opLabels:', ops.map((o) => (o as { label?: string }).label));
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
        // Always return an explicit `rotation` field — even 0 when the obj
        // has never been rotated. Otherwise a gesture's originPose snapshot
        // carries `rotation: undefined`, and undo's setPose(originPose) hits
        // applyPoseToObj's "preserve on undefined" rule (designed for
        // move/resize that omit rotation) and silently keeps the current
        // rotation. Symptom: rotate → undo leaves the shape rotated.
        return o
          ? { x: o.x, y: o.y, width: o.width, height: o.height, rotation: o.rotation ?? 0 }
          : { x: 0, y: 0, width: 0, height: 0, rotation: 0 };
      },
      setPose: (id: string, pose: Pose) => {
        const i = itemsRef.current.findIndex((o) => o.id === id);
        if (i < 0) return;
        itemsRef.current[i] = applyPoseToObj(itemsRef.current[i], pose);
      },
      // Used by createSetTextOp; called from useTextEdit's commit through applyOps.
      setText: (id: string, text: string) => {
        const i = itemsRef.current.findIndex((o) => o.id === id);
        if (i < 0) return;
        const o = itemsRef.current[i];
        if (o.tool !== 'text') return;
        itemsRef.current[i] = { ...o, text };
      },
      // Used by createSetPathOp (pen-edit); updates path geometry in place.
      setPath: (id: string, fields: { path: unknown; closed: boolean; params: unknown }) => {
        const i = itemsRef.current.findIndex((o) => o.id === id);
        if (i < 0) return;
        const o = itemsRef.current[i];
        if (o.tool === 'text') return; // text objs aren't path-shaped
        itemsRef.current[i] = {
          ...o,
          path: fields.path as never,
          closed: fields.closed,
          params: fields.params as never,
        };
      },
      // Used by createUpdateNodeOp — partial obj field update (fill, stroke,
      // strokeWidth, style.fill.color, etc.). Caller is responsible for
      // capturing before/after snapshots so undo restores the prior state.
      updateNode: (id: string, patch: Partial<Obj>) => {
        const i = itemsRef.current.findIndex((o) => o.id === id);
        if (i < 0) return;
        itemsRef.current[i] = { ...itemsRef.current[i], ...patch } as Obj;
      },
      // --- structural mutators (ops use these directly) ---
      // Returns the original z-index of `id` so DeleteOp can capture it
      // and forward it to the inverted Insert. Without this, undo of a
      // multi-delete batch fully reverses paint order (Cmd+A → Delete →
      // Cmd+Z on the tiger SVG was the canonical repro).
      getNodeIndex: (id: string): number => itemsRef.current.findIndex((o) => o.id === id),
      insertNode: (n: Obj, index?: number) => {
        if (itemsRef.current.find((o) => o.id === n.id)) return;
        if (index != null && index >= 0 && index <= itemsRef.current.length) {
          itemsRef.current.splice(index, 0, n);
        } else {
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
      ...createGroupAdapter(groupsRef),
      // --- clipboard / insert ---
      commitInsert: (raw: Pose): Obj => {
        const b = snapBoundsToGridRef.current(raw);
        const id = `r${nextId.current++}`;
        const obj: PathObj = {
          id, tool: 'rect',
          x: b.x, y: b.y, width: b.width, height: b.height,
          path: { kind: 'rect', x: b.x, y: b.y, width: b.width, height: b.height },
          closed: true,
          fill: fillRef.current, stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
        };
        return obj;
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
        return src.map((o) => ({ ...translateObj(o, dx, dy), id: `${o.tool[0]}${nextId.current++}` } as Obj));
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
        // Bake rotation into the geometry so booleans operate on the visible
        // (rotated) shape rather than the underlying unrotated path. The
        // output `createPathNode` writes a fresh path with rotation: 0.
        return o ? bakeRotation(o) : undefined;
      },
      compareZ: (aId: string, bId: string): number => {
        const ai = itemsRef.current.findIndex((o) => o.id === aId);
        const bi = itemsRef.current.findIndex((o) => o.id === bId);
        return ai - bi;
      },
      createPathNode: (path: Path, producedBy: BooleanOp): { id: string } => {
        // Wrap a Path as a PathObj. Boolean outputs are freshly synthesized
        // geometry with no authoring tool of their own, so `tool: 'imported'`
        // is the correct origin (see spec § "Out of Scope"). `producedBy`
        // preserves the originating op so the Layers panel can render the
        // op's icon instead of the unknown-tool glyph.
        const id = `b${nextId.current++}`;
        const b = path.kind === 'rect'
          ? { x: path.x, y: path.y, width: path.width, height: path.height }
          : boundsOfPath(path);
        const pathNode: PathObj = {
          id, tool: 'imported',
          x: b.x, y: b.y, width: b.width, height: b.height,
          path, closed: true,
          fill: fillRef.current, stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
          producedBy,
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
        const newId = `${(src?.tool ?? 'p')[0]}${nextId.current++}`;
        if (!src) {
          const stub: PathObj = {
            id: newId, tool: 'imported',
            x: 0, y: 0, width: 0, height: 0,
            path: { kind: 'rect', x: 0, y: 0, width: 0, height: 0 }, closed: true,
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
  const centerOnDoc = useCallback((scale = 1) => {
    if (hostSize.width <= 0 || hostSize.height <= 0) return;
    setView({
      x: doc.size.width / 2 - hostSize.width / (2 * scale),
      y: doc.size.height / 2 - hostSize.height / (2 * scale),
      scale,
    });
  }, [hostSize.width, hostSize.height, doc.size.width, doc.size.height]);
  useLayoutEffect(() => {
    if (didInitialCenter.current) return;
    if (hostSize.width <= 0 || hostSize.height <= 0) return;
    didInitialCenter.current = true;
    centerOnDoc(view.scale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostSize.width, hostSize.height, doc.size.width, doc.size.height]);

  // ---- Tools -----------------------------------------------------------
  // pickEvery is also wired into <Canvas> below so the dispatcher's
  // getNodeAtPoint resolves to the same hit set. Without it, every
  // pointer event's ctx.target is empty and the select tool's drag
  // route fires the empty/marquee branch instead of move.
  const pickEvery = useCallback(
    (wx: number, wy: number): string[] =>
      itemsRef.current
        .filter((o) => pointInRotatedAabb(wx, wy, o))
        .map((o) => o.id),
    [],
  );
  const select = useSelectTool<Obj, Pose>(adapter, {
    pickEvery,
    // Group-aware click resolution: a click on a member of a group selects
    // the group; alt-click drills past the group to the bare member. Groups
    // in swillustrator are flat (no nesting), so "topmost ancestor" is the
    // single group that contains the hit member. Falls back to pickEvery so
    // rotated AABB hit-testing is shared.
    pickBest: (wx, wy, alt) => {
      const ids = pickEvery(wx, wy);
      if (ids.length === 0) return null;
      const top = ids[ids.length - 1];
      if (alt) return top;
      const g = groupsRef.current.find((x) => x.members.includes(top));
      return g ? g.id : top;
    },
    boundsOf: boundsOfId,
    // Double-tap drills into a group: select the bare member that was hit
    // even when its group would otherwise be the click target.
    onDoubleTap: ({ ids }) => {
      if (ids.length === 0) return;
      const top = ids[ids.length - 1];
      selection.set([asNodeId(top)]);
    },
    drawGhost: (obj, pose): DrawCommand[] => {
      if (!obj) return [];
      // Preserve rotation through the ghost path. The select tool's pose
      // type isn't required to surface `rotation`; if it's missing, fall
      // back to the committed object's rotation so a rotated shape's
      // ghost rotates too.
      const fullPose: Pose = { ...pose, rotation: (pose as Pose).rotation ?? (obj as Obj).rotation };
      const o = obj as Obj;
      if (o.tool !== 'text') {
        // Rect-fast-path: a rect-origin shape with a current RectPath stays
        // a RectPath at the previewed bounds (no polygon promotion). Anything
        // else (polygon-shaped path) scales geometrically.
        const livePath: Path = o.path.kind === 'rect'
          ? { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height }
          : scalePathToBounds(o.path, { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height });
        const cmds: DrawCommand[] = [];
        if (o.closed) {
          cmds.push({ kind: 'path', path: livePath, fill: { color: o.fill } });
        }
        if (o.strokeWidth > 0) {
          cmds.push({ kind: 'path', path: livePath, stroke: { paint: { color: o.stroke }, width: o.strokeWidth } });
        }
        return wrapWithRotation(cmds, fullPose);
      }
      return wrapWithRotation([{
        kind: 'path',
        path: { kind: 'rect', x: pose.x + 0.5, y: pose.y + 0.5, width: pose.width, height: pose.height },
        stroke: { paint: { color: '#888' }, width: 1, dash: [3, 3] },
      }], fullPose);
    },
    getNode: (id) => itemsRef.current.find((o) => o.id === id) ?? null,
    // Move expands a group id to its members so dragging a group translates
    // every leaf as one.
    move: {
      expandIds: expandGroupIds,
      behaviors: snapToGrid
        ? [snapBehavior(gridSnapStrategy<Pose>(gridDensity), { bypassKey: 'meta' })]
        : [],
    },
    // Marquee is opt-in at the kit level — illustration apps want
    // rubber-band selection across drawn objects.
    areaSelect: { behaviors: [selectFromMarquee()] },
  });
  // Resize is its own tool now. Shift-drag a corner for aspect-locked scale
  // (Illustrator/Figma convention). `expandIds` routes a resize started on a
  // selected group id to per-leaf transform ops (useResize takes the union
  // AABB as origin and remaps each leaf proportionally). Snap behaviors are
  // conditioned on the persisted `snapToGrid` pref; `Cmd` is a temporary
  // bypass so users can place off-grid without disabling the toggle.
  const resizeTool = useResizeTool<Obj, Pose>(adapter, {
    resize: {
      behaviors: [lockAspectWithModifier()],
      pointSnapBehaviors: snapToGrid
        ? [pointSnapToGrid({ spacing: gridDensity, bypassKey: 'meta' })]
        : [],
      expandIds: expandGroupIds,
    },
    boundsOf: boundsOfId,
    getSelection: () => selection.current,
    poseBounds: (p) => p,
    getNode: (id) => itemsRef.current.find((o) => o.id === id) ?? null,
  });
  const rotateTool = useRotateTool<Obj, Pose>(adapter, {
    boundsOf: boundsOfId,
    getSelection: () => [...selection.current],
    getNode: (id) => itemsRef.current.find((o) => o.id === id) ?? null,
  });

  const insert = useInsertTool<Obj, Pose>(adapter, {
    minBounds: { width: 4, height: 4 },
    // Gesture-level snap: the live marquee tracks the grid. The adapter's
    // commitInsert still snaps bounds as belt-and-suspenders since the
    // adapter is exposed independently of this tool.
    snapPoint: (p) => snapPointToGridRef.current(p),
  });
  const hand = useHandTool();
  // Eyedropper — clicks any shape, writes the sampled color into whichever
  // swatch is currently focused. Alt-hold engages it momentarily on top
  // of any active tool; pressing `I` makes it the active tool until
  // switched away. Alt-drag still routes to clone (clone claims at
  // drag.onStart, eyedropper at pointer.click — they don't collide).
  const eyedropper = useEyedropperTool({
    colorOf: (id) => {
      const obj = itemsRef.current.find((o) => o.id === id);
      if (!obj) return null;
      if (obj.tool !== 'text') {
        return obj.fill || obj.stroke || null;
      }
      const f = obj.style?.fill;
      return f && f.fill === 'solid' ? f.color : null;
    },
    onPick: (color) => {
      if (color == null) return;
      // Route through the alpha-aware setters so eyedropper picks normalize
      // to `#rrggbbaa` (and a 6-char pick inherits the previous swatch's
      // alpha, matching the native-picker round-trip).
      if (focusedSwatchRef.current === 'fill') {
        setFillColor(color);
      } else {
        setStrokeColor(color);
      }
    },
  });
  const text = useTextTool<TextObj>({
    hitExisting: ({ x: worldX, y: worldY }) => {
      const hit = [...itemsRef.current].reverse().find(
        (o): o is TextObj => o.tool === 'text'
          && worldX >= o.x && worldX <= o.x + o.width
          && worldY >= o.y && worldY <= o.y + o.height,
      );
      return hit ? hit.id : null;
    },
    pointInsert: ({ x: worldX, y: worldY }) => {
      const id = `t${nextId.current++}`;
      pendingTextEditRef.current = id;
      return {
        id, tool: 'text',
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
        id, tool: 'text',
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
      return o?.tool === 'text' ? o.text : '';
    },
    getStyle: (id) => {
      const o = itemsRef.current.find((x) => x.id === id);
      return o?.tool === 'text' ? o.style : undefined;
    },
    getScreenPose: (id) => {
      const o = itemsRef.current.find((x) => x.id === id);
      if (!o || o.tool !== 'text') return null;
      return {
        x: o.x, y: o.y, width: o.width, height: o.height,
        fontSize: o.style?.fontSize ?? 16,
      };
    },
    setText: (id, text) => {
      const o = itemsRef.current.find((x) => x.id === id);
      if (!o || o.tool !== 'text') return;
      // Commit with empty text deletes the node — matches Illustrator's
      // behavior and prevents invisible orphan text boxes from being left
      // behind by stray clicks or all-content-deleted edits.
      if (text === '') {
        const index = itemsRef.current.findIndex((x) => x.id === id);
        applyOps([createDeleteOp({ node: o, label: 'Delete empty text', index })], 'Delete empty text');
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

  // Last-resort Esc handler: if no other tool claims Escape (e.g. pen
  // discarding an in-progress path), and there's a non-empty selection,
  // clear it. Lives in ambient slot order so the dispatcher tries it
  // after the active tool's `keyboard.onDown`, claiming only when there's
  // actually a selection to clear.
  const escClearSelection = useMemo<AnyTool>(() => ({
    id: 'esc-clear-selection',
    initScratch: () => undefined,
    keyboard: {
      onDown: (e) => {
        if (e.key !== 'Escape') return 'pass';
        if (selection.current.length === 0) return 'pass';
        selection.set([]);
        return 'claim';
      },
    },
  }), [selection]);

  const [penAutoCommitOnClose] = usePref('tools.penAutoCommitOnClose');
  const [pathFillRule] = usePref('tools.pathFillRule');
  const { tool: pen, isEditing: penIsEditing } = usePenTool<PathObj>({
    autoCommitOnClose: penAutoCommitOnClose,
    // Honor the global snap-to-grid toggle for every anchor placement.
    // Reads via ref so the pen tool doesn't re-mount when the toggle flips.
    snapPoint: (p) => snapPointToGridRef.current(p),
    wrapPath: (path, { closed }): PathObj => {
      // Override the kit's default 'nonzero' fill rule with the user pref.
      // Self-intersecting outlines (lasso-style) only fill correctly under
      // 'evenodd'; the default 'nonzero' leaves holes where windings cancel.
      const rule = pathFillRule as PathFillRule;
      const ruled = path.kind === 'polygon' && path.fillRule !== rule
        ? { ...path, fillRule: rule }
        : path;
      const b = boundsOfPath(ruled);
      const id = `p${nextId.current++}`;
      return {
        id, tool: 'pen',
        x: b.x, y: b.y, width: b.width, height: b.height,
        path: ruled, closed,
        fill: fillRef.current, stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
      };
    },
    getPathObj: (id: string) => {
      const o = itemsRef.current.find((x) => x.id === id);
      if (!o || o.tool === 'text') return null;
      return { path: o.path, closed: o.closed, params: o.params, tool: o.tool };
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
      applyOps: (ops, label) => applyOps(ops, label),
    },
  });

  // ---- Shape tools (ellipse / line / polygon / star / pencil) ----------
  // Each tool produces a `PathObj` from a kit-built `PolygonPath`. Fill /
  // stroke / strokeWidth are pulled from the current refs so palette
  // selections apply immediately.

  // Ref-mirror the pref so `pathToObj` (a stable useCallback) reads the
  // latest rule without rebuilding every shape tool when the user toggles.
  const pathFillRuleRef = useRef(pathFillRule);
  pathFillRuleRef.current = pathFillRule;

  /** Wrap a freshly-built path as a `PathObj` with the current style. */
  const pathToObj = useCallback((
    path: PolygonPath,
    closed: boolean,
    tool: Exclude<ToolKind, 'text'>,
    params?: PathParams,
  ): PathObj => {
    const rule = pathFillRuleRef.current as PathFillRule;
    const ruled = path.fillRule !== rule ? { ...path, fillRule: rule } : path;
    const b = boundsOfPath(ruled);
    return {
      id: `p${nextId.current++}`,
      tool,
      x: b.x, y: b.y, width: b.width, height: b.height,
      path: ruled, closed,
      fill: fillRef.current,
      stroke: strokeRef.current,
      strokeWidth: strokeWidthRef.current,
      ...(params ? { params } : {}),
    };
  }, []);

  // Each shape tool ingests snap via the kit's gesture-level `snapPoint`
  // option, so the live overlay AND the committed geometry track the grid.
  // (Previously each `create` callback snapped after the fact, which made
  // the preview drift off-grid until release.) Reads via ref so toggling
  // snap-to-grid doesn't re-mount the tool.
  const ellipse = useEllipseTool<PathObj>({
    minBounds: { width: 2, height: 2 },
    snapPoint: (p) => snapPointToGridRef.current(p),
    create: (bounds) => pathToObj(ellipsePath(bounds), true, 'ellipse'),
  });

  const line = useLineTool<PathObj>({
    minLength: 2,
    snapPoint: (p) => snapPointToGridRef.current(p),
    create: (a, b) => pathToObj(linePath(a, b), false, 'line'),
  });

  const polygon = usePolygonTool<PathObj>({
    minRadius: 2,
    sides: 6,
    snapPoint: (p) => snapPointToGridRef.current(p),
    create: (center, radius, rotation, sides) =>
      pathToObj(
        regularPolygonPath(center, radius, rotation, sides),
        true,
        'polygon',
        { sides },
      ),
  });

  const star = useStarTool<PathObj>({
    minRadius: 2,
    points: 5,
    innerRatio: 0.5,
    snapPoint: (p) => snapPointToGridRef.current(p),
    create: (center, outer, inner, rotation, points) => {
      const ratio = outer > 0 ? inner / outer : 0.5;
      return pathToObj(
        starPath(center, outer, inner, rotation, points),
        true,
        'star',
        { points, ratio },
      );
    },
  });

  const pencil = usePencilTool<PathObj>({
    tolerance: 1.5,
    closeThreshold: 8,
    create: (path, { closed }) => pathToObj(path, closed, 'pencil'),
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
      const fullPose: Pose = { ...pose, rotation: (pose as Pose).rotation ?? (obj as Obj).rotation };
      const o = obj as Obj;
      if (o.tool !== 'text') {
        return wrapWithRotation([{
          kind: 'path',
          path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
          fill: { color: o.fill },
        }], fullPose);
      }
      return wrapWithRotation([{
        kind: 'path',
        path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
        stroke: { paint: { color: '#888' }, width: 1, dash: [3, 3] },
      }], fullPose);
    },
    cloneSelection: true,
  });

  // `clone` lives in the ambient slot: it only claims when alt is held at
  // pointerdown over a body, so plain drags fall through to whichever
  // registered tool is active. Putting it in `registry` would require the
  // user to switch tools to enable alt-drag clone.
  //
  // Initial active tool: prefer the user's persisted `lastTool` from
  // `swill.prefs.v1`, but only if it's still a registered tool (a renamed
  // or removed tool would otherwise crash useTools' "active not in registry"
  // assertion). Falls back to 'select'.
  const initialActiveTool = useMemo(() => {
    const stored = readPref('tools.lastTool');
    const registryKeys = ['select', 'lasso', 'insert', 'ellipse', 'line', 'polygon', 'star', 'pen', 'pencil', 'hand', 'text', 'eyedropper'];
    return registryKeys.includes(stored) ? stored : 'select';
  }, []);
  const tools = useTools({
    active: initialActiveTool,
    registry: { select, lasso, insert, ellipse, line, polygon, star, pen, pencil, hand, text, eyedropper },
    ambient: [resizeTool, rotateTool, wheelZoom, wheelPan, keyZoom, clone, escClearSelection],
    // Unhandled clicks fall through to select so click-to-select works while
    // a non-select tool (pen, ellipse, etc.) is active. Click-only — drag,
    // keyboard, wheel, and pointerdown stay tool-specific.
    fallback: select,
    // Declarative-routing tools (eyedropper) route on `ctx.target.category`,
    // which the dispatcher derives from this lookup. Without it every click
    // is categorized as `empty` and `pickFromNode`-style handlers no-op.
    //
    // Weighted-distance pick: for each obj, compute a single "click-to-obj
    // distance" — 0 if the click is inside a filled region, else the
    // stroke distance to the visible edge. Open paths get a bias
    // multiplier (<1) so their thin strokes attract clicks better than a
    // tied-distance closed shape. Within `PICK_RADIUS` (screen px),
    // smallest weighted distance wins; z-order breaks exact ties.
    // Rotated objs are tested in their unrotated frame.
    getNodeAtPoint: (wx, wy) => {
      const PICK_RADIUS_PX = 8;
      const OPEN_PATH_BIAS = 0.4;
      const radius = PICK_RADIUS_PX / view.scale;
      let best: { idx: number; d: number } | null = null;
      const items = itemsRef.current;
      for (let i = 0; i < items.length; i++) {
        const o = items[i];
        // Inverse-rotate the click into the obj's local frame so we can
        // run the AABB / path math in its unrotated coordinates.
        const cx = o.x + o.width / 2;
        const cy = o.y + o.height / 2;
        const r = o.rotation ?? 0;
        let lx = wx, ly = wy;
        if (r !== 0) {
          const dx = wx - cx, dy = wy - cy;
          const cos = Math.cos(-r), sin = Math.sin(-r);
          lx = cx + dx * cos - dy * sin;
          ly = cy + dx * sin + dy * cos;
        }
        let d: number;
        if (o.tool === 'text') {
          // Text has no path: pick by its rect AABB (0 inside, else
          // distance to the rect's perimeter).
          d = pointToRectDistanceXYWH(lx, ly, o.x, o.y, o.width, o.height);
        } else {
          // PathObj. Filled regions: 0 inside. Else stroke distance,
          // with the open-path bias applied so open strokes feel hotter.
          const p = o.path;
          const inside = o.closed && pathContainsPoint(p, lx, ly);
          d = inside ? 0 : pathDistanceToPoint(p, lx, ly);
          if (!inside && !o.closed) d *= OPEN_PATH_BIAS;
        }
        if (d > radius) continue;
        // Smaller weighted-distance wins; on exact tie, later index (top
        // of z-order) wins.
        if (best === null || d < best.d || (d === best.d && i > best.idx)) {
          best = { idx: i, d };
        }
      }
      if (best === null) return null;
      const top = items[best.idx];
      return {
        id: asNodeId(top.id),
        // The kit's dispatcher routes on target.kind (string). We map our
        // `tool` field there so per-kind routing keys still work.
        kind: top.tool,
        pose: { x: top.x, y: top.y, width: top.width, height: top.height },
        data: {},
      };
    },
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

  // Persist the active tool across reloads. We use `usePersistedPref` here
  // (rather than a raw effect on `tools.active`) so the write-coalescing in
  // the prefs layer batches with concurrent slider/sidebar writes. The
  // initial value is `tools.active` itself (already seeded from the stored
  // lastTool via `initialActiveTool`) — but the hook's mount-skip means we
  // only emit a write when the user actually switches tools.
  const [, setLastTool] = usePref('tools.lastTool');
  useEffect(() => {
    setLastTool(tools.active);
  }, [tools.active, setLastTool]);

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

  // "Release compound path" — for each selected obj whose path has ≥2
  // subpaths (typically a multi-region boolean result), delete it and emit
  // one new PathObj per subpath as a single undoable batch. The new
  // selection becomes the freshly-inserted ids.
  const releaseCompoundEnabled = useMemo(() => {
    return selection.current.some((id) => {
      const o = itemsRef.current.find((x) => x.id === id);
      if (!o || o.tool === 'text') return false;
      const path = pathForObj(o);
      // Defensive: a non-text Obj should always carry a path per the type
      // contract, but undo/redo + boolean op round-trips have shown this
      // invariant can be violated in practice. Treat missing path as "not
      // a compound" rather than crashing the whole render.
      if (!path || path.kind !== 'polygon') return false;
      let m = 0;
      for (let i = 0; i < path.commands.length; i++) {
        if (path.commands[i] === PATH_M && ++m >= 2) return true;
      }
      return false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.current, items]);

  const releaseCompoundPath = useCallback((): void => {
    const ops: Op[] = [];
    const newIds: string[] = [];
    for (const id of selection.current) {
      const o = itemsRef.current.find((x) => x.id === id);
      if (!o || o.tool === 'text') continue;
      const path = pathForObj(o);
      if (!path || path.kind !== 'polygon') continue;
      let m = 0;
      for (let i = 0; i < path.commands.length; i++) {
        if (path.commands[i] === PATH_M) m++;
      }
      if (m < 2) continue;
      const subs = splitSubpaths(path);
      const index = itemsRef.current.findIndex((x) => x.id === id);
      ops.push(createDeleteOp({ node: o, label: 'Release compound path', index }));
      for (const sub of subs) {
        const b = boundsOfPath(sub);
        const newId = `s${nextId.current++}`;
        const node: PathObj = {
          id: newId,
          tool: 'imported',
          x: b.x, y: b.y, width: b.width, height: b.height,
          path: sub,
          closed: o.closed,
          fill: o.fill,
          stroke: o.stroke,
          strokeWidth: o.strokeWidth,
          rotation: o.rotation,
        };
        ops.push(createInsertOp({ node, label: 'Release compound path' }));
        newIds.push(newId);
      }
    }
    if (ops.length === 0) return;
    applyOps(ops, 'Release compound path');
    selection.set(newIds.map((id) => asNodeId(id)));
  }, [applyOps, selection]);

  useKeybinding({ key: '|', shift: true }, releaseCompoundPath);
  const booleans = useBooleans(adapter);
  // The adapter mutates `itemsRef` in place; React only re-renders when we
  // call `publish()`. `onUndo`/`onRedo` fire after every successful action
  // (button or keyboard), so both paths see a fresh render.
  const { undo, redo } = useUndoRedo(historyRef.current, {
    bindKeyboard: true,
    onUndo: publish,
    onRedo: publish,
  });

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

  // Context-aware ActionBar predicates. Computed from React state (items,
  // groups, selection.current) so the toolbar re-renders when the user
  // moves selection or mutates the scene. Front/back use the same predicate
  // as forward/backward — once a shape is rightmost (frontmost) it can be
  // neither bumped one step forward nor sent to front.
  const selIds = selection.current;
  // Groups have no position in items[]; their effective z-position is the
  // position of their members. Expand group ids to member ids before
  // checking sibling boundaries (mirrors what useReorder operates on).
  const reorderTargets = (() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const id of selIds) {
      const g = groups.find((x) => x.id === id);
      const targets = g ? g.members : [id];
      for (const t of targets) {
        if (!seen.has(t)) { seen.add(t); out.push(t); }
      }
    }
    return out;
  })();
  const rootSiblings = items.map((o) => o.id);
  const parentOf = (id: string): string => {
    const g = groups.find((x) => x.members.includes(id));
    return g ? g.id : '__root__';
  };
  const siblingsByParent = (() => {
    const m = new Map<string, readonly string[]>();
    m.set('__root__', rootSiblings);
    for (const g of groups) m.set(g.id, g.members);
    return m;
  })();
  // Partition targets by their parent, then ask the kit's predicate whether
  // any move within that parent would actually change the order. Matches
  // createReorderOp's algorithm exactly — a contiguous block already at the
  // top correctly disables Bring Forward / Bring to Front.
  const targetsByParent = (() => {
    const out = new Map<string, string[]>();
    for (const id of reorderTargets) {
      const p = parentOf(id);
      const list = out.get(p) ?? [];
      list.push(id);
      out.set(p, list);
    }
    return out;
  })();
  const canMoveForward = Array.from(targetsByParent).some(([p, ids]) => {
    const sibs = siblingsByParent.get(p);
    return sibs != null && canBringForward(sibs as string[], ids);
  });
  const canMoveBackward = Array.from(targetsByParent).some(([p, ids]) => {
    const sibs = siblingsByParent.get(p);
    return sibs != null && canSendBackward(sibs as string[], ids);
  });
  const canUngroupSelection = selIds.some((id) => groups.some((g) => g.id === id));

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
  // Grid overlay. `gridDensity` is the user-facing knob (Properties panel);
  // the hook turns it into a renderable layer that paints in world space.
  // Bounds match the document page so the grid clips to the sheet rather
  // than tiling across the whole viewport. View getter projects swillustrator's
  // `{ x, y, scale }` into the kit's `ViewTransform` shape on demand.
  const gridFeature = useGridFeature({
    spacing: gridDensity,
    bounds: () => ({ x: 0, y: 0, width: doc.size.width, height: doc.size.height }),
    view: () => viewToTransform(view),
    // Major-line every 4th cell, with 2 finer subdivisions per cell —
    // gives a three-tier hierarchy (sub < minor < major) so users can read
    // distance at a glance without the grid dominating the page.
    accentEvery: 4,
    subdivisions: 2,
    // Light gridlines on the white paper — kit defaults are tuned for a
    // dark canvas and read too dark here. Opacity ramps from finest to
    // most prominent so the hierarchy is visible without being heavy.
    style: {
      sub:    { paint: { fill: 'solid', color: 'rgba(0,0,0,0.03)' } },
      line:   { paint: { fill: 'solid', color: 'rgba(0,0,0,0.08)' } },
      accent: { paint: { fill: 'solid', color: 'rgba(0,0,0,0.18)' } },
    },
  });

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

  // Hand-rolled text layer so we can wrap each TextObj's text command in a
  // rotation transform group when `rotation !== 0`. The kit's createTextLayer
  // wraps the entire layer in one transform — we need per-node rotation
  // around each text box's own AABB center.
  const textLayer: RenderLayer<unknown> = useMemo(() => ({
    id: 'text',
    label: 'Text',
    draw: (_data, view) => {
      const children: DrawCommand[] = [];
      for (const n of itemsRef.current.filter((o): o is TextObj => o.tool === 'text')) {
        // Hide the currently-editing node — the contenteditable overlay draws it.
        if (textEdit.isEditing(n.id)) continue;
        const tool = tools.registry[tools.hotkeyEngaged ?? tools.active];
        const preview = tool?.previewPose?.(n.id) as Pose | undefined;
        const pose: Pose = preview
          ? { x: preview.x, y: preview.y, width: preview.width, height: preview.height, rotation: preview.rotation ?? n.rotation }
          : { x: n.x, y: n.y, width: n.width, height: n.height, rotation: n.rotation };
        // For text, mid-drag we also need to scale fontSize from preview height
        // so the glyphs visibly resize with the box (mirrors the setPose rule).
        const style = pose.height !== n.height
          ? { ...(n.style ?? {}), fontSize: Math.max(8, Math.round(pose.height * 0.7)) }
          : n.style;
        const resolved = resolveTextStyle(style);
        const styledRuns = toRuns(n.text);
        const runs = resolveRuns(styledRuns, resolved);
        const textCmd: DrawCommand = {
          kind: 'text',
          x: pose.x, y: pose.y,
          runs,
          maxWidth: pose.width,
          align: resolved.align,
          style: style ?? {},
        };
        // Clip glyphs to the declared bounds so an oversized string doesn't
        // bleed past its box.
        const clipped: DrawCommand = {
          kind: 'group',
          clip: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
          children: [textCmd],
        };
        for (const c of wrapWithRotation([clipped], pose)) children.push(c);
      }
      return [{ kind: 'group', transform: viewToMat3(view), children }];
    },
  }), [tools, textEdit]);

  // Hand-rolled shape layer. Every non-text Obj is a PathObj — rects ride the
  // RectPath fast-path through `scalePathToBounds`/`translatePath`, polygons
  // and friends ride the PolygonPath branch. We wrap each shape's draw
  // commands in a per-node rotation transform group so rotation pivots around
  // the shape's own AABB center (the kit's createPathLayer wraps the entire
  // layer in one transform, which is the wrong pivot for multi-shape scenes).
  const shapeLayer: RenderLayer<unknown> = useMemo(() => ({
    id: 'shapes',
    label: 'Shapes',
    draw: (_data, view) => {
      const children: DrawCommand[] = [];
      for (const n of itemsRef.current.filter((o): o is PathObj => o.tool !== 'text')) {
        const tool = tools.registry[tools.hotkeyEngaged ?? tools.active];
        const preview = tool?.previewPose?.(n.id) as Pose | undefined;
        const liveRotation = preview?.rotation ?? n.rotation;
        const scaled = preview && (preview.width !== n.width || preview.height !== n.height);
        const path = !preview
          ? n.path
          : scaled
            ? scalePathToBounds(n.path, { kind: 'rect', x: preview.x, y: preview.y, width: preview.width, height: preview.height })
            : (preview.x === n.x && preview.y === n.y)
              ? n.path
              : translatePath(n.path, preview.x - n.x, preview.y - n.y);
        const pose: Pose = preview
          ? { x: preview.x, y: preview.y, width: preview.width, height: preview.height, rotation: liveRotation }
          : { x: n.x, y: n.y, width: n.width, height: n.height, rotation: n.rotation };
        const cmds: DrawCommand[] = [];
        // Skip fill/stroke when the active paint is 'none' (paintToString
        // emits ''). Without these guards an empty color string flows into
        // the renderer and paints as black, defeating the "no fill" toggle.
        if (n.closed && n.fill) cmds.push({ kind: 'path', path, fill: { fill: 'solid', color: n.fill } });
        if (n.strokeWidth > 0 && n.stroke) cmds.push({ kind: 'path', path, stroke: { paint: { fill: 'solid', color: n.stroke }, width: n.strokeWidth } });
        for (const c of wrapWithRotation(cmds, pose)) children.push(c);
      }
      return [{ kind: 'group', transform: viewToMat3(view), children }];
    },
  }), [tools]);

  const penPreview: RenderLayer<unknown> = useMemo(
    () => createPenPreviewLayer({ penTool: pen }),
    [pen],
  );

  const activeOrEngaged = tools.hotkeyEngaged ?? tools.active;

  // --- Selection-aware mutation helpers ---
  // Re-read items each call so back-to-back changes within a render coalesce.
  // Routed through applyOps so each property change is an undo step.
  const updateSelected = (patch: (o: Obj) => Obj, label = 'Edit'): void => {
    const ids = new Set<string>(selection.current);
    if (ids.size === 0) return;
    const ops: Op[] = [];
    for (const o of itemsRef.current) {
      if (!ids.has(o.id)) continue;
      const next = patch(o);
      // Diff only the fields the patch actually changed, so undo of e.g.
      // a fill change doesn't blow away an unrelated rotation that happened
      // later.
      const from: Record<string, unknown> = {};
      const to: Record<string, unknown> = {};
      const keys = new Set([...Object.keys(o), ...Object.keys(next)]);
      for (const k of keys) {
        const oVal = (o as unknown as Record<string, unknown>)[k];
        const nVal = (next as unknown as Record<string, unknown>)[k];
        if (!Object.is(oVal, nVal)) {
          from[k] = oVal;
          to[k] = nVal;
        }
      }
      if (Object.keys(to).length === 0) continue;
      ops.push(createUpdateNodeOp({
        id: o.id,
        from: from as Partial<Obj>,
        to: to as Partial<Obj>,
        label,
      }));
    }
    if (ops.length > 0) applyOps(ops, label);
  };

  const selectedItems = items.filter((o) => (selection.current as readonly string[]).includes(o.id));
  const primary = selectedItems[0];
  const hasStrokeProps = primary && primary.tool !== 'text';

  // Apply property changes to all selected items that support the property,
  // including kind-specific paths (text fill lives in style.fill.color).
  const applyFillToSelection = (color: string): void => {
    // 6-char hex from the native color picker — pad the previous object's
    // alpha back on so opacity survives the round-trip. 8-char inputs
    // (palette, opacity slider) win outright.
    const merge = (prev: string | undefined): string =>
      color.length === 9 ? color : mergeAlphaFromPrev(color, prev ?? '#ffffffff');
    updateSelected((o) => {
      if (o.tool !== 'text') return { ...o, fill: merge(o.fill) };
      const prevFill = o.style?.fill;
      const prevColor = prevFill && prevFill.fill === 'solid' ? prevFill.color : undefined;
      const next = merge(prevColor);
      const nextFill = prevFill && prevFill.fill === 'solid'
        ? { ...prevFill, color: next }
        : { fill: 'solid' as const, color: next };
      return { ...o, style: { ...(o.style ?? {}), fill: nextFill } };
    }, 'Set fill');
  };
  const applyStrokeToSelection = (color: string): void => {
    const merge = (prev: string | undefined): string =>
      color.length === 9 ? color : mergeAlphaFromPrev(color, prev ?? '#000000ff');
    updateSelected((o) => o.tool !== 'text' ? { ...o, stroke: merge(o.stroke) } : o, 'Set stroke');
  };
  const applyStrokeWidthToSelection = (w: number): void => {
    updateSelected((o) => o.tool !== 'text' ? { ...o, strokeWidth: w } : o, 'Set stroke width');
  };

  // Summary of rotation across the current selection (in degrees) for the
  // properties panel. Returns null when nothing is selected so the panel
  // can hide the row entirely.
  const rotationDegSummary: { value: number; mixed: boolean } | null = useMemo(() => {
    if (selectedItems.length === 0) return null;
    const first = selectedItems[0].rotation ?? 0;
    const mixed = selectedItems.some((o) => (o.rotation ?? 0) !== first);
    return { value: Math.round((first * 180) / Math.PI), mixed };
  }, [selectedItems]);

  // Apply an absolute rotation (in degrees) to every selected object as a
  // single undoable batch of transform ops.
  const applyRotationToSelection = (degrees: number): void => {
    const radians = (degrees * Math.PI) / 180;
    const ids = [...selection.current];
    if (ids.length === 0) return;
    const ops: Op[] = [];
    for (const id of ids) {
      const o = itemsRef.current.find((x) => x.id === id);
      if (!o) continue;
      const from: Pose = { x: o.x, y: o.y, width: o.width, height: o.height, rotation: o.rotation };
      const to: Pose = { ...from, rotation: radians };
      ops.push(createTransformOp<Pose>({ id, from, to, label: 'Set rotation' }));
    }
    if (ops.length > 0) applyOps(ops, 'Set rotation');
  };

  // Read primary's current values for the panel inputs.
  // Fall back to the active swatches when the primary doesn't have its own
  // paint set (paths created from SVG import or older docs may lack fill /
  // stroke). PropertyColorInput requires a string.
  const primaryFill = toHex8(primary
    ? (primary.tool === 'text'
        ? (primary.style?.fill?.fill === 'solid' ? primary.style.fill.color : '#000000ff')
        : (primary.fill ?? fillColor))
    : fillColor);
  const primaryStroke = toHex8(primary && primary.tool !== 'text'
    ? (primary.stroke ?? strokeColor)
    : strokeColor);
  const primaryStrokeWidth = primary && primary.tool !== 'text'
    ? (primary.strokeWidth ?? strokeWidth)
    : strokeWidth;

  // ---- LayerList items (top of stack first) ----------------------------
  // Items array is bottom-up (index 0 = back). LayerList shows top first
  // so we reverse for display and translate the targetIndex back to a
  // bottom-up scene index in onReorder.
  const layerItems: LayerListItem[] = useMemo(() => {
    const objectRows: LayerListItem[] = [...items].reverse().map((o) => ({
      id: o.id,
      label: (
        <span className="swill-layer-label">
          <ToolIcon tool={o.tool} producedBy={'producedBy' in o ? o.producedBy : undefined} />
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
          <span>Background</span>
        </span>
      ),
    };
    return [...objectRows, pageRow];
  }, [items]);
  // ---- HistoryList items + current marker ------------------------------
  // The kit's history exposes `entries()` (undo oldest→newest, redo
  // oldest→newest from the user's perspective). We prepend a synthetic
  // "Initial" row at index 0 so users can fully unwind, then map history
  // entries to row index = 1 + position-in-stack. `currentIndex` is the
  // number of applied entries on the undo stack (entries.undo.length),
  // which also equals the position of the most-recently-applied row in
  // the prepended display list.
  const historyItems: HistoryListItem[] = useMemo(() => {
    const h = historyRef.current;
    if (!h) return [];
    const { undo, redo } = h.entries();
    const rows: HistoryListItem[] = [{
      id: '__initial__',
      label: <span className="swill-history-label swill-history-initial">Initial</span>,
    }];
    for (const e of undo) {
      rows.push({
        id: `h${e.id}`,
        label: <span className="swill-history-label">{e.label || 'Edit'}</span>,
      });
    }
    for (const e of redo) {
      rows.push({
        id: `h${e.id}`,
        label: <span className="swill-history-label">{e.label || 'Edit'}</span>,
      });
    }
    return rows;
    // historyVersion ticks on every push/undo/redo/clear/coalesce —
    // recompute whenever it changes.
  }, [historyVersion]);
  const historyCurrentIndex = useMemo(() => {
    const h = historyRef.current;
    if (!h) return 0;
    return h.entries().undo.length;
    // Same dep as historyItems — derived from the same snapshot.
  }, [historyVersion]);
  const onHistoryJump = useCallback((index: number) => {
    const h = historyRef.current;
    if (!h) return;
    // Display index 0 = Initial (no history applied); index N = N entries
    // on the undo stack. `goto(N)` walks the kit's stacks to match.
    h.goto(Math.max(0, index));
    publish();
  }, [publish]);

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

  // Snapshot the current scene into the same `SceneSnapshot` shape the IDB
  // store uses — so a recording's bundled scene is round-trippable through
  // either persistence layer. Captured copies are shallow `.slice()`s; the
  // contained Objs are treated as immutable downstream.
  const snapshotCurrentScene = useCallback((): SceneSnapshot => {
    return {
      version: 1,
      items: itemsRef.current.slice(),
      groups: groupsRef.current.slice(),
      doc,
      view,
    };
  }, [doc, view]);

  // Capture the canvas DOM element once after first paint. The kit's
  // `<Canvas>` doesn't expose its underlying <canvas>; we grab the only
  // one inside the canvas host.
  useEffect(() => {
    const c = document.querySelector('canvas');
    canvasElRef.current = c instanceof HTMLCanvasElement ? c : null;
  }, []);

  const onToggleRecord = useCallback(() => {
    let rec = recorderRef.current;
    if (!rec) {
      rec = createRecorder({ canvas: () => canvasElRef.current });
      recorderRef.current = rec;
    }
    if (rec.isRecording()) {
      const recording = rec.stop();
      // Trigger a JSON download via a transient anchor — same pattern as
      // `downloadSvg`. The file is self-contained: scene snapshot + events.
      const blob = new Blob([JSON.stringify(recording)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `swill-recording-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setRecording(false);
    } else {
      rec.start({ snapshotScene: snapshotCurrentScene });
      setRecording(true);
    }
  }, [snapshotCurrentScene]);

  // F9 toggles recording. F-keys are app-neutral across browsers (no
  // built-in conflict on F8/F9). On Mac with default keyboard settings,
  // users hit Fn+F9 to bypass the media-key remapping — flag for docs
  // if anyone gets confused.
  useKeybinding({ key: 'F9' }, onToggleRecord);

  const onPlay = useCallback(async (rec: Recording) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    await replayRecording(rec, {
      canvas,
      mode: 'flush',
      beforeFirstEvent: () => {
        // Restore the bundled scene so replay starts from the exact state
        // the recording was made against. No-op when the recording didn't
        // bundle one.
        const snap = rec.scene;
        if (!snap) return;
        itemsRef.current = snap.items.slice();
        groupsRef.current = snap.groups.slice();
        historyRef.current?.clear();
        setDoc(snap.doc);
        setView(snap.view);
        publish();
      },
    });
  }, [publish]);

  return (
    <div className="swill-app">
      {!disclaimerDismissed && (
        <div
          className={`swill-disclaimer${disclaimerDismissing ? ' swill-disclaimer-falling' : ''}`}
          onAnimationEnd={() => {
            // Fall animation finished — persist the dismiss so the
            // banner stays gone next session. The element unmounts on
            // the same render via `disclaimerDismissed`.
            if (disclaimerDismissing) setDisclaimerDismissed(true);
          }}
        >
          <p className="swill-disclaimer-text">
            This dumpster fire is not associated with Adobe or Illustrator. Obviously.
          </p>
          <button
            type="button"
            className="swill-disclaimer-dismiss"
            onClick={() => setDisclaimerDismissing(true)}
          >
            I understand
          </button>
        </div>
      )}

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
        canMoveForward={canMoveForward}
        canMoveBackward={canMoveBackward}
        onGroup={() => group()}
        onUngroup={() => ungroup()}
        canUngroup={canUngroupSelection}
        onAlign={(edge) => align(edge)}
        onDistribute={(axis) => distribute(axis)}
        onFlip={(axis) => flip(axis)}
        booleansAdapter={adapter}
        booleansActions={booleans}
        gridVisible={gridVisible}
        onToggleGrid={toggleGrid}
        snapToGrid={snapToGrid}
        onToggleSnap={toggleSnap}
        canReleaseCompound={releaseCompoundEnabled}
        onReleaseCompound={releaseCompoundPath}
        onOpenPrefs={() => setPrefsOpen(true)}
        recording={recording}
        onToggleRecord={onToggleRecord}
        onPlay={onPlay}
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
          const svgNodes = objsToSvgNodes(itemsRef.current, groupsRef.current);
          const svg = serializeSvg(svgNodes, docToSerializeOptions({
            title: docTitle,
            size: doc.size,
            paperSize,
          }));
          downloadSvg(svg, `${docTitle || 'untitled'}.svg`);
        }}
        onOpenSvg={async () => {
          const text = await pickSvgFile();
          if (text == null) return;
          const parsed = parseSvg(text, { namespaces: SWILL_NAMESPACES });
          if (parsed.warnings.length > 0) {
            pushToast('SVG opened with warnings', parsed.warnings);
          }
          const { items: nextItems, groups: nextGroups } = svgNodesToObjsWithGroups(
            parsed.nodes,
            () => `i${nextId.current++}`,
          );
          itemsRef.current = nextItems;
          groupsRef.current = nextGroups;
          historyRef.current?.clear();
          selection.set([]);
          const patch = parsedToDoc(parsed);
          if (patch.size) setDoc({ size: patch.size });
          if (patch.title != null) setDocTitle(patch.title);
          // Paper-size preset: if the file declared one we recognize, snap
          // the doc size to the canonical preset so the named preset wins
          // over a viewBox that drifted by rounding.
          if (patch.paperSize) {
            const ps = patch.paperSize;
            setDoc((d) => ({ ...d, size: { ...PAPER_PRESETS[ps] } }));
          }
          publish();
        }}
      />

      <div className="swill-body">
        <Sidebar side="left" className="swill-sidebar" ariaLabel="Tools">
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
            onClick={() => centerOnDoc(1)}
            title="Reset view"
            type="button"
          >
            <span>Reset</span>
            <span className="key">view</span>
          </button>
        </Sidebar>

        <main
          ref={stageRef}
          className="swill-stage"
          onPointerMove={onStagePointerMove}
          onPointerLeave={onStagePointerLeave}
        >
          <div
            ref={pageShadowRef}
            className={`swill-canvas-host${penIsEditing ? ' pen-edit-active' : ''}`}
            onDoubleClick={(e) => {
              const canvas = e.target instanceof HTMLCanvasElement ? e.target : null;
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              // Canvas pixel coords → world coords via the active view.
              const cx = (e.clientX - rect.left) / view.scale + view.x;
              const cy = (e.clientY - rect.top) / view.scale + view.y;
              const texts = itemsRef.current.filter((o): o is TextObj => o.tool === 'text');
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
              // Wired so the dispatcher's getNodeAtPoint resolves a node
              // (and a real ctx.target.kind) on body clicks. Without
              // this, the select tool's drag route table always picks
              // the 'empty' branch (marquee) instead of the per-kind
              // 'rect'/'text'/'path' branches that call move.beginAt.
              pickEvery={pickEvery}
              // Same shape-aware bounds resolver as the select tool, so the
              // selection chrome can draw around a group id (which isn't in
              // items) by computing the union AABB of its members.
              boundsOf={boundsOfId}
              layers={{
                doc: { layer: pageLayer, before: 'scene' },
                // Grid sits between the page background and the shapes. The
                // standard `grid` slot key is reserved for `GridSlotConfig`
                // (raw layer opts) — to route the hook's RenderLayer through,
                // we use a custom slot key and anchor it with `before: 'scene'`.
                // LayersMap iteration is insertion-ordered, so `doc` then
                // `gridOverlay` both anchored before `scene` produce the
                // sequence doc → grid → scene-anchored standard layers.
                ...(gridVisible
                  ? { gridOverlay: { layer: gridFeature.layers.grid(null), before: 'scene' as const } }
                  : {}),
                // Non-text shapes (rect/ellipse/polygon/star/line/pen/pencil/
                // imported) all render through `shapeLayer`. The kit's generic
                // `scene.drawOne` slot can't wrap individual shapes in their
                // own rotation transform, so we host shape rendering up here
                // and `wrapWithRotation` each shape's commands per its pose.
                shapes: { layer: shapeLayer, before: 'selectionOverlay' },
                text: { layer: textLayer, before: 'selectionOverlay' },
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
            const startW = rightSidebarWidth;
            const move = (ev: PointerEvent) => {
              const next = Math.max(220, Math.min(420, startW + (startX - ev.clientX)));
              setRightSidebarWidth(next);
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
          width={rightSidebarWidth}
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
          activeFill={activeFill}
          activeStroke={activeStroke}
          setActiveFill={setActiveFill}
          setActiveStroke={setActiveStroke}
          focusedSwatch={focusedSwatch}
          setFocusedSwatch={setFocusedSwatch}
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
          focusedAlpha={colors.focusedAlpha}
          setFocusedAlpha={colors.setFocusedAlpha}
          rotationDeg={rotationDegSummary}
          applyRotationToSelection={applyRotationToSelection}
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
          historyItems={historyItems}
          historyCurrentIndex={historyCurrentIndex}
          onHistoryJump={onHistoryJump}
          // Force a re-publish whenever the clipboard tick advances —
          // ensures the paste-button's clipboardEmpty flag stays current.
          clipboardTick={clipboardTick}
          pageSelected={pageSelected}
          panels={panels}
          setPanelCollapsed={setPanelCollapsed}
          setPanelHidden={setPanelHidden}
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
      <PreferencesModal
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        registryEnumSources={{
          // `tools.lastTool` picks from whichever tools the app has
          // registered. Label falls back to id when a tool omits its
          // presentation block. The `filter` payload is honored —
          // a future pref could pin to a specific group via
          // `filter: { group: 'draw' }`, for example.
          tools: (filter) => Object.entries(tools.registry)
            .filter(([id, t]) => matchesRegistryFilter(
              { id, group: t.presentation?.group, label: t.presentation?.label },
              filter,
            ))
            .map(([id, t]) => ({
              value: id,
              label: t.presentation?.label ?? id,
            })),
        }}
      />
      <Toasts toasts={toasts} onDismiss={dismissToast} />
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
  // Active-paint primitives. Threaded so the Defaults panel can render the
  // same paired-swatch widget the tool palette uses (compact variant).
  activeFill: ActivePaint;
  activeStroke: ActivePaint;
  setActiveFill: (p: ActivePaint) => void;
  setActiveStroke: (p: ActivePaint) => void;
  focusedSwatch: 'fill' | 'stroke';
  setFocusedSwatch: (which: 'fill' | 'stroke') => void;
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
  /** Alpha (0..1) of the active fill/stroke swatch — defaults panel. */
  focusedAlpha: number;
  setFocusedAlpha: (alpha01: number) => void;
  rotationDeg: { value: number; mixed: boolean } | null;
  applyRotationToSelection: (degrees: number) => void;
  layerItems: LayerListItem[];
  selectedIds: string[];
  onSelectLayers: (ids: string[]) => void;
  onLayerReorder: (ids: string[], targetIndex: number) => void;
  historyItems: HistoryListItem[];
  historyCurrentIndex: number;
  onHistoryJump: (index: number) => void;
  clipboardTick: number;
  pageSelected: boolean;
  /** Panel visibility / collapse state, keyed by panel id. Sourced from
   *  `usePref('ui.panels')` so the Preferences modal's panels editor
   *  toggles the same map. */
  panels: Record<string, { hidden?: boolean; collapsed?: boolean }>;
  setPanelCollapsed: (id: string, collapsed: boolean) => void;
  setPanelHidden: (id: string, hidden: boolean) => void;
}

function RightSidebar(p: RightSidebarProps) {
  // clipboardTick is only present so React re-renders this subtree when
  // the clipboard mutates; the value itself is unused.
  useEffect(() => { /* re-render on clipboardTick change */ }, [p.clipboardTick]);
  const { primary, selectedItems } = p;
  // Build the collapse/hide/title-handlers props for a panel id. Returns
  // `null` when the panel is hidden — callers conditional-render on it so
  // hidden panels disappear entirely from the sidebar (the Prefs modal's
  // panels editor is the way to bring them back).
  const panelProps = (id: string) => {
    const state = p.panels[id];
    if (state?.hidden) return null;
    return {
      collapsed: !!state?.collapsed,
      onToggleCollapse: () => p.setPanelCollapsed(id, !state?.collapsed),
      onHide: () => p.setPanelHidden(id, true),
    };
  };
  return (
    <Sidebar
      side="right"
      className="swill-sidebar right"
      ariaLabel="Inspector"
      // CSS custom property — a width drag handle has no class-based
      // equivalent; the variable lets CSS handle min/max clamping.
      style={{ ['--swill-right-width' as string]: `${p.width}px` } as React.CSSProperties}
    >
      {p.pageSelected ? (
        (() => { const pp = panelProps('page'); return pp && (
        <PropertiesPanel title="Background" {...pp}>
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
        ); })()
      ) : primary ? (
        (() => { const pp = panelProps('selection'); return pp && (
        <PropertiesPanel title={`Selection (${selectedItems.length})`} {...pp}>
          <PropertyRow label="Kind">
            <PropertyReadOnly>
              {primary.tool}{selectedItems.length > 1 ? ` +${selectedItems.length - 1}` : ''}
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
          <PropertyRow label="Rotation">
            <PropertyAxisInput
              axis="°"
              value={p.rotationDeg?.value ?? 0}
              onChange={(v) => p.applyRotationToSelection(v)}
              step={1}
            />
            {p.rotationDeg?.mixed && (
              <PropertyReadOnly span={6}>Multiple</PropertyReadOnly>
            )}
          </PropertyRow>
          <PropertyRow label="Fill">
            <PropertyColorInput value={p.primaryFill} onChange={p.applyFillToSelection} />
          </PropertyRow>
          {p.hasStrokeProps && (
            <>
              <PropertyRow label="Stroke">
                <PropertyColorInput value={p.primaryStroke} onChange={p.applyStrokeToSelection} />
              </PropertyRow>
              <PropertyRow>
                <PropertySliderInput label="Width" value={p.primaryStrokeWidth} onChange={p.applyStrokeWidthToSelection} min={0} max={20} step={1} span={12} />
              </PropertyRow>
            </>
          )}
          {/* Opacity slider edits the alpha of whichever swatch (fill / stroke)
              is currently focused — same focus signal that drives stroke-width
              editing. Routes through the same apply* functions as the color
              picker so a single undo entry covers the edit. */}
          <PropertyRow>
            <PropertySliderInput
              label="Opacity"
              value={Math.round(getAlpha01(p.focusedSwatch === 'stroke' && p.hasStrokeProps ? p.primaryStroke : p.primaryFill) * 100)}
              onChange={(pct) => {
                const a = pct / 100;
                if (p.focusedSwatch === 'stroke' && p.hasStrokeProps) {
                  p.applyStrokeToSelection(withAlpha01(p.primaryStroke, a));
                } else {
                  p.applyFillToSelection(withAlpha01(p.primaryFill, a));
                }
              }}
              min={0}
              max={100}
              step={1}
              span={12}
            />
          </PropertyRow>
        </PropertiesPanel>
        ); })()
      ) : (
        (() => { const pp = panelProps('defaults'); return pp && (
        <PropertiesPanel title="Defaults" {...pp}>
          <PropertyRow label="FillStyle">
            <ActiveSwatches
              compact
              fill={p.activeFill}
              stroke={p.activeStroke}
              focused={p.focusedSwatch}
              onChangeFill={p.setActiveFill}
              onChangeStroke={p.setActiveStroke}
              onFocus={p.setFocusedSwatch}
            />
          </PropertyRow>
          <PropertyRow>
            <PropertySliderInput label="Width" value={p.strokeWidth} onChange={p.setStrokeWidth} min={0} max={20} step={1} span={12} />
          </PropertyRow>
          <PropertyRow>
            <PropertySliderInput
              label="Opacity"
              value={Math.round(p.focusedAlpha * 100)}
              onChange={(pct) => p.setFocusedAlpha(pct / 100)}
              min={0}
              max={100}
              step={1}
              span={12}
            />
          </PropertyRow>
        </PropertiesPanel>
        ); })()
      )}

      {(() => { const pp = panelProps('colors'); return pp && (
      <SidebarPanel title="Colors" {...pp} className="swill-colors-panel">
        <PropertySwatchGrid
            value={
              primary
                ? (p.focusedSwatch === 'stroke' ? p.primaryStroke : p.primaryFill)
                : (p.focusedSwatch === 'stroke' ? p.strokeColor   : p.fillColor)
            }
            options={PALETTE}
            columns={10}
            leading={{
              active: primary
                ? (p.focusedSwatch === 'stroke' ? p.primaryStroke : p.primaryFill) === 'rgba(0,0,0,0)'
                : (p.focusedSwatch === 'stroke' ? p.activeStroke.kind : p.activeFill.kind) === 'transparent',
              title: 'Transparent',
              onClick: () => {
                if (primary) {
                  if (p.focusedSwatch === 'stroke') p.applyStrokeToSelection('rgba(0,0,0,0)');
                  else p.applyFillToSelection('rgba(0,0,0,0)');
                } else {
                  if (p.focusedSwatch === 'stroke') p.setActiveStroke({ kind: 'transparent' });
                  else p.setActiveFill({ kind: 'transparent' });
                }
              },
            }}
            onChange={(v) => {
              // Route to whichever swatch is focused — fill OR stroke. Was
              // unconditionally fill before, which made the swatch grid
              // useless for setting stroke colors.
              if (primary) {
                if (p.focusedSwatch === 'stroke') p.applyStrokeToSelection(v);
                else p.applyFillToSelection(v);
              } else {
                if (p.focusedSwatch === 'stroke') p.setStrokeColor(v);
                else p.setFillColor(v);
              }
            }}
          />
      </SidebarPanel>
      ); })()}

      {(() => { const pp = panelProps('layers'); return pp && (
      <SidebarPanel title="Layers" {...pp}>
        <div className="swill-layerlist-host">
          <LayerList
            items={p.layerItems}
            selectedIds={p.selectedIds}
            onSelect={p.onSelectLayers}
            onReorder={p.onLayerReorder}
            empty="No objects yet"
          />
        </div>
      </SidebarPanel>
      ); })()}

      {(() => { const pp = panelProps('history'); return pp && (
      <SidebarPanel title="History" {...pp}>
        <div className="swill-historylist-host">
          <HistoryList
            items={p.historyItems}
            currentIndex={p.historyCurrentIndex}
            onJump={p.onHistoryJump}
            empty="No history yet"
          />
        </div>
      </SidebarPanel>
      ); })()}

      {(() => { const pp = panelProps('document'); return pp && (
      <PropertiesPanel title="Document" {...pp}>
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
      ); })()}

      {(() => { const pp = panelProps('view'); return pp && (
      <PropertiesPanel title="View" {...pp}>
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
          <PropertyNumberInput value={p.gridDensity} onChange={p.setGridDensity} span={4} min={4} max={288} step={4} />
        </PropertyRow>
        <PropertyRow>
          <PropertyButton onClick={() => p.setView(() => ({ x: 0, y: 0, scale: 1 }))} span={12}>
            Reset view
          </PropertyButton>
        </PropertyRow>
      </PropertiesPanel>
      ); })()}

      <div className="swill-section-label swill-scene-label">Scene</div>
      <div className="swill-scene-count">
        {p.itemsLen} object{p.itemsLen === 1 ? '' : 's'}
      </div>
    </Sidebar>
  );
}
