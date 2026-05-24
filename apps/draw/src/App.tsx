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
  useCallback, useEffect, useMemo, useRef, useState, type ReactElement,
} from 'react';
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
  type ToolsApi,
  type Path,
  type AlignEdge,
  type DistributeAxis,
  type SerializedScene,
  type BooleansAdapter,
  type NodeId,
  type View,
  type RenderLayer,
  fitViewToBounds,
  viewToMat3,
  ActiveToolContextProvider,
  useActiveToolContext,
} from '@orochi235/weasel';
import { SidebarPanel, ToolPalette } from '@orochi235/weasel-ui';

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
  PropertyNumberInput,
  PropertyTextInput,
  PropertyColorInput,
  PropertySwatchGrid,
  PropertySelect,
} from './ui/PropertiesPanel';
import { HistoryList } from './ui/HistoryList';
import { DispatchTracePanel } from './dev/DispatchTracePanel';
import { lookupShortcutByToolId } from './dev/keybindingsView';
import { useColorContext } from './tools/colorContext';
import { useSceneAdapter } from '@orochi235/weasel';
import type { Obj } from './poseUpdate';
import { parseSvg } from '@orochi235/weasel-svg';
import { downloadSvg, pickSvgFile, svgNodesToObjsWithGroups, parsedToDoc, SWILL_NAMESPACES } from './svgInterop';
import { sceneToSvgString } from './svgExport';
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
  fill?: string;
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

// PolygonPath stores `commands` as Uint8Array and `coords` as Float32Array.
// JSON.stringify renders typed arrays as `{"0":1,"1":2,...}` plain objects
// — the painter then sees a non-iterable shape and silently fails to draw.
// Tag typed arrays on save and reconstruct them on load (with tolerance for
// older saves that wrote the broken numeric-key object shape).
type TaggedTypedArray = { __ta: 'u8' | 'f32'; data: number[] };
function serializeReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) return { __ta: 'u8', data: Array.from(value) } satisfies TaggedTypedArray;
  if (value instanceof Float32Array) return { __ta: 'f32', data: Array.from(value) } satisfies TaggedTypedArray;
  return value;
}
function reviveTypedArrays<T>(node: T): T {
  if (node == null || typeof node !== 'object') return node;
  const obj = node as Record<string, unknown>;
  const tag = obj.__ta;
  if (tag === 'u8' && Array.isArray(obj.data)) return Uint8Array.from(obj.data as number[]) as unknown as T;
  if (tag === 'f32' && Array.isArray(obj.data)) return Float32Array.from(obj.data as number[]) as unknown as T;
  for (const k of Object.keys(obj)) {
    if (k === 'commands' || k === 'coords') {
      const v = obj[k];
      if (v instanceof Uint8Array || v instanceof Float32Array) continue;
      if (Array.isArray(v)) {
        obj[k] = k === 'commands' ? Uint8Array.from(v as number[]) : Float32Array.from(v as number[]);
        continue;
      }
      if (v && typeof v === 'object') {
        // Recover from older saves that lost the typed-array shape.
        const src = v as Record<string, unknown>;
        if (src.__ta) { obj[k] = reviveTypedArrays(v); continue; }
        const len = Object.keys(src).filter((kk) => /^\d+$/.test(kk)).length;
        const arr = new Array<number>(len);
        for (let i = 0; i < len; i++) arr[i] = Number(src[String(i)] ?? 0);
        obj[k] = k === 'commands' ? Uint8Array.from(arr) : Float32Array.from(arr);
        continue;
      }
    } else {
      reviveTypedArrays(obj[k]);
    }
  }
  return node;
}
const DEFAULT_FILENAME = 'untitled.svg';
const DEFAULT_BG_COLOR = '#ffffff';
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

// 99-color palette: 9 neutrals (row 1, alongside the leading transparent
// swatch) + 9 hue ramps × 10 shades. Renders 10 per row in the Colors
// panel; total 100 cells including transparent.
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

