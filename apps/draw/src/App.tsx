/**
 * WeaselDraw — minimum-viable editor built against the post-purge kit
 * surface.
 *
 * Shape:
 *   - `<SceneCanvas toolBundle="exhaustive">` provides every built-in tool
 *     (select / hand / rect / ellipse / line / polygon / star / pencil /
 *     lasso / text / clone) plus the resize / rotate affordances.
 *   - `useScene` owns the document tree; pose is `{x,y,width,height,rotation?}`
 *     and data is the kit-native `{path, fill, stroke?, strokeWidth?, text?}`
 *     shape consumed by PATH_PAINTER / kit:text. Both are what the bundled
 *     shape-tool `create` defaults already produce, so no per-tool overrides.
 *   - The Actions Registry (auto-mounted by SceneCanvas via
 *     `useStandardActions`) handles undo/redo, delete, duplicate, nudge,
 *     align/distribute, reorder, flip, group/ungroup. We trigger by id from
 *     the ActionBar and the keyboard via the dispatcher.
 *   - `<ColorContextProvider>` holds the active fill/stroke; selection
 *     mutations go through `scene.update` so they're undoable.
 *   - `<ActionBar>` is mounted as-is, with feature handlers that are
 *     either backed by registry triggers or stubbed (see `apps/draw/TODO.md`
 *     for the v0 omissions).
 *   - `<ActiveSwatches>` is the fill/stroke widget; clicks open a native
 *     color picker via the existing component implementation.
 *   - Local-storage round-trip: serialized scene + view persisted on every
 *     mutation (debounced inside SceneCanvas re-renders).
 */
import {
  useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactElement,
} from 'react';
import { useColorModeControl } from './colorMode';
import {
  SceneCanvas,
  useScene,
  useSelection,
  useActionsRegistry,
  useBooleansAdapter,
  rectPath,
  asNodeId,
  boundsOfPath,
  pathInWorld,
  splitSubpaths,
  PATH_M,
  gridSnapStrategy,
  transformPath,
  type ToolsApi,
  type Path,
  type FillStyle,
  type GradientFill,
  type UiOngoingControl,
  type AlignEdge,
  type DistributeAxis,
  type SerializedScene,
  type AddNodeSpec,
  type BooleansAdapter,
  type NodeId,
  type View,
  type RenderLayer,
  type DrawCommand,
  fitViewToBounds,
  viewToTransform,
  worldToScreen,
  ActiveToolContextProvider,
  useActiveToolContext,
  DEFAULT_STROKE_COLOR,
  defaultCommitAdapter,
  inferredNodeProperties,
  inferredNodeRouting,
  resolveTextStyle,
  sampleGradientStops,
  fillInPoseFrame,
  fillToBoundsFrame,
  type ToolPrefColor,
  useClipboardOps,
  useDepSource,
  type ClipboardDep,
  type ClipboardSnapshot,
  WEASEL_CLIPBOARD_MIME,
  buildWeaselClipboardText,
  useSceneTextEdit,
  type StyledRun,
  type TextStyle,
  type RangeStyle,
  type RunStylePatch,
  type Scene,
  type SceneCanvasApi,
  buildSceneViewCommands,
  defaultDrawOne,
  viewToMat3,
} from '@weasel-js/core';
import { useHudContribution } from '@weasel-js/hud/react';
import {
  GradientHandles,
  ResizeHandle,
  Sidebar,
  SidebarPanel,
  SelectionPanel,
  StatusBar,
  StatusBarItem,
  StatusBarSpacer,
  ToolPalette,
  ToolOptionsBar,
  strokeColorOf,
  type PropertyRenderer,
} from '@weasel-js/ui';

import { ActionBar, type FlipAxis, type PaperSizeKey } from './ActionBar';
import { ActiveSwatches, type ActivePaint } from './ActiveSwatches';
import { PreferencesModal } from './PreferencesModal';
import { ColorContextProvider } from './tools/colorContext/ColorContextProvider';
import { LayerList, type LayerListItem } from './ui/LayerList';
import { useLayerList } from './ui/LayerList/useLayerList';
import {
  PropertiesPanel,
  PropertiesGrid,
  PropertyRow,
  PropertyTextInput,
  PropertyColorInput,
  PropertyFillInput,
  PropertySwatchGrid,
  PropertySelect,
} from './ui/PropertiesPanel';
import { HistoryList } from './ui/HistoryList';
import { buildLabel, buildTitle } from '../../shared/buildInfo';
import { PREFS, usePref } from './prefs';
import { LoupeControls } from './LoupeControls';
import { enableMachineFontOutlines, disableMachineFontOutlines } from './fonts';

// Bounds for the sidebar drag come from the pref that stores the result, so
// the handle and the Preferences number field can't drift apart. app.css
// clamps to the same numbers as a backstop.
const RIGHT_SIDEBAR_MIN = PREFS.children.ui.children.rightSidebarWidth.min;
const RIGHT_SIDEBAR_MAX = PREFS.children.ui.children.rightSidebarWidth.max;
import {
  CharacterOptions,
  FontFamilySelect,
  TextEditDepPublisher,
  effectiveRangeStyle,
  textStyleFromPatch,
} from './ui/CharacterOptions';
import { DispatchTracePanel } from './dev/DispatchTracePanel';
import { lookupShortcutByToolId } from './dev/keybindingsView';
import { useColorContext } from './tools/colorContext';
import { useOpacityScrub } from './opacityScrub/useOpacityScrub';
import { OpacityHud } from './opacityScrub/OpacityHud';
import { useSceneAdapter } from '@weasel-js/core';
import { sliceAction } from '@weasel-js/core';
import type { SerializedHistory } from '@weasel-js/history';
import { serializeReplacer, reviveTypedArrays, clipboardJsonReviver, nodeSpecsFromSnapshot } from './persistence';
import { useSliceTool } from './tools/slice/useSliceTool';
import { SliceDepPublisher } from './tools/slice/SliceDepPublisher';
import { parseSvg, unpackSvgFiles } from '@weasel-js/svg';
import { downloadSvg, pickSvgFile, svgNodesToSceneDrafts, parsedToDoc, SWILL_NAMESPACES } from './svgInterop';
import { useModality } from './modality/useModality';
import type { ModeMachine } from './modality';
import { dispatchDoubleClickEntry } from './modality';
import { ModeBreadcrumb } from './modality/chrome/ModeBreadcrumb';
import { ModeStatusIndicator } from './modality/chrome/ModeStatusIndicator';
import type { SceneCanvasHit } from '@weasel-js/core';
import { IMPLICIT_TAGS } from '@weasel-js/modes';
import { sceneToSvgString, selectionToClipboardSvgString, clipboardSnapshotRootIds } from './svgExport';
import type { RecordingProfile } from './recorder';

import './app.css';

// ─── Document / scene shapes ────────────────────────────────────────────────

/** Pose stored on every leaf — rectangular AABB plus optional rotation
 *  (radians, pivot = unrotated AABB center). Matches the auto-rotation
 *  hook `SceneCanvas.defaultDrawOne` applies for any pose carrying a
 *  non-zero `rotation` field. */
interface WeaselDrawPose {
  x: number; y: number; width: number; height: number; rotation?: number;
}

/** Data stored on every leaf — kit-native shape consumed by PATH_PAINTER
 *  and the text painter. Tools synthesized by `toolBundle="exhaustive"`
 *  already produce this shape, so no per-tool `create` overrides are
 *  required. `text` is present on text-tool leaves only. */
interface WeaselDrawData {
  path?: Path;
  text?: string;
  /** Node-level typography. What the sidebar's Character / Paragraph groups
   *  edit, and what runs inherit from. */
  style?: TextStyle;
  /** Inline styling over `text`. Kept in sync with it by every writer —
   *  `runsToPlainText(runs) === text` — and preferred by the `kit:text`
   *  painter when present. */
  runs?: StyledRun[];
  /** A color string, or any `FillStyle` — gradient or pattern. Persisted
   *  documents predate the object form and carry plain strings, which every
   *  reader still accepts as an opaque solid. */
  fill?: string | FillStyle;
  stroke?: string;
  strokeWidth?: number;
  label?: string;
}

type WeaselDrawLayer = 'default';

/** Paper sizes — the canvas fills the workspace; the page is drawn as a
 *  world-space layer at `{0,0,paper.width,paper.height}` (see `paperLayer`
 *  below). Pan/zoom moves the page around within the striped workspace. */
const PAPER_PRESETS: Record<PaperSizeKey, { width: number; height: number }> = {
  letter: { width: 816, height: 1056 },
  a4:     { width: 794, height: 1123 },
  legal:  { width: 816, height: 1344 },
};

const LS_KEY = 'weaseldraw:scene-v1';
const DOC_KEY = 'weaseldraw:doc-v1';
const HISTORY_KEY = 'weaseldraw:history-v1';

const DEFAULT_FILENAME = 'untitled.svg';
const DEFAULT_BG_COLOR = '#ffffff';

// Draw's full ingestion config: SVG unpack + clipboard revival.
// OS-dropped / pasted SVG files import as real scene nodes (the kit's
// `unpack` path) rather than a single embedded-image node — WeaselDraw's
// leaf data IS the kit-native `{path, fill, stroke}` painter shape, so
// unpacked nodes render and edit like any other object. `clipboard.reviver`
// revives typed-array node data (Uint8Array/Float32Array path commands)
// carried by weasel-JSON clipboard payloads — via `clipboardJsonReviver`,
// the JSON-reviver adapter over the same `reviveTypedArrays` walk that scene
// persistence uses (the walker itself is NOT `(key, value)`-shaped; see
// persistence.ts). Module const: SceneCanvas keys its dep wiring off the
// prop identity.
const DRAW_INGESTION = { svg: { unpack: unpackSvgFiles }, clipboard: { reviver: clipboardJsonReviver } };
/** Synthetic id for the locked "Background" row in the Layers panel.
 *  Selecting this row surfaces the Document properties branch in the
 *  Properties panel; clicking any real node clears it. */
const BACKGROUND_ROW_ID = '__background__';

interface PersistedDoc {
  filename: string;
  backgroundColor: string;
}

function loadDoc(): PersistedDoc {
  try {
    const raw = localStorage.getItem(DOC_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedDoc>;
      return {
        filename: typeof parsed.filename === 'string' && parsed.filename ? parsed.filename : DEFAULT_FILENAME,
        backgroundColor: typeof parsed.backgroundColor === 'string' && parsed.backgroundColor ? parsed.backgroundColor : DEFAULT_BG_COLOR,
      };
    }
  } catch { /* fall through */ }
  return { filename: DEFAULT_FILENAME, backgroundColor: DEFAULT_BG_COLOR };
}

// 100-cell palette, 10 columns × 10 rows:
//   row 1: null (transparent) + 9 quick-pick primaries/secondaries
//   row 2: 10-shade gray ramp (50 → 900)
//   rows 3–10: 8 hue ramps × 10 shades each (50 → 900)
const PALETTE: { value: string | null; label: string }[] = [
  { value: null,        label: 'None' },
  { value: '#ffffffff', label: 'White' },
  { value: '#000000ff', label: 'Black' },
  { value: '#ff0000ff', label: 'Red' },
  { value: '#00ff00ff', label: 'Green' },
  { value: '#0000ffff', label: 'Blue' },
  { value: '#00ffffff', label: 'Cyan' },
  { value: '#ff00ffff', label: 'Magenta' },
  { value: '#ffff00ff', label: 'Yellow' },
  { value: '#ff8800ff', label: 'Orange' },
  { value: '#fafafaff', label: 'Gray 50' },
  { value: '#f5f5f5ff', label: 'Gray 100' },
  { value: '#e5e5e5ff', label: 'Gray 200' },
  { value: '#d4d4d4ff', label: 'Gray 300' },
  { value: '#a3a3a3ff', label: 'Gray 400' },
  { value: '#737373ff', label: 'Gray 500' },
  { value: '#525252ff', label: 'Gray 600' },
  { value: '#404040ff', label: 'Gray 700' },
  { value: '#262626ff', label: 'Gray 800' },
  { value: '#171717ff', label: 'Gray 900' },
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

/** Seed fill for a fresh document. Intentionally a friendly blue rather than
 *  the kit's white `DEFAULT_FILL_COLOR` — a new shape lands visible against
 *  the white page instead of disappearing into it. Keep distinct from the
 *  kit default on purpose. */
const INITIAL_FILL_COLOR = '#7ab8d4ff';

/** Fill/stroke keep their ActionsRegistry begin/update/end path (drag-
 *  coalesced live preview + one undo entry per gesture) by overriding
 *  the built-in color renderer with the existing PropertyColorInput.
 *  Keyed by path (not `color` kind) so a future third color leaf can't
 *  silently fall through to the wrong pair of actions. */
/** Fill gets the paint-kind switch on top of the color input, so a node can
 *  carry a gradient. Stroke keeps the plain color renderer — the renderer
 *  requires a solid stroke paint. */
/** Every `FillStyle` variant, not just the gradients. Keyed on the union's
 *  own discriminant, so a variant added later needs no change here — the
 *  earlier `'stops' in raw` test silently downgraded patterns to the
 *  fallback color. */
function isFillStyleObject(raw: unknown): raw is FillStyle {
  if (raw === null || typeof raw !== 'object') return false;
  return 'fill' in raw || 'stops' in raw || 'color' in raw;
}

function wdFillRenderer(colorActionId: string, opacityActionId: string): PropertyRenderer {
  return (ctx) => {
    const fallback = (ctx.pref as ToolPrefColor).default;
    const raw = ctx.value;
    const value: string | FillStyle =
      typeof raw === 'string' || isFillStyleObject(raw) ? (raw as string | FillStyle) : fallback;
    const input = (
      <PropertyFillInput
        value={value}
        colorActionId={colorActionId}
        opacityActionId={opacityActionId}
      />
    );
    if (!ctx.mixed) return input;
    return (
      <span title="Mixed" className="wd-mixed">
        {input}
      </span>
    );
  };
}

function wdActionColorRenderer(colorActionId: string, opacityActionId: string): PropertyRenderer {
  return (ctx) => {
    // `data.stroke` is `string | Stroke`, so the color shown comes off
    // whichever form the node holds. Writes go through the actions, which
    // preserve the object.
    const fallback = (ctx.pref as ToolPrefColor).default;
    const value = strokeColorOf(ctx.value) ?? fallback;
    const input = (
      <PropertyColorInput value={value} colorActionId={colorActionId} opacityActionId={opacityActionId} />
    );
    if (!ctx.mixed) return input;
    return (
      <span title="Mixed" className="wd-mixed">
        {input}
      </span>
    );
  };
}
/** Marks the tool options bar as the text editor's own chrome, so focus
 *  landing in it doesn't commit the edit those controls are there to style.
 *  A class rather than a ref because the check is a `closest()` from an
 *  arbitrary focus target, including one inside a portalled popover. */
const TEXT_CHROME_CLASS = 'wd-text-chrome';

const WD_RENDERERS: Record<string, PropertyRenderer> = {
  'data.fill': wdFillRenderer('setFill', 'setFillOpacity'),
  'data.stroke': wdActionColorRenderer('setStroke', 'setStrokeOpacity'),
  // The schema's `font-family` leaf has no builtin renderer — the registry it
  // has to read is a runtime fact, not a static option list. Keyed by kind
  // rather than path so any future family leaf picks it up.
  //
  // The substitution probe runs at 400/normal: `PropertyRenderContext` carries
  // one leaf's value, not its siblings, so this renderer can't see the node's
  // `fontWeight` / `fontStyle`. Cross-family substitution — the thing the
  // label reports — is decided by the family, so the variant only sharpens
  // the message rather than changing whether there is one.
  'font-family': (ctx) => (
    <FontFamilySelect
      value={ctx.mixed || typeof ctx.value !== 'string' ? undefined : ctx.value}
      mixed={ctx.mixed}
      onChange={ctx.setValue}
      aria-label="Font"
    />
  ),
};

// ─── Right sidebar: LayerList + SelectionPanel ──────────────────────────────

/**
 * The color chip on a layer row. Paths keep their paint in `data.fill`;
 * text keeps its own in `data.style.fill`, following the kit's `FillStyle`
 * model, and carries no `data.fill` at all — so reading only the latter left
 * every text row with a blank chip.
 *
 * `resolveTextStyle` is the same function the renderer resolves through, so
 * an unstyled text node reports the black it actually paints rather than
 * nothing. Non-solid paints (gradient, pattern) have no single color to show
 * and return undefined until the row can draw a real preview.
 */
function layerSwatch(data: WeaselDrawData): string | undefined {
  if (typeof data.fill === 'string') return data.fill;
  if (data.fill !== undefined) return paintChipColor(data.fill);
  if (data.text === undefined) return undefined;
  const { fill } = resolveTextStyle(data.style);
  return 'color' in fill ? fill.color : undefined;
}

/** One representative color for a `FillStyle`, for a chip too small to draw
 *  the real paint: a gradient shows its midpoint, which reads closer to the
 *  whole ramp than either end does, and a tile pattern shows the color it
 *  draws with. A pattern built from a raw `TextureHandle` has no color to
 *  report. */
function paintChipColor(fill: FillStyle): string | undefined {
  const gradient = gradientOf(fill);
  if (gradient) return sampleGradientStops(gradient.stops, 0.5);
  if (fill.fill === undefined || fill.fill === 'solid') return fill.color;
  if (fill.fill === 'pattern' && 'tile' in fill.pattern) return fill.pattern.color;
  return undefined;
}

/**
 * On-canvas geometry handles for the selected node's gradient, when there is
 * exactly one and its fill is one.
 *
 * The node's stored gradient is in `bounds` units — `0..1` across its pose
 * box — so the mapping to overlay pixels is the pose box composed with the
 * view, and the drag math in `<GradientHandles>` inverts it. That keeps the
 * stored paint resolution-independent: the same numbers survive pan, zoom
 * and a resize of the node.
 */
function SelectedGradientHandles(props: {
  scene: ReturnType<typeof useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>>;
  selection: ReturnType<typeof useSelection>;
  view: View;
  width: number;
  height: number;
}): ReactElement | null {
  const { scene, selection, view, width, height } = props;
  const actions = useActionsRegistry();
  const ctrlRef = useRef<UiOngoingControl | null>(null);

  const ids = selection.get();
  const node = ids.length === 1 ? scene.get(ids[0]) : null;
  const gradient = node?.kind === 'leaf' ? gradientOf(node.data.fill) : null;

  if (!gradient || !node || node.kind !== 'leaf') return null;
  if (width <= 0 || height <= 0) return null;

  const pose = node.pose;
  // `<GradientHandles>` needs an isotropic frame; the stored gradient is in
  // `bounds`, whose two axes have different scales. Resolve into page space
  // on the way in, re-normalize on the way out.
  const resolved = fillInPoseFrame(gradient, pose) as GradientFill;
  const t = viewToTransform(view);
  const toScreen = (p: { x: number; y: number }): { x: number; y: number } => {
    const [x, y] = worldToScreen(p.x, p.y, t);
    return { x, y };
  };
  // Invert by projecting two known points: the view may be anisotropic, so
  // the two axes need separate scales.
  const origin = toScreen({ x: 0, y: 0 });
  const unit = toScreen({ x: 1, y: 1 });
  const toLocal = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: unit.x === origin.x ? 0 : (p.x - origin.x) / (unit.x - origin.x),
    y: unit.y === origin.y ? 0 : (p.y - origin.y) / (unit.y - origin.y),
  });

  const dispatch = (next: GradientFill, phase: 'input' | 'commit'): void => {
    const paint = fillToBoundsFrame(next, pose);
    if (!ctrlRef.current) {
      ctrlRef.current = actions?.begin('setFill', { paint }) ?? null;
    } else {
      ctrlRef.current.update({ paint });
    }
    if (phase === 'commit' && ctrlRef.current) {
      ctrlRef.current.end('commit');
      ctrlRef.current = null;
    }
  };

  return (
    <GradientHandles
      value={resolved}
      toScreen={toScreen}
      toLocal={toLocal}
      width={width}
      height={height}
      onInput={(next) => dispatch(next, 'input')}
      onChange={(next) => dispatch(next, 'commit')}
    />
  );
}