// ─── Toolbar host: bridges the Actions Registry into ActionBar's flat-prop API ─

// ─── Right sidebar: LayerList + PropertiesPanel ─────────────────────────────

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
        swatch: typeof data.fill === 'string' ? data.fill : undefined,
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

  const selectedIds = selection.current;
  const selectedCount = selectedIds.length;
  const firstSelected = selectedCount > 0 ? scene.get(asNodeId(selectedIds[0])) : null;

  const [layersCollapsed, setLayersCollapsed] = usePersistedFlag('wd:panel:layers:collapsed', false);
  const [historyCollapsed, setHistoryCollapsed] = usePersistedFlag('wd:panel:history:collapsed', false);

  const patchSelection = useCallback(
    (patch: Partial<WeaselDrawData>) => {
      const ids = selection.current;
      if (ids.length === 0) return;
      scene.batch('Edit properties', () => {
        for (const id of ids) {
          const n = scene.get(asNodeId(id));
          if (!n) continue;
          scene.update(asNodeId(id), { data: { ...(n.data as WeaselDrawData), ...patch } as WeaselDrawData });
        }
      });
    },
    [scene, selection],
  );

  return (
    <>
      <PropertiesPanel title={docSelected ? 'Document' : 'Properties'}>
        {docSelected && (
          <PropertiesGrid>
            <PropertyRow label="file">
              <PropertyTextInput
                value={filename}
                placeholder={DEFAULT_FILENAME}
                onChange={setFilename}
              />
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
              <PropertyColorInput
                value={backgroundColor}
                onChange={setBackgroundColor}
              />
            </PropertyRow>
          </PropertiesGrid>
        )}
        {!docSelected && selectedCount === 0 && (
          <div style={{ padding: 8, fontSize: 12, opacity: 0.6 }}>
            <em>No selection</em>
          </div>
        )}
        {!docSelected && selectedCount > 0 && firstSelected && (
          <PropertiesGrid>
            <PropertyRow label="x">
              <PropertyNumberInput
                value={(firstSelected.pose as WeaselDrawPose).x}
                onChange={(x) => scene.setPose(asNodeId(firstSelected.id), { ...(firstSelected.pose as WeaselDrawPose), x })}
              />
            </PropertyRow>
            <PropertyRow label="y">
              <PropertyNumberInput
                value={(firstSelected.pose as WeaselDrawPose).y}
                onChange={(y) => scene.setPose(asNodeId(firstSelected.id), { ...(firstSelected.pose as WeaselDrawPose), y })}
              />
            </PropertyRow>
            <PropertyRow label="w">
              <PropertyNumberInput
                value={(firstSelected.pose as WeaselDrawPose).width}
                onChange={(width) => scene.setPose(asNodeId(firstSelected.id), { ...(firstSelected.pose as WeaselDrawPose), width })}
              />
            </PropertyRow>
            <PropertyRow label="h">
              <PropertyNumberInput
                value={(firstSelected.pose as WeaselDrawPose).height}
                onChange={(height) => scene.setPose(asNodeId(firstSelected.id), { ...(firstSelected.pose as WeaselDrawPose), height })}
              />
            </PropertyRow>
            <PropertyRow label="fill">
              <PropertyColorInput
                value={(firstSelected.data as WeaselDrawData).fill ?? '#000000'}
                onChange={(fill) => patchSelection({ fill })}
              />
            </PropertyRow>
            <PropertyRow label="stroke">
              <PropertyColorInput
                value={(firstSelected.data as WeaselDrawData).stroke ?? '#000000'}
                onChange={(stroke) => patchSelection({ stroke })}
              />
            </PropertyRow>
            <PropertyRow label="stroke w">
              <PropertyNumberInput
                value={(firstSelected.data as WeaselDrawData).strokeWidth ?? 0}
                min={0}
                step={0.5}
                onChange={(strokeWidth) => patchSelection({ strokeWidth })}
              />
            </PropertyRow>
            {selectedCount > 1 && (
              <PropertyRow label="">
                <em style={{ opacity: 0.55, fontSize: 11 }}>color/stroke apply to {selectedCount} items</em>
              </PropertyRow>
            )}
          </PropertiesGrid>
        )}
      </PropertiesPanel>
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
  // Highlight tracks the fill swatch — left-click (the primary action)
  // sets fill. Right-click sets stroke; the active-swatches widget
  // reflects the stroke update.
  const current = colors.fill.kind === 'solid' ? colors.fill.color : '';
  return (
    <PropertiesPanel title="Colors">
      <PropertySwatchGrid
        value={current}
        options={PALETTE}
        columns={10}
        onChange={(v) => {
          colors.setFill({ kind: 'solid', color: v });
          colors.applyFillToSelection(v);
        }}
        onAltChange={(v) => {
          colors.setStroke({ kind: 'solid', color: v });
          colors.applyStrokeToSelection(v);
        }}
        leading={{
          active: colors.fill.kind === 'none',
          title: 'None',
          onClick: () => colors.setFill({ kind: 'none' }),
          onAltClick: () => colors.setStroke({ kind: 'none' }),
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
}

function Toolbar({
  scene, selection,
  gridVisible, setGridVisible,
  snapToGrid, setSnapToGrid,
  paperSize, setPaperSize,
  filename, backgroundColor,
  onOpenPrefs,
}: ToolbarProps): ReactElement {
  const registry = useActionsRegistry();
  const trigger = useCallback((id: string) => {
    registry?.trigger(id);
  }, [registry]);

  // Clipboard is in-memory only — the kit's clipboard actions weren't
  // wired here (see TODO.md). Copy/cut snapshot the selected leaves;
  // paste re-adds them as fresh ids at a small offset.
  const clipboardRef = useRef<Array<{ pose: WeaselDrawPose; data: WeaselDrawData }>>([]);
  const [clipboardEmpty, setClipboardEmpty] = useState(true);

  const snapshotSelection = useCallback(() => {
    const snaps: Array<{ pose: WeaselDrawPose; data: WeaselDrawData }> = [];
    for (const id of selection.current) {
      const node = scene.get(asNodeId(id));
      if (node && node.kind === 'leaf') {
        snaps.push({ pose: { ...node.pose }, data: { ...node.data } });
      }
    }
    return snaps;
  }, [scene, selection]);

  const onCopy = useCallback(() => {
    const snaps = snapshotSelection();
    if (snaps.length === 0) return;
    clipboardRef.current = snaps;
    setClipboardEmpty(false);
  }, [snapshotSelection]);

  const onCut = useCallback(() => {
    const snaps = snapshotSelection();
    if (snaps.length === 0) return;
    clipboardRef.current = snaps;
    setClipboardEmpty(false);
    scene.batch('Cut', () => {
      for (const id of selection.current) scene.remove(asNodeId(id));
    });
  }, [snapshotSelection, scene, selection]);

  const onPaste = useCallback(() => {
    if (clipboardRef.current.length === 0) return;
    const newIds: ReturnType<typeof asNodeId>[] = [];
    scene.batch('Paste', () => {
      for (const snap of clipboardRef.current) {
        const id = scene.add({
          kind: 'leaf',
          layer: 'default',
          pose: { ...snap.pose, x: snap.pose.x + 12, y: snap.pose.y + 12 },
          data: { ...snap.data },
        });
        newIds.push(id);
      }
    });
    selection.set(newIds);
  }, [scene, selection]);

  // Selection-aware z-order: rough "is the top selection at front/back?" guard.
  // Cheap heuristic — only inspects render order length, not per-id position,
  // because the dispatcher's reorder action does the real work.
  const hasSelection = selection.current.length > 0;
  const selectionSize = selection.current.length;

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
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        clipboardEmpty={clipboardEmpty}
        onBringForward={() => trigger('reorder.forward')}
        onSendBackward={() => trigger('reorder.backward')}
        onBringToFront={() => trigger('reorder.forward')}
        onSendToBack={() => trigger('reorder.backward')}
        canMoveForward={hasSelection}
        canMoveBackward={hasSelection}
        onGroup={() => trigger('group')}
        onUngroup={() => trigger('ungroup')}
        canUngroup={hasSelection}
        onAlign={(edge: AlignEdge) => trigger(`align.${edge}`)}
        onDistribute={(axis: DistributeAxis) => trigger(`distribute.${axis}`)}
        onFlip={(_axis: FlipAxis) => trigger('flip')}
        onSaveSvg={() => {
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
            const parsed = parseSvg(text, { namespaces: SWILL_NAMESPACES });
            for (const w of parsed.warnings) console.warn('[svg import]', w);
            const docPatch = parsedToDoc(parsed);
            if (docPatch.paperSize) setPaperSize(docPatch.paperSize);
            let seq = 0;
            const { items, groups } = svgNodesToObjsWithGroups(parsed.nodes, () => `svg-${++seq}`);
            scene.batch('Import SVG', () => {
              // Map ObjId (from svgInterop) → scene-graph NodeId for both
              // leaves and containers, so groups can reference their members
              // (including nested groups) by the same key.
              const idMap = new Map<string, ReturnType<typeof asNodeId>>();
              // 1. Insert all leaves at root first.
              for (const o of items) {
                const pose: WeaselDrawPose = { x: o.x, y: o.y, width: o.width, height: o.height };
                if (o.rotation) pose.rotation = o.rotation;
                const textFill = o.tool === 'text' && o.style?.fill && (o.style.fill.fill === 'solid' || o.style.fill.fill === undefined)
                  ? o.style.fill.color
                  : undefined;
                const data: WeaselDrawData = o.tool === 'text'
                  ? { text: o.text, fill: textFill ?? '#000000' }
                  : { path: o.path, fill: o.fill, stroke: o.stroke, strokeWidth: o.strokeWidth };
                const sceneId = scene.add({ kind: 'leaf', layer: 'default', pose, data });
                idMap.set(o.id, sceneId);
              }
              // 2. Topologically: process groups whose members are all already
              // in idMap. Inner groups land first; outer groups can then
              // reparent them by reading idMap.get(innerGroupId).
              const remaining = new Set(groups.map((g) => g.id));
              while (remaining.size > 0) {
                let progressed = false;
                for (const g of groups) {
                  if (!remaining.has(g.id)) continue;
                  if (!g.members.every((m) => idMap.has(m))) continue;
                  // Container pose = AABB of members so resize handles land
                  // sensibly when the group is selected.
                  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                  for (const m of g.members) {
                    const member = scene.get(idMap.get(m)!);
                    if (!member) continue;
                    const mp = member.pose as WeaselDrawPose;
                    if (mp.x < minX) minX = mp.x;
                    if (mp.y < minY) minY = mp.y;
                    if (mp.x + mp.width > maxX) maxX = mp.x + mp.width;
                    if (mp.y + mp.height > maxY) maxY = mp.y + mp.height;
                  }
                  const containerPose: WeaselDrawPose = Number.isFinite(minX)
                    ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
                    : { x: 0, y: 0, width: 0, height: 0 };
                  const containerId = scene.add({
                    kind: 'container',
                    layer: 'default',
                    pose: containerPose,
                    data: {},
                  });
                  idMap.set(g.id, containerId);
                  for (const m of g.members) {
                    scene.move(idMap.get(m)!, containerId);
                  }
                  remaining.delete(g.id);
                  progressed = true;
                }
                if (!progressed) {
                  console.warn(`[svg import] ${remaining.size} group(s) unresolvable — cyclic membership?`);
                  break;
                }
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

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Restore the persisted scene (if any) from localStorage. Returns the
 *  initial node list shaped for `useScene`'s full-form call signature.
 *  Best-effort — any parse error yields a fresh starter scene with one
 *  example rectangle so the canvas isn't empty on first run. */
function loadInitial(): Array<{
  kind: 'leaf';
  layer: WeaselDrawLayer;
  pose: WeaselDrawPose;
  data: WeaselDrawData;
  id: ReturnType<typeof asNodeId>;
}> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const json = JSON.parse(raw) as SerializedScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;
      if (json && json.version === 1 && Array.isArray(json.nodes)) {
        return json.nodes
          .filter((n) => n.kind === 'leaf')
          .map((n) => ({
            kind: 'leaf' as const,
            layer: 'default' as WeaselDrawLayer,
            pose: n.pose,
            data: reviveTypedArrays(n.data),
            id: asNodeId(n.id),
          }));
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

/** Bridge for `<ColorContextProvider updateSelected>` — accepts the legacy
 *  `Obj`-typed patch callback and translates fill/stroke/strokeWidth
 *  writes onto our `WeaselDrawData` leaves. Other patch fields (path geometry,
 *  text) are ignored: the active-color UI only mutates fills/strokes. */
function buildUpdateSelected(
  scene: ReturnType<typeof useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>>,
  selection: ReturnType<typeof useSelection>,
): (patch: (o: Obj) => Obj, label?: string) => void {
  return (patch, label) => {
    if (selection.current.length === 0) return;
    scene.batch(label ?? 'Set color', () => {
      for (const id of selection.current) {
        const node = scene.get(asNodeId(id));
        if (!node || node.kind !== 'leaf') continue;
        // Build a minimal Obj-shaped stub so the caller's patch closure
        // can read previous fill/stroke/strokeWidth. Tool kind is faked
        // to match the legacy union; only the color fields round-trip.
        const stub: Obj = {
          id,
          tool: 'rect',
          x: node.pose.x, y: node.pose.y,
          width: node.pose.width, height: node.pose.height,
          path: node.data.path ?? rectPath(node.pose.x, node.pose.y, node.pose.width, node.pose.height),
          closed: true,
          fill: node.data.fill ?? '#ffffffff',
          stroke: node.data.stroke ?? '#000000ff',
          strokeWidth: node.data.strokeWidth ?? 1,
        };
        const next = patch(stub);
        if (next === stub) continue;
        if (next.tool === 'text') continue;
        scene.update(asNodeId(id), {
          data: {
            ...node.data,
            fill: next.fill,
            stroke: next.stroke,
            strokeWidth: next.strokeWidth,
          },
        });
      }
    });
  };
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
      insertNode: (node) => {
        const n = node as { id: string; kind: 'leaf' | 'container'; layer: WeaselDrawLayer; pose: WeaselDrawPose; data: WeaselDrawData; parent?: NodeId | null };
        scene.add({
          kind: n.kind,
          layer: n.layer,
          pose: n.pose,
          data: n.data,
          id: asNodeId(n.id),
          ...(n.parent != null ? { parent: n.parent } : {}),
        });
      },
      removeNode: (id) => { scene.remove(asNodeId(id)); },
      applyOps: (ops, label) => {
        scene.batch(label ?? 'Booleans', () => {
          for (const op of ops) op.apply(a);
        });
      },
    };
    return a;
  }, [scene, selection]);
  useBooleansAdapter(adapter);
  return null;
}

/** Thin wrapper that hoists the scene + selection so the
 *  `ColorContextProvider`'s `updateSelected` bridge can close over them.
 *  Both `useScene` and `useSelection` are stable across renders (their
 *  underlying instances are constructed once via `useRef`), so the bridge
 *  closure created here doesn't churn between Editor renders. */
export function App(): ReactElement {
  // Lift scene + selection to share with both Editor and the color
  // context bridge. `useScene` / `useSelection` synthesize stable
  // instances internally, so re-renders here don't recreate them.
  const scene = useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: [{ id: 'default' }],
    initial: useMemo(loadInitial, []),
  });
  const selection = useSelection({ mode: 'multi' });
  const updateSelected = useMemo(
    () => buildUpdateSelected(scene, selection),
    [scene, selection],
  );

  // Persist on every commit. The 300ms debounce coalesces drag bursts so
  // we hit localStorage at most a few times per second.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(scene.toJSON(), serializeReplacer));
      } catch {
        // Persistence is best-effort.
      }
    }, 300);
    return () => clearTimeout(id);
  });

  const initialFill: ActivePaint = { kind: 'solid', color: '#7ab8d4ff' };
  const initialStroke: ActivePaint = { kind: 'solid', color: '#000000ff' };

  return (
    <ColorContextProvider
      initialFill={initialFill}
      initialStroke={initialStroke}
      updateSelected={updateSelected}
    >
      <EditorWithSharedScene scene={scene} selection={selection} />
    </ColorContextProvider>
  );
}