/** The gradient in a node's fill, or null for anything else. */
function gradientOf(fill: string | FillStyle | undefined): GradientFill | null {
  if (fill === undefined || typeof fill === 'string') return null;
  switch (fill.fill) {
    case 'linear-gradient':
    case 'radial-gradient':
    case 'conic-gradient':
      return fill;
    default:
      return null;
  }
}

interface RightSidebarProps {
  scene: ReturnType<typeof useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>>;
  selection: ReturnType<typeof useSelection>;
  filename: string;
  setFilename: (v: string) => void;
  backgroundColor: string;
  setBackgroundColor: (v: string) => void;
  paperSize: PaperSizeKey;
  setPaperSize: (v: PaperSizeKey) => void;
  docSelected: boolean;
  setDocSelected: (v: boolean) => void;
}

function RightSidebar({
  scene,
  selection,
  filename,
  setFilename,
  backgroundColor,
  setBackgroundColor,
  paperSize,
  setPaperSize,
  docSelected,
  setDocSelected,
}: RightSidebarProps): ReactElement {
  const adapter = useSceneAdapter(scene, {});
  const baseLayerListProps = useLayerList({
    scene,
    selection,
    adapter,
    itemFor: (node) => {
      const data = node.data as WeaselDrawData;
      return {
        label: data.text ?? data.label ?? node.id,
        swatch: layerSwatch(data),
      };
    },
  });

  // Augment the kit-derived layer items with a pinned, locked virtual
  // "Background" row. Selecting it routes to the Document properties
  // branch instead of the kit `SelectionApi` (the synthetic id is not a
  // real NodeId and would corrupt scene queries).
  const backgroundRow: LayerListItem = {
    id: BACKGROUND_ROW_ID,
    label: 'Background',
    swatch: backgroundColor,
    locked: true,
  };
  const layerItems = [...baseLayerListProps.items, backgroundRow];
  const layerSelectedIds = docSelected
    ? [BACKGROUND_ROW_ID]
    : baseLayerListProps.selectedIds;
  const onLayerSelect = (ids: string[]): void => {
    if (ids.includes(BACKGROUND_ROW_ID)) {
      setDocSelected(true);
      selection.set([]);
    } else {
      setDocSelected(false);
      baseLayerListProps.onSelect(ids);
    }
  };
  const layerListProps = {
    ...baseLayerListProps,
    items: layerItems,
    selectedIds: layerSelectedIds,
    onSelect: onLayerSelect,
  };

  const [layersCollapsed, setLayersCollapsed] = usePersistedFlag('wd:panel:layers:collapsed', false);
  const [historyCollapsed, setHistoryCollapsed] = usePersistedFlag('wd:panel:history:collapsed', false);

  return (
    <>
      <SidebarPanel title={docSelected ? 'Document' : 'Properties'}>
        {docSelected ? (
          <PropertiesGrid>
            <PropertyRow label="file">
              <PropertyTextInput value={filename} placeholder={DEFAULT_FILENAME} onChange={setFilename} />
            </PropertyRow>
            <PropertyRow label="paper">
              <PropertySelect<PaperSizeKey>
                value={paperSize}
                options={[
                  { value: 'letter', label: 'Letter' },
                  { value: 'a4', label: 'A4' },
                  { value: 'legal', label: 'Legal' },
                ]}
                onChange={setPaperSize}
              />
            </PropertyRow>
            <PropertyRow label="bg">
              <PropertyColorInput value={backgroundColor} onChange={setBackgroundColor} />
            </PropertyRow>
          </PropertiesGrid>
        ) : (
          <SelectionPanel
            scene={scene}
            selection={selection}
            // WeaselDraw's kinds come from the kit's inferred routing (`text` /
            // `path` / `image` — no `data.kind` tag), so the panel classifies
            // with the same entries SceneCanvas applies when `routing` is unset.
            properties={inferredNodeProperties}
            routing={inferredNodeRouting}
            renderers={WD_RENDERERS}
            emptyState={<em className="wd-no-selection">No selection</em>}
          />
        )}
      </SidebarPanel>
      <ColorsPanel />
      <SidebarPanel
        title="Layers"
        collapsed={layersCollapsed}
        onToggleCollapse={() => setLayersCollapsed((c) => !c)}
      >
        <LayerList
          {...layerListProps}
          className="wd-layerlist-fill"
          empty={<em style={{ opacity: 0.6 }}>No nodes</em>}
        />
      </SidebarPanel>
      <SidebarPanel
        title="History"
        collapsed={historyCollapsed}
        onToggleCollapse={() => setHistoryCollapsed((c) => !c)}
      >
        <HistoryList
          items={[
            { id: '__initial__', label: 'Initial' },
            ...scene.historyEntries().map((e) => ({ id: e.id, label: e.label })),
          ]}
          currentIndex={scene.historyIndex()}
          onJump={(index) => scene.jumpToHistoryIndex(index)}
        />
      </SidebarPanel>
      <DispatchTracePanel />
    </>
  );
}

/** localStorage-backed boolean state. Reads on mount, writes on every set.
 *  Best-effort — storage errors silently fall back to in-memory state. */
function usePersistedFlag(key: string, initial: boolean): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === '1') return true;
      if (raw === '0') return false;
    } catch { /* ignore */ }
    return initial;
  });
  const set = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        try { localStorage.setItem(key, resolved ? '1' : '0'); } catch { /* ignore */ }
        return resolved;
      });
    },
    [key],
  );
  return [value, set];
}

function ColorsPanel(): ReactElement {
  const colors = useColorContext();
  const actions = useActionsRegistry();
  // Highlight tracks the fill swatch — left-click (the primary action)
  // sets fill. Right-click sets stroke; the active-swatches widget
  // reflects the stroke update. `null` is the transparent ("None")
  // swatch in the first row.
  const current = colors.fill.kind === 'solid' ? colors.fill.color : null;
  return (
    <PropertiesPanel title="Colors">
      <PropertySwatchGrid
        value={current}
        options={PALETTE}
        columns={10}
        onChange={(v) => {
          if (v === null) {
            colors.setFill({ kind: 'none' });
          } else {
            colors.setFill({ kind: 'solid', color: v });
            const ctrl = actions?.begin('setFill', { color: v });
            ctrl?.end('commit');
          }
        }}
        onAltChange={(v) => {
          if (v === null) {
            colors.setStroke({ kind: 'none' });
          } else {
            colors.setStroke({ kind: 'solid', color: v });
            const ctrl = actions?.begin('setStroke', { color: v });
            ctrl?.end('commit');
          }
        }}
      />
    </PropertiesPanel>
  );
}


interface ToolbarProps {
  scene: ReturnType<typeof useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>>;
  selection: ReturnType<typeof useSelection>;
  gridVisible: boolean;
  setGridVisible: (v: boolean) => void;
  snapToGrid: boolean;
  setSnapToGrid: (v: boolean) => void;
  paperSize: PaperSizeKey;
  setPaperSize: (k: PaperSizeKey) => void;
  filename: string;
  backgroundColor: string;
  onOpenPrefs: () => void;
  /** Called at the start of every explicit save/load so stale journal
   *  caches don't survive across document boundaries. */
  onClearJournalCache: () => void;
}

function Toolbar({
  scene, selection,
  gridVisible, setGridVisible,
  snapToGrid, setSnapToGrid,
  paperSize, setPaperSize,
  filename, backgroundColor,
  onOpenPrefs,
  onClearJournalCache,
}: ToolbarProps): ReactElement {
  const registry = useActionsRegistry();
  // Params forward to the action's invoker — parametric actions (reorder's
  // `distance`, tool activation) are unreachable without them.
  const trigger = useCallback((id: string, params?: Record<string, unknown>) => {
    registry?.trigger(id, params);
  }, [registry]);

  const adapter = useSceneAdapter(scene, {});
  const [clipboardEmpty, setClipboardEmpty] = useState(true);
  // `snapshot.items` are adapter-shaped copies (`sceneAdapter.snapshotSelection`),
  // not live scene nodes — but their `id`s are the ORIGINAL scene ids at copy
  // time, and `produceFlavors` runs synchronously inside `clipboard.copy()`,
  // so walking the live `scene` by those ids here is correct: nothing has
  // had a chance to mutate the scene in between. (Verified: `sceneToSvgNodes`
  // skips ids it can't resolve — `kindOf`/`objOf` both fall through to
  // "not found" — rather than throwing, so no id-existence filter is needed
  // even in the shouldn't-happen case.)
  const produceFlavors = useCallback((snapshot: ClipboardSnapshot) => {
    const json = buildWeaselClipboardText(snapshot.items, serializeReplacer);
    const roots = clipboardSnapshotRootIds(
      snapshot.items as Array<{ id: string; parent: string | null }>,
    );
    // The SVG flavors carry `json` embedded in <metadata> too: Chromium's
    // DOM paste event exposes ONLY text/plain, so this is what preserves
    // full fidelity (labels, typed data) on a draw→draw paste.
    const svg = selectionToClipboardSvgString(scene, roots, json);
    return {
      [WEASEL_CLIPBOARD_MIME]: json,
      'image/svg+xml': svg,
      // External design tools sniff text/plain for SVG markup (<metadata>
      // is legal SVG 1.1, ignored by their parsers); the JSON also rides
      // the custom MIME (and cross-tab clipboardData) for lossless paths.
      'text/plain': svg,
    };
  }, [scene]);
  const clipboard = useClipboardOps(adapter, {
    getSelection: () => selection.current as NodeId[],
    onPaste: (ids) => selection.set(ids.map(asNodeId)),
    produceFlavors,
    jsonReplacer: serializeReplacer,
  });
  // Published as the `clipboard` dep so Cmd+C / Cmd+X reach the same object
  // the buttons do — `copy` is wrapped rather than passed raw so the
  // paste-button's disabled state updates on the keyboard route too.
  const clipboardDep = useMemo<ClipboardDep>(() => ({
    copy: () => {
      clipboard.copy();
      setClipboardEmpty(clipboard.isEmpty());
    },
    paste: clipboard.paste,
    isEmpty: clipboard.isEmpty,
  }), [clipboard]);
  useDepSource('clipboard', () => clipboardDep);

  const onPaste = useCallback(() => { clipboard.paste(); }, [clipboard]);

  // Selection-aware z-order: rough "is the top selection at front/back?" guard.
  // Cheap heuristic — only inspects render order length, not per-id position,
  // because the dispatcher's reorder action does the real work.
  const hasSelection = selection.current.length > 0;
  const selectionSize = selection.current.length;
  // Ungroup is only meaningful when a container (group) node is selected.
  const canUngroup = selection.current.some(
    (id) => scene.get(asNodeId(id))?.kind === 'container',
  );

  // Any selected leaf whose path is a polygon with ≥2 `M` commands is a
  // compound path — release explodes it into N independent leaves.
  const canReleaseCompound = (() => {
    for (const id of selection.current) {
      const node = scene.get(asNodeId(id));
      if (!node || node.kind !== 'leaf') continue;
      const path = (node.data as WeaselDrawData).path;
      if (path?.kind !== 'polygon') continue;
      let mCount = 0;
      for (let i = 0; i < path.commands.length; i++) {
        if (path.commands[i] === PATH_M && ++mCount >= 2) return true;
      }
    }
    return false;
  })();

  const onReleaseCompound = useCallback(() => {
    const newIds: NodeId[] = [];
    scene.batch('Release compound path', () => {
      for (const id of selection.current) {
        const nid = asNodeId(id);
        const node = scene.get(nid);
        if (!node || node.kind !== 'leaf') continue;
        const data = node.data as WeaselDrawData;
        const path = data.path;
        if (path?.kind !== 'polygon') {
          newIds.push(nid);
          continue;
        }
        const pose = node.pose as WeaselDrawPose;
        // Bake pose into the parent path so each subpath inherits world
        // coords (including any rotation); otherwise the renderer's
        // "translate path AABB origin to pose.x/y" step would teleport
        // every subpath to the parent's origin and lose the inter-subpath
        // offsets. The resulting subpaths render at rotation=0 since the
        // rotation is now baked into their coords.
        const worldPath = pathInWorld(path, pose);
        if (worldPath.kind !== 'polygon') {
          newIds.push(nid);
          continue;
        }
        const worldParts = splitSubpaths(worldPath);
        if (worldParts.length < 2) {
          newIds.push(nid);
          continue;
        }
        scene.remove(nid);
        for (const sub of worldParts) {
          const b = boundsOfPath(sub);
          const subPose: WeaselDrawPose = {
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
          };
          const subData: WeaselDrawData = { ...data, path: sub };
          newIds.push(scene.add({
            kind: 'leaf',
            layer: 'default',
            pose: subPose,
            data: subData,
          }));
        }
      }
    });
    selection.set(newIds);
  }, [scene, selection]);

  return (
    <>
      <ActionBar
        canUndo={scene.canUndo()}
        canRedo={scene.canRedo()}
        onUndo={() => scene.undo()}
        onRedo={() => scene.redo()}
        hasSelection={hasSelection}
        hasMultiSelection={selectionSize >= 2}
        selectionSize={selectionSize}
        onDelete={() => trigger('delete')}
        onDuplicate={() => trigger('duplicate')}
        onCopy={() => trigger('clipboard.copy')}
        onCut={() => trigger('clipboard.cut')}
        onPaste={onPaste}
        clipboardEmpty={clipboardEmpty}
        onBringForward={() => trigger('reorder.forward', { distance: 'adjacent' })}
        onSendBackward={() => trigger('reorder.backward', { distance: 'adjacent' })}
        // Without the param these fell through to the invoker's 'adjacent'
        // default, so the to-front/to-back buttons only ever moved one step.
        onBringToFront={() => trigger('reorder.forward', { distance: 'extreme' })}
        onSendToBack={() => trigger('reorder.backward', { distance: 'extreme' })}
        canMoveForward={hasSelection}
        canMoveBackward={hasSelection}
        onGroup={() => trigger('group')}
        onUngroup={() => trigger('ungroup')}
        canUngroup={canUngroup}
        onAlign={(edge: AlignEdge) => trigger(`align.${edge}`)}
        onDistribute={(axis: DistributeAxis) => trigger(`distribute.${axis}`)}
        onFlip={(_axis: FlipAxis) => trigger('flip')}
        onSaveSvg={() => {
          onClearJournalCache();
          const paper = PAPER_PRESETS[paperSize];
          const svg = sceneToSvgString(scene, {
            filename,
            paperSize,
            paperWidth: paper.width,
            paperHeight: paper.height,
            backgroundColor,
          });
          const safe = filename.trim() || DEFAULT_FILENAME;
          downloadSvg(svg, /\.svg$/i.test(safe) ? safe : `${safe}.svg`);
        }}
        onOpenSvg={() => {
          // Pop the file picker, parse the chosen SVG, lower its nodes back
          // into the scene-graph. Leaves become `kind: 'leaf'`; SVG groups
          // become `kind: 'container'` and members are reparented under them
          // (nested groups supported — outer groups process after their
          // inner groups are resolved).
          void (async () => {
            const text = await pickSvgFile();
            if (text === null) return;
            onClearJournalCache();
            const parsed = parseSvg(text, { namespaces: SWILL_NAMESPACES });
            for (const w of parsed.warnings) console.warn('[svg import]', w);
            const docPatch = parsedToDoc(parsed);
            if (docPatch.paperSize) setPaperSize(docPatch.paperSize);
            let seq = 0;
            const drafts = svgNodesToSceneDrafts(parsed.nodes, () => `svg-${++seq}`);
            scene.batch('Import SVG', () => {
              // Drafts arrive parent-before-child, so each draft's `parentId`
              // (when set) has already been inserted and mapped. Map the
              // draft's stable id → minted scene NodeId so children resolve
              // their parent.
              const idMap = new Map<string, ReturnType<typeof asNodeId>>();
              for (const draft of drafts) {
                const parent = draft.parentId != null ? idMap.get(draft.parentId) : undefined;
                if (draft.kind === 'container') {
                  // Container pose = AABB of descendants (computed by the
                  // importer), matching the kit `group` action's convention.
                  const sceneId = scene.add({
                    kind: 'container',
                    layer: 'default',
                    pose: draft.pose,
                    data: {},
                    ...(parent != null ? { parent } : {}),
                  });
                  idMap.set(draft.id, sceneId);
                  continue;
                }
                const o = draft.obj;
                const pose: WeaselDrawPose = { x: o.x, y: o.y, width: o.width, height: o.height };
                if (o.rotation) pose.rotation = o.rotation;
                const textFill = o.tool === 'text' && o.style?.fill && (o.style.fill.fill === 'solid' || o.style.fill.fill === undefined)
                  ? o.style.fill.color
                  : undefined;
                // `style` carries the typography the painter reads —
                // size, family, and the stroke. Dropping it imported every
                // `<text>` as default-black 16px, however it was written.
                // `data.fill` stays alongside it for the layer-row swatch,
                // which reads the leaf field first.
                const data: WeaselDrawData = o.tool === 'text'
                  ? {
                      text: o.text,
                      fill: textFill ?? '#000000',
                      ...(o.style ? { style: o.style } : {}),
                    }
                  : { path: o.path, fill: o.fill, stroke: o.stroke, strokeWidth: o.strokeWidth };
                const sceneId = scene.add({
                  kind: 'leaf',
                  layer: 'default',
                  pose,
                  data,
                  ...(parent != null ? { parent } : {}),
                });
                idMap.set(draft.id, sceneId);
              }
            });
          })();
        }}
        onNew={(size) => {
          setPaperSize(size);
          // Wipe everything — `scene.batch` keeps it undoable.
          scene.batch('New document', () => {
            for (const id of [...scene.renderOrder()]) scene.remove(id);
          });
        }}
        gridVisible={gridVisible}
        onToggleGrid={() => setGridVisible(!gridVisible)}
        snapToGrid={snapToGrid}
        onToggleSnap={() => setSnapToGrid(!snapToGrid)}
        canReleaseCompound={canReleaseCompound}
        onReleaseCompound={onReleaseCompound}
        onOpenPrefs={onOpenPrefs}
        recording={false}
        onToggleRecord={() => {/* v0: recording deferred */}}
        recordingProfile={'gesture-only' as RecordingProfile}
        onChangeRecordingProfile={() => {/* v0: recording deferred */}}
        onPlay={() => {/* v0: recording deferred */}}
      />
    </>
  );
}

// ─── Modality helpers ────────────────────────────────────────────────────────