// ─── Editor variant that consumes the lifted scene/selection ────────────────

function EditorWithSharedScene({
  scene,
  selection,
}: {
  scene: ReturnType<typeof useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>>;
  selection: ReturnType<typeof useSelection>;
}): ReactElement {
  const [tools, setTools] = useState<ToolsApi | null>(null);
  const actionsReg = useActionsRegistry();
  const [paperSize, setPaperSize] = useState<PaperSizeKey>('letter');
  const [gridVisible, setGridVisible] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

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
  useEffect(() => {
    if (selection.current.length > 0 && docSelected) setDocSelected(false);
  }, [selection.current.length, docSelected]);

  // Persist filename + bg color with the same 300ms debounce as the scene.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DOC_KEY, JSON.stringify({ filename, backgroundColor }));
      } catch { /* best-effort */ }
    }, 300);
    return () => clearTimeout(id);
  }, [filename, backgroundColor]);

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
    draw: (_data, v) => [{
      kind: 'group',
      transform: viewToMat3(v),
      children: [{
        kind: 'path',
        path: { kind: 'rect', x: 0, y: 0, width: paper.width, height: paper.height },
        fill: { fill: 'solid', color: backgroundColor },
      }],
    }],
  }), [paper.width, paper.height, backgroundColor]);

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
      />
      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
      <div className="wd-body">
        <div className="wd-sidebar left">
          {tools && (
            <ToolPalette
              tools={tools}
              orientation="vertical"
              lookupShortcut={(id) => lookupShortcutByToolId(id, actionsReg?.list() ?? [])}
            />
          )}
          <ActiveSwatches />
        </div>
        <div className="wd-canvas-host" ref={hostRef}>
          {hostDims.width > 0 && hostDims.height > 0 && (
          <SceneCanvas<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>
            width={hostDims.width}
            height={hostDims.height}
            view={view}
            onViewChange={setView}
            scene={scene}
            selection={selection}
            selectionMode="multi"
            toolBundle="exhaustive"
            viewport={{ pinchZoom: true, recenter }}
            cursorCoordsHud
            pickHud
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
            }}
          >
            <BooleansAdapterPublisher scene={scene} selection={selection} />
          </SceneCanvas>
          )}
        </div>
        <div className="wd-sidebar right">
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
        </div>
      </div>
      <StatusBar scene={scene} selection={selection} view={view} />
    </div>
    </ActiveToolContextProvider>
  );
}

function StatusBar({
  scene,
  selection,
  view,
}: {
  scene: ReturnType<typeof useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>>;
  selection: ReturnType<typeof useSelection>;
  view: View;
}): ReactElement {
  const activeTool = useActiveToolContext();
  const colors = useColorContext();
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
    <div className="wd-statusbar">
      <span>tool: {toolLabel}</span>
      <span>sel: {selection.current.length}</span>
      <span>groups: {groupCount}</span>
      <span>fill: {paintLabel(colors.fill)}</span>
      <span>stroke: {paintLabel(colors.stroke)}</span>
      <span className="wd-statusbar-spacer" />
      <span>zoom: {(view.scale.x * 100).toFixed(0)}%</span>
    </div>
  );
}

export default App;