/** Subscribe to the mode registry and return the current mode id reactively. */
function useModeId(machine: ModeMachine): string {
  const [id, setId] = useState(machine.registry.current().id);
  useEffect(() => {
    return machine.registry.subscribe(() => setId(machine.registry.current().id));
  }, [machine]);
  return id;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Restore the persisted scene (if any) from localStorage. Returns the
 *  initial node list shaped for `useScene`'s full-form call signature.
 *  Rebuilds the FULL tree (containers + parent links + layers) via
 *  `nodeSpecsFromSnapshot`, so Cmd+G groups and nesting survive a reload.
 *  Best-effort — any parse error yields a fresh starter scene with one
 *  example rectangle so the canvas isn't empty on first run. */
function loadInitial(): AddNodeSpec<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const json = JSON.parse(raw) as SerializedScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;
      if (json && json.version === 1 && Array.isArray(json.nodes)) {
        return nodeSpecsFromSnapshot(json);
      }
    }
  } catch {
    // fall through to starter
  }
  return [{
    kind: 'leaf' as const,
    layer: 'default' as WeaselDrawLayer,
    pose: { x: 80, y: 80, width: 160, height: 100 },
    data: {
      path: rectPath(80, 80, 160, 100),
      fill: '#7ab8d4',
      stroke: '#0a3654',
      strokeWidth: 2,
      label: 'Welcome',
    },
    id: asNodeId('starter-1'),
  }];
}

/** Read the persisted undo/redo history snapshot, reviving the typed arrays
 *  inside its serialized op payloads (poses/paths carry Float32Array coords).
 *  Best-effort — returns null on absent/corrupt data or a version mismatch,
 *  in which case the app starts with an empty undo stack. */
function loadHistory(): SerializedHistory | null {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as SerializedHistory;
    if (snap && snap.version === 1) return reviveTypedArrays(snap);
  } catch {
    // fall through to no-history
  }
  return null;
}

const SCENE_HISTORY_KEY = 'weaseldraw:scene-history-v1';

/** Read the persisted SCENE undo/redo snapshot (the scene's own history
 *  engine, distinct from the modality history above). Best-effort; on
 *  absent/corrupt/mismatched data returns null AND removes the key so a
 *  broken snapshot can't wedge every boot. */
function loadSceneHistory(): SerializedHistory | null {
  try {
    const raw = localStorage.getItem(SCENE_HISTORY_KEY);
    if (raw) {
      const snap = JSON.parse(raw) as SerializedHistory;
      if (snap && snap.version === 1) return reviveTypedArrays(snap);
    }
  } catch {
    // fall through to wipe
  }
  try { localStorage.removeItem(SCENE_HISTORY_KEY); } catch { /* best-effort */ }
  return null;
}

// ─── Outer App: install the color context so swatches + actions resolve ─────

/** Publishes a `BooleansAdapter` as a dep so the kit's Pathfinder
 *  descriptors can read selection and execute boolean ops on WeaselDraw nodes.
 *  Must live inside `<SceneCanvas>` since `useBooleansAdapter` calls
 *  `useDepSource`, which requires the surrounding `<DepRegistryProvider>`. */
function BooleansAdapterPublisher({
  scene,
  selection,
}: {
  scene: ReturnType<typeof useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>>;
  selection: ReturnType<typeof useSelection>;
}): null {
  const idCounterRef = useRef(0);
  const adapter = useMemo<BooleansAdapter>(() => {
    const a: BooleansAdapter = {
      getSelection: () => selection.get(),
      getWorldPath: (id) => {
        const node = scene.get(asNodeId(id));
        if (!node || node.kind !== 'leaf') return undefined;
        const data = node.data;
        if (!data.path) return undefined;
        return pathInWorld(data.path, node.pose);
      },
      compareZ: (x, y) => {
        const order = [...scene.renderOrder()];
        return order.indexOf(asNodeId(x)) - order.indexOf(asNodeId(y));
      },
      createPathNode: (path) => {
        // Mint convention: pose = boundsOfPath(path); geometry lives in data.path.
        // Booleans, slice (sliceCommit.ts), and release-compound (onReleaseCompound)
        // all follow this same convention — the data payload that varies per site
        // is too context-specific (style inheritance source) to share a helper.
        // Inherit the topmost selected leaf's paint so the result reads as a
        // continuation of the source style. Falls back to a neutral fill if
        // no leaf is selected (shouldn't happen — `enabled` gates the op).
        const sel = selection.get();
        let template: WeaselDrawData | undefined;
        for (let i = sel.length - 1; i >= 0; i--) {
          const n = scene.get(asNodeId(sel[i]));
          if (n && n.kind === 'leaf') { template = n.data; break; }
        }
        const b = boundsOfPath(path);
        const id = `b-${idCounterRef.current++}`;
        const node: { id: string; kind: 'leaf'; layer: WeaselDrawLayer; pose: WeaselDrawPose; data: WeaselDrawData; parent: NodeId | null } = {
          id,
          kind: 'leaf',
          layer: 'default',
          pose: { x: b.x, y: b.y, width: b.width, height: b.height },
          data: {
            path,
            fill: template?.fill ?? '#888',
            ...(template?.stroke !== undefined ? { stroke: template.stroke } : {}),
            ...(template?.strokeWidth !== undefined ? { strokeWidth: template.strokeWidth } : {}),
          },
          parent: null,
        };
        return node;
      },
      getNode: (id) => {
        const n = scene.get(asNodeId(id));
        return n ?? undefined;
      },
      getZOrder: (id) => {
        const order = [...scene.renderOrder()];
        const idx = order.indexOf(asNodeId(id));
        if (idx < 0) return undefined;
        const node = scene.get(asNodeId(id));
        return { parentId: node?.parent ?? null, index: idx };
      },
      setSelection: (ids) => selection.set(ids),
      insertNode: (node, index?: number) => {
        const n = node as { id: string; kind: 'leaf' | 'container'; layer: WeaselDrawLayer; pose: WeaselDrawPose; data: WeaselDrawData; parent?: NodeId | null };
        scene.add({
          kind: n.kind,
          layer: n.layer,
          pose: n.pose,
          data: n.data,
          id: asNodeId(n.id),
          ...(index !== undefined ? { index } : {}),
          ...(n.parent != null ? { parent: n.parent } : {}),
        });
      },
      removeNode: (id) => { scene.remove(asNodeId(id)); },
      // Hand the batch to the scene rather than re-applying it here: the
      // entry then holds the real ops, so undo replays the reorder and the
      // selection change instead of only the inserts and deletes.
      applyOps: (ops, label) => {
        scene.applyBatch(ops, label ?? 'Booleans', { ...defaultCommitAdapter(scene), ...a });
      },
    };
    return a;
  }, [scene, selection]);
  useBooleansAdapter(adapter);
  return null;
}

export function App(): ReactElement {
  const scene = useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: [{ id: 'default' }],
    initial: useMemo(loadInitial, []),
  });
  const selection = useSelection({ mode: 'multi', scene });

  // Bootstrap the mode machine, decorations, and scoping dim. useModality
  // wires the journal accessor on the scene via
  // `scene.setActiveJournalAccessor` once the machine is constructed —
  // no ref dance needed at this layer.
  const modality = useModality(
    scene as unknown as import('@weasel-js/core').Scene<unknown, string, unknown>,
  );

  // Restored external-op history entries (nudges, drags, action commits)
  // replay against this adapter after a reload. `defaultCommitAdapter` is the
  // same scene-backed adapter the default actions bind at live commit time —
  // it carries the scene-owned op-apply surface, where the canvas adapter
  // lacks `setData` and `setLayer` (a restored nudge's geometry-projection
  // setData op would fail against it). Lazy accessor: wiring order vs the
  // boot-time restoreHistory doesn't matter.
  useEffect(() => {
    const a = defaultCommitAdapter(scene);
    scene.setHistoryAdapter(() => a);
    return () => scene.setHistoryAdapter(null);
  }, [scene]);

  // Restore the persisted undo stacks once on mount (modality history, then
  // the scene's own history). Scene state is already in place — it's restored
  // synchronously at scene construction via `initial: loadInitial()` — so the
  // restored entries' inverts land on the correct adapter state. `restoredRef`
  // then unblocks the persist effect so it can't clobber the saved history
  // with the empty initial stack first.
  const restoredRef = useRef(false);
  useEffect(() => {
    const snap = loadHistory();
    if (snap) modality.history.restore(snap);
    const sceneSnap = loadSceneHistory();
    if (sceneSnap) {
      try {
        scene.restoreHistory(sceneSnap);
      } catch {
        // A parseable-but-malformed snapshot must not wedge every boot:
        // drop it and start with an empty undo stack.
        try { localStorage.removeItem(SCENE_HISTORY_KEY); } catch { /* best-effort */ }
      }
    }
    restoredRef.current = true;
    // Run once; scene/modality are stable for the app lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every commit. The 300ms debounce coalesces drag bursts so
  // we hit localStorage at most a few times per second. Scene and history go
  // under separate keys (mirroring the doc key) so a shape migration of one
  // never disturbs the other.
  useEffect(() => {
    const id = setTimeout(() => {
      if (!restoredRef.current) return;
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(scene.toJSON(), serializeReplacer));
        localStorage.setItem(HISTORY_KEY, JSON.stringify(modality.history.serialize(), serializeReplacer));
        localStorage.setItem(SCENE_HISTORY_KEY, JSON.stringify(scene.serializeHistory(), serializeReplacer));
      } catch {
        // Persistence is best-effort.
      }
    }, 300);
    return () => clearTimeout(id);
  });

  const initialFill: ActivePaint = { kind: 'solid', color: INITIAL_FILL_COLOR };
  const initialStroke: ActivePaint = { kind: 'solid', color: DEFAULT_STROKE_COLOR };

  return (
    <ColorContextProvider
      initialFill={initialFill}
      initialStroke={initialStroke}
    >
      <EditorWithSharedScene scene={scene} selection={selection} modality={modality} />
    </ColorContextProvider>
  );
}

// ─── Editor variant that consumes the lifted scene/selection ────────────────

function EditorWithSharedScene({
  scene,
  selection,
  modality,
}: {
  scene: ReturnType<typeof useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>>;
  selection: ReturnType<typeof useSelection>;
  modality: ReturnType<typeof useModality>;
}): ReactElement {
  const [tools, setTools] = useState<ToolsApi | null>(null);
  const actionsReg = useActionsRegistry();
  const [paperSize, setPaperSize] = useState<PaperSizeKey>('letter');
  const [gridVisible, setGridVisible] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  // Right-sidebar width. The pref is the durable value; `dragWidth` shadows it
  // for the duration of a drag so a pointer-rate stream of samples doesn't
  // schedule a prefs write per frame. Cleared on commit, which hands ownership
  // back to the pref in the same render.
  const [prefWidth, setPrefWidth] = usePref('ui.rightSidebarWidth');
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  // Machine-font outlines. The switch is the user gesture the permission
  // prompt needs; on a later load the pref is already on and, with permission
  // granted, `queryLocalFonts` resolves without prompting again.
  const [machineOutlines, setMachineOutlines] = usePref('text.machineFontOutlines');
  useEffect(() => {
    if (!machineOutlines) {
      disableMachineFontOutlines();
      return;
    }
    void enableMachineFontOutlines().catch((err: unknown) => {
      // A refusal is the user's answer, so put the switch back to match it.
      // Anything else — no API in this browser, a transient failure — leaves
      // the preference alone: it is a standing wish that costs nothing to
      // keep, and flipping it off would make the user re-express it on a
      // browser that might support this next time.
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setMachineOutlines(false);
        return;
      }
      console.warn('WeaselDraw: machine-font outlines unavailable —', err);
    });
  }, [machineOutlines, setMachineOutlines]);
  const rightWidth = dragWidth ?? prefWidth;
  const commitRightWidth = useCallback((next: number) => {
    setPrefWidth(next);
    setDragWidth(null);
  }, [setPrefWidth]);

  // Document-level state (filename + background color) persisted alongside
  // the scene under a separate LS key so a doc-shape migration doesn't
  // have to touch the scene snapshot.
  const initialDoc = useMemo(loadDoc, []);
  const [filename, setFilename] = useState<string>(initialDoc.filename);
  const [backgroundColor, setBackgroundColor] = useState<string>(initialDoc.backgroundColor);
  const [docSelected, setDocSelected] = useState<boolean>(false);

  // Doc-target selection is mutually exclusive with scene-node selection.
  // Whenever the kit selection becomes non-empty, drop the doc-target flag
  // so the Properties panel reverts to node properties.
  const selectionCount = selection.current.length;
  useEffect(() => {
    if (selectionCount > 0 && docSelected) setDocSelected(false);
  }, [selectionCount, docSelected]);

  // Persist filename + bg color with the same 300ms debounce as the scene.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DOC_KEY, JSON.stringify({ filename, backgroundColor }));
      } catch { /* best-effort */ }
    }, 300);
    return () => clearTimeout(id);
  }, [filename, backgroundColor]);

  // ── Mode id + breadcrumb state ────────────────────────────────────────────
  const modeId = useModeId(modality.machine);

  // ── Alt-held tracking for path-edit cursor stub ──────────────────────────
  // When path-edit is active and Alt is held, data-alt-held="true" on the
  // host drives a `cursor: copy` rule — visual stub for the future
  // add-anchor sub-tool. No hit-test gating (that's the sub-tool's job).
  // Listener only registers while mode is path-edit to avoid leaking into
  // other modes.
  const [altHeld, setAltHeld] = useState(false);
  useEffect(() => {
    if (modeId !== 'path-edit') {
      setAltHeld(false);
      return;
    }
    const onDown = (e: KeyboardEvent): void => { if (e.key === 'Alt') setAltHeld(true); };
    const onUp   = (e: KeyboardEvent): void => { if (e.key === 'Alt') setAltHeld(false); };
    const onBlur = (): void => setAltHeld(false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    window.addEventListener('blur',    onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup',   onUp);
      window.removeEventListener('blur',    onBlur);
    };
  }, [modeId]);
  // Re-read on every render; `modeId` changing is what re-renders us, and the
  // resolved id is a tighter memo key than the mode it came from.
  const activeTargetId = modality.machine.getActiveTargetId();
  const targetLabel = useMemo(() => {
    const tid = activeTargetId;
    if (!tid) return null;
    // Look up the node's display label from scene data; fall back to the id.
    const node = scene.get(asNodeId(tid));
    if (node) {
      const data = node.data as WeaselDrawData;
      return data.label ?? data.text ?? tid;
    }
    return tid;
  }, [activeTargetId, scene]);

  // ── Modality keyboard handler ─────────────────────────────────────────────
  // Runs at capture phase so it intercepts Escape before the kit's
  // useKeybindings handler (which returns to the default tool). When the
  // mode is 'normal' we early-return and let the kit's handler run as usual.
  useEffect(() => {
    const { machine } = modality;
    function onKey(e: KeyboardEvent): void {
      const mode = machine.registry.current();
      // Only intercept when a non-normal mode is active.
      if (mode.id === 'normal') return;

      if (e.key === 'Escape') {
        if (e.metaKey && mode.kind === 'soft') {
          machine.discardMode();
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        if (mode.kind === 'soft') machine.exitMode();
        else machine.cancelMode();
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      if (e.key === 'Enter' && mode.kind === 'strict') {
        machine.commitMode();
        e.stopPropagation();
        e.preventDefault();
      }
    }
    // Capture phase: fires before bubble phase so we beat useKeybindings'
    // document-level bubble handler when a mode is active.
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [modality]);

  // ── Modality SceneCanvas callbacks ────────────────────────────────────────
  const onDoubleClick = useCallback((hit: SceneCanvasHit | null) => {
    dispatchDoubleClickEntry(hit, modality.machine);
  }, [modality.machine]);

  const getActiveMode = useCallback((): { id: string; allowedCapabilities: ReadonlySet<string> } => {
    const mode = modality.machine.registry.current();
    const allowed = new Set<string>([...mode.allows, ...IMPLICIT_TAGS]);
    return { id: mode.id, allowedCapabilities: allowed };
  }, [modality.machine]);

  // TODO(modality): wire non-normal-mode background-click composition
  // (text-edit commit, isolation scoped-clear) through `handleBackgroundClick`
  // from `./modality` once we have a non-leaky hook into the dispatcher.
  // SceneCanvas's `onBackgroundClick` prop is intentionally omitted because
  // it would race with the gesture-dispatcher channel (marquee, lasso). For
  // normal mode the select tool's `clearSelection` action already handles
  // background clicks; soft modes exit via Esc and strict modes via the
  // breadcrumb's commit/cancel buttons in the interim.

  const paper = PAPER_PRESETS[paperSize];

  // Workspace host: the canvas fills the entire `.wd-canvas-host` area
  // (diagonal stripes); the document page is drawn as a world-space layer.
  // Track host CSS dims so we can size the canvas + fit the page on mount /
  // paper-size change.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hostDims, setHostDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setHostDims({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lifted view state (controlled SceneCanvas). Refit-to-page runs on initial
  // host-dims sample and on every paperSize change; we deliberately do NOT
  // refit on subsequent host resizes — that would hijack the user's pan/zoom.
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  const lastFitPaperRef = useRef<PaperSizeKey | null>(null);
  // Stable recenter thunk wired into SceneCanvas.viewport.recenter so Cmd-0
  // refits the page into the workspace. Reads live host dims + paper size
  // through refs so the callback identity stays constant for SceneCanvas.
  const hostDimsRef = useRef(hostDims);
  hostDimsRef.current = hostDims;
  const paperRef = useRef(paper);
  paperRef.current = paper;
  const recenter = useCallback(() => {
    const dims = hostDimsRef.current;
    if (dims.width === 0 || dims.height === 0) return;
    const p = paperRef.current;
    setView(fitViewToBounds(
      { x: 0, y: 0, width: p.width, height: p.height },
      dims,
      { x: 0, y: 0, scale: { x: 1, y: 1 } },
      { padding: 24 },
    ));
  }, []);
  useEffect(() => {
    if (hostDims.width === 0 || hostDims.height === 0) return;
    if (lastFitPaperRef.current === paperSize) return;
    lastFitPaperRef.current = paperSize;
    recenter();
  }, [paperSize, hostDims.width, hostDims.height, paper.width, paper.height, recenter]);

  // Document-page layer — a single world-space rect at {0,0,paper.width,paper.height}
  // filled with the doc's backgroundColor. Replaces the kit-level backgroundFill
  // (which painted the entire canvas), so the workspace stripes show everywhere
  // outside the page.
  const paperLayer = useMemo<RenderLayer<unknown>>(() => ({
    id: 'paper',
    label: 'Paper',
    // World-space commands; drawLayers wraps in viewToMat3 automatically.
    draw: () => [{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: paper.width, height: paper.height },
      fill: { fill: 'solid', color: backgroundColor },
    }],
  }), [paper.width, paper.height, backgroundColor]);

  // What the loupe magnifies: the page and the scene on top of it, the same
  // two the canvas paints. Screen space with a self-applied view —
  // `createViewportLayer` hands source layers its inner view and applies no
  // transform of its own, so a world-space layer would come out unmagnified.
  const loupeSource = useMemo<RenderLayer<unknown>[]>(() => [
    {
      id: 'loupe-paper',
      label: 'Loupe paper',
      space: 'screen',
      draw: (data, v, dims) => [{
        kind: 'group',
        transform: viewToMat3(v),
        children: paperLayer.draw(data, v, dims),
      }],
    },
    {
      id: 'loupe-scene',
      label: 'Loupe scene',
      space: 'screen',
      draw: (_data, v) => buildSceneViewCommands(scene, v, (node, pose) => defaultDrawOne(node, pose)),
    },
  ], [paperLayer, scene]);

  const hudTool = useHudContribution();
  const hudAmbient = useMemo(() => [hudTool], [hudTool]);

  // `useHud` and `createLoupe` both read the canvas handle in a mount effect
  // and neither retries, so the loupe chrome can only mount once the handle
  // exists — which is a render later than this component's first, because
  // `<SceneCanvas>` waits on the host's measured size.
  const canvasRef = useRef<SceneCanvasApi | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const attachCanvas = useCallback((api: SceneCanvasApi | null) => {
    canvasRef.current = api;
    setCanvasReady(api !== null);
  }, []);

  const sliceTool = useSliceTool();

  // ── In-place text editing ─────────────────────────────────────────────────
  // The contenteditable overlay lives inside `.wd-canvas-host` (the workspace),
  // which is the positioning context it needs. `view` is passed so the overlay
  // tracks pan/zoom: it is placed at the node's projected screen origin and
  // CSS-scaled by the view, keeping every metric on it — including run-level
  // font size and tracking — in the same world units the canvas draws in.
  //
  // `hostRef.current` is null on the first render and populated by the time
  // the ResizeObserver's first sample re-renders (which is also when the
  // canvas mounts), so the overlay always has a container before an edit can
  // start.
  const textEdit = useSceneTextEdit(scene, hostRef.current, {
    view,
    // Clicking into the character bar must not end the edit it is editing.
    // The bar's dropdowns render in a portal under <body>, so they are not in
    // the bar's subtree and `closest` alone misses them — picking a font
    // ended the session, and the style patch then landed on nothing. Kit
    // overlays carry `data-weasel-overlay` for exactly this question.
    isEditorChrome: (el) =>
      el.closest(`.${TEXT_CHROME_CLASS}`) !== null
      || el.closest('[data-weasel-overlay]') !== null,
  });

  // Keep the mode and the edit session in lockstep. The session can end
  // several ways — click-away commit, Escape, the node going away — and only
  // some of them run through the machine. Without this the breadcrumb kept
  // claiming `text-edit` after the editor was gone, which is the same
  // mode-vs-session split that left double-click with no editor at all.
  //
  // Keyed on the session *ending* (a non-null id going null), not on the
  // steady state "mode on, no session": the machine and `startEdit` are
  // driven by the same double-click but publish through different
  // subscriptions, so there is a render in between where the mode is live and
  // the session isn't. Reading that as "finished" exits the mode the instant
  // it's entered.
  const prevEditingIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevEditingIdRef.current;
    prevEditingIdRef.current = textEdit.editingId;
    if (prev == null || textEdit.editingId != null) return;
    if (modeId === 'text-edit') modality.machine.exitMode();

    // An edit that ends with no text leaves a node that paints nothing and
    // still picks: a full-size invisible rectangle over the canvas, which is
    // most of why text picking felt haunted. Every editor discards an empty
    // text box on commit; so do we, and as a history entry so it's undoable.
    const nid = asNodeId(prev);
    const node = scene.get(nid);
    if (node && node.kind === 'leaf') {
      const data = node.data as WeaselDrawData;
      const isTextNode = data.text !== undefined;
      const hasRuns = Array.isArray(data.runs) && data.runs.length > 0;
      if (isTextNode && data.text === '' && !hasRuns) {
        scene.batch('Discard empty text', () => { scene.remove(nid); });
      }
    }
  }, [modeId, textEdit.editingId, modality.machine, scene]);

  // ...and the same seam from the other side. The modality key handler
  // intercepts Escape at capture phase and stops propagation, so the kit's
  // own Escape (which would cancel the edit) never fires — the mode ended
  // while a live editor stayed mounted over the canvas, swallowing
  // keystrokes into nothing.
  //
  // This commits rather than cancels: Escape out of a text edit keeps the
  // text in every comparable editor, and losing a paragraph to a stray key
  // is the worse failure. The kit's bare `cancelEdit` still discards — only
  // this app-level route changed. Flip to `textEdit.cancelEdit()` if Escape
  // should discard here too.
  const prevModeIdRef = useRef<string>(modeId);
  useEffect(() => {
    const prev = prevModeIdRef.current;
    prevModeIdRef.current = modeId;
    if (prev === 'text-edit' && modeId !== 'text-edit' && textEdit.editingId != null) {
      textEdit.commit();
    }
  }, [modeId, textEdit]);

  // What the options bar displays and where its edits go. A real range styles
  // the runs under it; a collapsed caret has no range, so the same controls
  // edit the node's own `TextStyle` — the values the sidebar shows.
  const editingNodeStyle = textEdit.editingId != null
    ? scene.get(asNodeId(textEdit.editingId))?.data.style
    : undefined;
  const hasRange = textEdit.selection != null && textEdit.selection.start !== textEdit.selection.end;
  const barStyle: RangeStyle = effectiveRangeStyle(
    hasRange ? textEdit.rangeStyle : null,
    editingNodeStyle,
  );

  const onCharacterPatch = useCallback((patch: RunStylePatch) => {
    const id = textEdit.editingId;
    if (id == null) return;
    const sel = textEdit.selection;
    if (sel != null && sel.start !== sel.end) {
      textEdit.applyStyleToSelection(patch);
      return;
    }
    const nid = asNodeId(id);
    const node = scene.get(nid);
    if (!node) return;
    scene.update(nid, {
      data: { ...node.data, style: { ...node.data.style, ...textStyleFromPatch(patch) } },
    });
  }, [textEdit, scene]);

  // The overlay draws the node being edited, so the scene layer must not draw
  // it too — otherwise every keystroke shows against the pre-edit glyphs.
  // Composed over the modality scoping dim rather than replacing it: both are
  // per-node alpha, and an isolation-dimmed node can also be the one editing.
  const scopingAlphaFor = modality.scopingDim.alphaFor;
  const editingId = textEdit.editingId;
  const alphaFor = useCallback(
    (id: string) => (id === editingId ? 0 : scopingAlphaFor(id)),
    [editingId, scopingAlphaFor],
  );

  const { percent: opacityScrubPercent } = useOpacityScrub({
    scene: scene as unknown as Parameters<typeof useOpacityScrub>[0]['scene'],
    selection,
    hostRef,
  });

  // Mode-tint layer — screen-space wash over the workspace area surrounding
  // the page, leaving the page itself uncovered. Reads the active mode's
  // `workspace.tint` from the modality registry on every paint; emits
  // nothing when the active mode has no tint (normal). The "punch a hole
  // around the page" pattern is four screen-space rects (top / bottom /
  // left / right of the page rect's screen-space projection). Each strip
  // carries a linear gradient that fades from full tint at the outer
  // canvas edge to transparent at the page edge.
  const TINT_ALPHA = 0.4; // bolder than the spec's 0.12 default so the
                          // tint reads clearly through stripe background.
  const workspaceTintLayer = useMemo<RenderLayer<unknown>>(() => ({
    id: 'mode-tint',
    label: 'Mode tint',
    space: 'screen',
    draw: (_data, view, dims) => {
      const tint = modality.machine.registry.current().workspace?.tint;
      if (!tint || tint === 'transparent') return [];

      // Project the page rect (world (0,0)→(paper.w,paper.h)) into screen.
      const t = viewToTransform(view);
      const [sx0, sy0] = worldToScreen(0, 0, t);
      const [sx1, sy1] = worldToScreen(paper.width, paper.height, t);
      const px = Math.min(sx0, sx1);
      const py = Math.min(sy0, sy1);
      const pw = Math.abs(sx1 - sx0);
      const ph = Math.abs(sy1 - sy0);

      // Clamp the page rect to the canvas dims so the surrounding rects
      // don't have negative dimensions when the page is fully off-screen.
      const pl = Math.max(0, px);
      const pt = Math.max(0, py);
      const pr = Math.min(dims.width, px + pw);
      const pb = Math.min(dims.height, py + ph);

      const fadeStops = [
        { offset: 0, color: tint },
        { offset: 1, color: 'transparent' },
      ];
      const solid = { fill: 'solid' as const, color: tint, opacity: TINT_ALPHA };

      // If the page is entirely outside the canvas, tint the whole viewport
      // with solid fill (no edge to fade toward).
      if (pr <= pl || pb <= pt) {
        return [
          { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: dims.width, height: dims.height },
            fill: solid },
        ];
      }

      // Four surround rects, each with a linear gradient fading from the
      // outer canvas edge (full tint) to the adjacent page edge (transparent).
      const cmds: DrawCommand[] = [];
      const pushFade = (
        x: number, y: number, w: number, h: number,
        from: { x: number; y: number }, to: { x: number; y: number },
      ): void => {
        if (w <= 0 || h <= 0) return;
        cmds.push({
          kind: 'path',
          path: { kind: 'rect', x, y, width: w, height: h },
          fill: {
            fill: 'linear-gradient',
            from,
            to,
            stops: fadeStops,
            opacity: TINT_ALPHA,
          },
        });
      };
      // top: full → transparent going downward toward the page top
      pushFade(0, 0, dims.width, pt, { x: 0, y: 0 }, { x: 0, y: pt });
      // bottom: full → transparent going upward toward the page bottom
      pushFade(0, pb, dims.width, dims.height - pb, { x: 0, y: dims.height }, { x: 0, y: pb });
      // left: full → transparent going rightward toward the page left edge
      pushFade(0, pt, pl, pb - pt, { x: 0, y: 0 }, { x: pl, y: 0 });
      // right: full → transparent going leftward toward the page right edge
      pushFade(pr, pt, dims.width - pr, pb - pt, { x: dims.width, y: 0 }, { x: pr, y: 0 });
      return cmds;
    },
  }), [modality.machine, paper.width, paper.height]);

  return (
    <ActiveToolContextProvider>
    <div className="wd-app">
      <Toolbar
        scene={scene}
        selection={selection}
        gridVisible={gridVisible}
        setGridVisible={setGridVisible}
        snapToGrid={snapToGrid}
        setSnapToGrid={setSnapToGrid}
        paperSize={paperSize}
        setPaperSize={setPaperSize}
        filename={filename}
        backgroundColor={backgroundColor}
        onOpenPrefs={() => setPrefsOpen(true)}
        onClearJournalCache={() => modality.machine.clearJournalCache()}
      />
      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
      {/* Permanently reserved, never mounted on demand: the canvas is sized
          to the workspace, so appearing mid-edit would resize it under the
          caret. Empty until a text edit is in progress. */}
      <ToolOptionsBar
        className={TEXT_CHROME_CLASS}
        label={textEdit.editingId != null ? 'Text' : undefined}
      >
        {textEdit.editingId != null && (
          <CharacterOptions style={barStyle} onPatch={onCharacterPatch} />
        )}
        {canvasReady && (
          <LoupeControls canvasRef={canvasRef} source={loupeSource} />
        )}
      </ToolOptionsBar>
      <div className="wd-body">
        <Sidebar side="left" className="wd-sidebar left" ariaLabel="Tools">
          {tools && (
            <ToolPalette
              tools={tools}
              orientation="vertical"
              lookupShortcut={(id) => lookupShortcutByToolId(id, actionsReg?.list() ?? [])}
              modeRegistry={modality.machine.registry}
            />
          )}
          <ActiveSwatches />
        </Sidebar>
        {/* Two things have to happen on a double-click into text, and they
            come from different places: `onDoubleClick` on SceneCanvas drives
            the modality machine into `text-edit` (breadcrumb, scoping dim),
            while the kit's own handler starts the edit *session* that mounts
            the contenteditable overlay and seeds the caret at the clicked
            glyph. Binding only the first flipped the mode with no editor
            under it — the node looked selected and refused to take a
            keystroke. */}
        <div
          className="wd-canvas-host"
          ref={hostRef}
          onDoubleClick={textEdit.onDoubleClick}
          data-mode={modeId}
          data-alt-held={altHeld ? 'true' : undefined}
        >
          <OpacityHud percent={opacityScrubPercent} />
          <ModeBreadcrumb
            modeId={modeId}
            modeKind={modality.machine.registry.current().kind}
            targetLabel={targetLabel}
            onExit={() => modality.machine.exitMode()}
            onCommit={() => modality.machine.commitMode()}
            onCancel={() => modality.machine.cancelMode()}
          />
          {hostDims.width > 0 && hostDims.height > 0 && (
          <SceneCanvas<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>
            ref={attachCanvas}
            ambient={hudAmbient}
            width={hostDims.width}
            height={hostDims.height}
            view={view}
            onViewChange={setView}
            scene={scene}
            selection={selection}
            selectionMode="multi"
            toolBundle="exhaustive"
            tools={{ slice: sliceTool }}
            actions={{ slice: sliceAction }}
            ingestion={DRAW_INGESTION}
            // Pick on the drawn shape, not the bounding box. In a drawing app
            // the pose rect is an implementation detail: clicking the blank
            // right half of a text box, or the notch of a star, should reach
            // whatever is behind it — which is what every other editor does.
            geometry={{ picking: 'shape' }}
            viewport={{ pinchZoom: true, recenter }}
            cursorCoordsHud
            pickHud
            modalityHud
            onToolsCreated={setTools}
            selectTool={snapToGrid ? { snap: gridSnapStrategy<WeaselDrawPose>(20) } : undefined}
            toolOptions={snapToGrid ? {
              snapPoint: (p) => ({
                x: Math.round(p.x / 20) * 20,
                y: Math.round(p.y / 20) * 20,
              }),
            } : undefined}
            layers={{
              paper: { layer: paperLayer, before: 'grid' },
              ...(gridVisible ? {
                grid: {
                  spacing: 20,
                  bounds: () => ({ x: 0, y: 0, width: paper.width, height: paper.height }),
                  accentEvery: 5,
                  style: {
                    line:   { paint: { fill: 'solid', color: 'rgba(0, 0, 0, 0.08)' }, width: 1 },
                    accent: { paint: { fill: 'solid', color: 'rgba(0, 0, 0, 0.18)' }, width: 1 },
                  },
                },
              } : {}),
              // Mode tint sits above scene/grid but doesn't paint over the
              // page rect — see workspaceTintLayer above.
              modeTint: { layer: workspaceTintLayer, after: 'grid' },
              // Selection overlay: corner-resize handles only. Rotation
              // chrome is now an invisible elliptical ring around the
              // selection AABB (the affordance in
              // `src/affordances/rotationHandle.ts`) — hover the band
              // outside the corners and the cursor becomes `'grab'`;
              // hovering a corner shows the matching diagonal resize
              // cursor. Both come from the kit's hover-cursor pump
              // (`AffordanceHit.cursor`), no wiring here.
              // The selection-overlay's `rotationHandle: true` option
              // would paint the legacy small-dot handle; we deliberately
              // skip it.
              selectionOverlay: { handles: { size: 8 } },
            }}
            decorationLayer={modality.decorationLayer}
            alphaFor={alphaFor}
            isPointerInteractive={modality.scopingDim.isPointerInteractive}
            onDoubleClick={onDoubleClick}
            getActiveMode={getActiveMode}
            geometryProjection={{
              transform: (node, m) => {
                const data = node.data as WeaselDrawData;
                if (!data.path) return null; // text / no geometry — kit leaves data alone
                return { ...data, path: transformPath(data.path, m) };
              },
            }}
          >
            <BooleansAdapterPublisher scene={scene} selection={selection} />
            <SliceDepPublisher scene={scene} selection={selection} />
            <TextEditDepPublisher
              edit={textEdit}
              scene={scene as unknown as Scene<unknown, string, unknown>}
            />
          </SceneCanvas>
          )}
          <SelectedGradientHandles
            scene={scene}
            selection={selection}
            view={view}
            width={hostDims.width}
            height={hostDims.height}
          />
        </div>
        <ResizeHandle
          value={rightWidth}
          min={RIGHT_SIDEBAR_MIN}
          max={RIGHT_SIDEBAR_MAX}
          invert
          onInput={setDragWidth}
          onChange={commitRightWidth}
          ariaLabel="Resize properties sidebar"
        />
        <Sidebar
          side="right"
          className="wd-sidebar right"
          ariaLabel="Properties"
          // Width lives in a custom property so app.css keeps ownership of the
          // clamp; only the number crosses the boundary.
          style={{ '--wd-right-width': `${rightWidth}px` } as CSSProperties}
        >
          <RightSidebar
            scene={scene}
            selection={selection}
            filename={filename}
            setFilename={setFilename}
            backgroundColor={backgroundColor}
            setBackgroundColor={setBackgroundColor}
            paperSize={paperSize}
            setPaperSize={setPaperSize}
            docSelected={docSelected}
            setDocSelected={setDocSelected}
          />
        </Sidebar>
      </div>
      <EditorStatusBar scene={scene} selection={selection} view={view} machine={modality.machine} />
    </div>
    </ActiveToolContextProvider>
  );
}

function EditorStatusBar({
  scene,
  selection,
  view,
  machine,
}: {
  scene: ReturnType<typeof useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>>;
  selection: ReturnType<typeof useSelection>;
  view: View;
  machine: ModeMachine;
}): ReactElement {
  const modeId = useModeId(machine);
  const activeTool = useActiveToolContext();
  const colors = useColorContext();
  const colorMode = useColorModeControl();
  let groupCount = 0;
  for (const id of scene.renderOrder()) {
    const n = scene.get(id);
    if (n && n.kind === 'container') groupCount++;
  }
  const paintLabel = (p: ActivePaint): string =>
    p.kind === 'solid' ? p.color : p.kind;
  const engaged = activeTool.hotkeyStack[activeTool.hotkeyStack.length - 1];
  const toolLabel = engaged ? `${activeTool.active} → ${engaged}` : activeTool.active;
  return (
    <StatusBar ariaLabel="Editor status" className="wd-statusbar">
      <ModeStatusIndicator modeId={modeId} />
      <StatusBarItem>tool: {toolLabel}</StatusBarItem>
      <StatusBarItem>sel: {selection.current.length}</StatusBarItem>
      <StatusBarItem>groups: {groupCount}</StatusBarItem>
      <StatusBarItem>fill: {paintLabel(colors.fill)}</StatusBarItem>
      <StatusBarItem>stroke: {paintLabel(colors.stroke)}</StatusBarItem>
      <StatusBarSpacer />
      <StatusBarItem>zoom: {(view.scale.x * 100).toFixed(0)}%</StatusBarItem>
      {colorMode && (
        <StatusBarItem>
          <button
            type="button"
            className="wd-mode-toggle"
            onClick={colorMode.toggle}
            title={`Switch to ${colorMode.mode === 'dark' ? 'light' : 'dark'} mode`}
            aria-label={`Switch to ${colorMode.mode === 'dark' ? 'light' : 'dark'} mode`}
          >
            {colorMode.mode === 'dark' ? '\u25D1 dark' : '\u25D0 light'}
          </button>
        </StatusBarItem>
      )}
      <StatusBarItem muted title={buildTitle()}>{buildLabel()}</StatusBarItem>
    </StatusBar>
  );
}

export default App;
