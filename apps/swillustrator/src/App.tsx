/**
 * Swillustrator — minimum-viable editor built against the post-purge kit
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
 *     either backed by registry triggers or stubbed (see `apps/swillustrator/TODO.md`
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
  rectPath,
  asNodeId,
  type ToolsApi,
  type Path,
  type AlignEdge,
  type DistributeAxis,
  type SerializedScene,
} from '@orochi235/weasel';
import { SidebarPanel, ToolPalette } from '@orochi235/weasel-ui';

import { ActionBar, type FlipAxis, type PaperSizeKey } from './ActionBar';
import { ActiveSwatches, type ActivePaint } from './ActiveSwatches';
import { PreferencesModal } from './PreferencesModal';
import { ColorContextProvider } from './tools/colorContext/ColorContextProvider';
import { LayerList } from './ui/LayerList';
import { useLayerList } from './ui/LayerList/useLayerList';
import {
  PropertiesPanel,
  PropertiesGrid,
  PropertyRow,
  PropertyNumberInput,
  PropertyColorInput,
  PropertySwatchGrid,
} from './ui/PropertiesPanel';
import { HistoryList } from './ui/HistoryList';
import { DispatchTracePanel } from './dev/DispatchTracePanel';
import { useColorContext } from './tools/colorContext';
import { useSceneAdapter } from '@orochi235/weasel';
import type { Obj } from './poseUpdate';
import { parseSvg } from '@orochi235/weasel-svg';
import { pickSvgFile, svgNodesToObjsWithGroups, parsedToDoc, SWILL_NAMESPACES } from './svgInterop';
import type { RecordingProfile } from './recorder';

import './swillustrator.css';

// ─── Document / scene shapes ────────────────────────────────────────────────

/** Pose stored on every leaf — rectangular AABB plus optional rotation
 *  (radians, pivot = unrotated AABB center). Matches the auto-rotation
 *  hook `SceneCanvas.defaultDrawOne` applies for any pose carrying a
 *  non-zero `rotation` field. */
interface SwillPose {
  x: number; y: number; width: number; height: number; rotation?: number;
}

/** Data stored on every leaf — kit-native shape consumed by PATH_PAINTER
 *  and the text painter. Tools synthesized by `toolBundle="exhaustive"`
 *  already produce this shape, so no per-tool `create` overrides are
 *  required. `text` is present on text-tool leaves only. */
interface SwillData {
  path?: Path;
  text?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  label?: string;
}

type SwillLayer = 'default';

/** Paper sizes — viewport-only for now (we don't render a paper background).
 *  Kept so the New menu in the ActionBar has somewhere to dispatch to. */
const PAPER_PRESETS: Record<PaperSizeKey, { width: number; height: number }> = {
  letter: { width: 816, height: 1056 },
  a4:     { width: 794, height: 1123 },
  legal:  { width: 816, height: 1344 },
};

const LS_KEY = 'swillustrator:scene-v1';

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
  scene: ReturnType<typeof useScene<SwillData, SwillLayer, SwillPose>>;
  selection: ReturnType<typeof useSelection>;
}

function RightSidebar({ scene, selection }: RightSidebarProps): ReactElement {
  const adapter = useSceneAdapter(scene, {});
  const layerListProps = useLayerList({
    scene,
    selection,
    adapter,
    itemFor: (node) => {
      const data = node.data as SwillData;
      return {
        label: data.text ?? `${node.id.slice(0, 6)}…`,
        swatch: typeof data.fill === 'string' ? data.fill : undefined,
      };
    },
  });

  const selectedIds = selection.current;
  const selectedCount = selectedIds.length;
  const firstSelected = selectedCount > 0 ? scene.get(asNodeId(selectedIds[0])) : null;

  const [layersCollapsed, setLayersCollapsed] = usePersistedFlag('swill:panel:layers:collapsed', false);
  const [historyCollapsed, setHistoryCollapsed] = usePersistedFlag('swill:panel:history:collapsed', false);

  const patchSelection = useCallback(
    (patch: Partial<SwillData>) => {
      const ids = selection.current;
      if (ids.length === 0) return;
      scene.batch('Edit properties', () => {
        for (const id of ids) {
          const n = scene.get(asNodeId(id));
          if (!n) continue;
          scene.update(asNodeId(id), { data: { ...(n.data as SwillData), ...patch } as SwillData });
        }
      });
    },
    [scene, selection],
  );

  return (
    <>
      <PropertiesPanel title="Properties">
        {selectedCount === 0 && (
          <div style={{ padding: 8, fontSize: 12, opacity: 0.6 }}>
            <em>No selection</em>
          </div>
        )}
        {selectedCount > 0 && firstSelected && (
          <PropertiesGrid>
            <PropertyRow label="x">
              <PropertyNumberInput
                value={(firstSelected.pose as SwillPose).x}
                onChange={(x) => scene.setPose(asNodeId(firstSelected.id), { ...(firstSelected.pose as SwillPose), x })}
              />
            </PropertyRow>
            <PropertyRow label="y">
              <PropertyNumberInput
                value={(firstSelected.pose as SwillPose).y}
                onChange={(y) => scene.setPose(asNodeId(firstSelected.id), { ...(firstSelected.pose as SwillPose), y })}
              />
            </PropertyRow>
            <PropertyRow label="w">
              <PropertyNumberInput
                value={(firstSelected.pose as SwillPose).width}
                onChange={(width) => scene.setPose(asNodeId(firstSelected.id), { ...(firstSelected.pose as SwillPose), width })}
              />
            </PropertyRow>
            <PropertyRow label="h">
              <PropertyNumberInput
                value={(firstSelected.pose as SwillPose).height}
                onChange={(height) => scene.setPose(asNodeId(firstSelected.id), { ...(firstSelected.pose as SwillPose), height })}
              />
            </PropertyRow>
            <PropertyRow label="fill">
              <PropertyColorInput
                value={(firstSelected.data as SwillData).fill ?? '#000000'}
                onChange={(fill) => patchSelection({ fill })}
              />
            </PropertyRow>
            <PropertyRow label="stroke">
              <PropertyColorInput
                value={(firstSelected.data as SwillData).stroke ?? '#000000'}
                onChange={(stroke) => patchSelection({ stroke })}
              />
            </PropertyRow>
            <PropertyRow label="stroke w">
              <PropertyNumberInput
                value={(firstSelected.data as SwillData).strokeWidth ?? 0}
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
          className="swill-layerlist-fill"
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
  const current = colors.focused === 'stroke'
    ? (colors.stroke.kind === 'solid' ? colors.stroke.color : '')
    : (colors.fill.kind === 'solid' ? colors.fill.color : '');
  return (
    <PropertiesPanel title="Colors">
      <PropertySwatchGrid
        value={current}
        options={PALETTE}
        columns={10}
        onChange={(v) => {
          if (colors.focused === 'stroke') colors.setStroke({ kind: 'solid', color: v });
          else colors.setFill({ kind: 'solid', color: v });
        }}
        leading={{
          active: (colors.focused === 'stroke' ? colors.stroke : colors.fill).kind === 'none',
          title: 'None',
          onClick: () => {
            if (colors.focused === 'stroke') colors.setStroke({ kind: 'none' });
            else colors.setFill({ kind: 'none' });
          },
        }}
      />
    </PropertiesPanel>
  );
}


interface ToolbarProps {
  scene: ReturnType<typeof useScene<SwillData, SwillLayer, SwillPose>>;
  selection: ReturnType<typeof useSelection>;
  gridVisible: boolean;
  setGridVisible: (v: boolean) => void;
  snapToGrid: boolean;
  setSnapToGrid: (v: boolean) => void;
  setPaperSize: (k: PaperSizeKey) => void;
  onOpenPrefs: () => void;
}

function Toolbar({
  scene, selection,
  gridVisible, setGridVisible,
  snapToGrid, setSnapToGrid,
  setPaperSize, onOpenPrefs,
}: ToolbarProps): ReactElement {
  const registry = useActionsRegistry();
  const trigger = useCallback((id: string) => {
    registry?.trigger(id);
  }, [registry]);

  // Clipboard is in-memory only — the kit's clipboard actions weren't
  // wired here (see TODO.md). Copy/cut snapshot the selected leaves;
  // paste re-adds them as fresh ids at a small offset.
  const clipboardRef = useRef<Array<{ pose: SwillPose; data: SwillData }>>([]);
  const [clipboardEmpty, setClipboardEmpty] = useState(true);

  const snapshotSelection = useCallback(() => {
    const snaps: Array<{ pose: SwillPose; data: SwillData }> = [];
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
        onSaveSvg={() => {/* v0: SVG export deferred (TODO.md) */}}
        onOpenSvg={() => {
          // Pop the file picker, parse the chosen SVG, lower its nodes back
          // into the scene-graph as leaves. Groups recognized by the parser
          // are flattened for v1 — restoring nested group structure needs
          // scene.add({ kind: 'group', ... }) support and is deferred.
          void (async () => {
            const text = await pickSvgFile();
            if (text === null) return;
            const parsed = parseSvg(text, { namespaces: SWILL_NAMESPACES });
            for (const w of parsed.warnings) console.warn('[svg import]', w);
            const docPatch = parsedToDoc(parsed);
            if (docPatch.paperSize) setPaperSize(docPatch.paperSize);
            let seq = 0;
            const { items, groups } = svgNodesToObjsWithGroups(parsed.nodes, () => `svg-${++seq}`);
            if (groups.length > 0) {
              console.warn(`[svg import] ${groups.length} group(s) flattened — nested groups not yet rehydrated into the scene-graph`);
            }
            scene.batch('Import SVG', () => {
              for (const o of items) {
                const pose: SwillPose = { x: o.x, y: o.y, width: o.width, height: o.height };
                if (o.rotation) pose.rotation = o.rotation;
                const textFill = o.tool === 'text' && o.style?.fill && (o.style.fill.fill === 'solid' || o.style.fill.fill === undefined)
                  ? o.style.fill.color
                  : undefined;
                const data: SwillData = o.tool === 'text'
                  ? { text: o.text, fill: textFill ?? '#000000' }
                  : { path: o.path, fill: o.fill, stroke: o.stroke, strokeWidth: o.strokeWidth };
                scene.add({ kind: 'leaf', layer: 'default', pose, data });
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
        canReleaseCompound={false}
        onReleaseCompound={() => {/* v0: compound-path release deferred */}}
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
  layer: SwillLayer;
  pose: SwillPose;
  data: SwillData;
  id: ReturnType<typeof asNodeId>;
}> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const json = JSON.parse(raw) as SerializedScene<SwillData, SwillLayer, SwillPose>;
      if (json && json.version === 1 && Array.isArray(json.nodes)) {
        return json.nodes
          .filter((n) => n.kind === 'leaf')
          .map((n) => ({
            kind: 'leaf' as const,
            layer: 'default' as SwillLayer,
            pose: n.pose,
            data: n.data,
            id: asNodeId(n.id),
          }));
      }
    }
  } catch {
    // fall through to starter
  }
  return [{
    kind: 'leaf' as const,
    layer: 'default' as SwillLayer,
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
 *  writes onto our `SwillData` leaves. Other patch fields (path geometry,
 *  text) are ignored: the active-color UI only mutates fills/strokes. */
function buildUpdateSelected(
  scene: ReturnType<typeof useScene<SwillData, SwillLayer, SwillPose>>,
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

/** Thin wrapper that hoists the scene + selection so the
 *  `ColorContextProvider`'s `updateSelected` bridge can close over them.
 *  Both `useScene` and `useSelection` are stable across renders (their
 *  underlying instances are constructed once via `useRef`), so the bridge
 *  closure created here doesn't churn between Editor renders. */
export function App(): ReactElement {
  // Lift scene + selection to share with both Editor and the color
  // context bridge. `useScene` / `useSelection` synthesize stable
  // instances internally, so re-renders here don't recreate them.
  const scene = useScene<SwillData, SwillLayer, SwillPose>({
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
        localStorage.setItem(LS_KEY, JSON.stringify(scene.toJSON()));
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
  scene: ReturnType<typeof useScene<SwillData, SwillLayer, SwillPose>>;
  selection: ReturnType<typeof useSelection>;
}): ReactElement {
  const [tools, setTools] = useState<ToolsApi | null>(null);
  const [paperSize, setPaperSize] = useState<PaperSizeKey>('letter');
  const [gridVisible, setGridVisible] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const paper = PAPER_PRESETS[paperSize];

  return (
    <div className="swill-app">
      <Toolbar
        scene={scene}
        selection={selection}
        gridVisible={gridVisible}
        setGridVisible={setGridVisible}
        snapToGrid={snapToGrid}
        setSnapToGrid={setSnapToGrid}
        setPaperSize={setPaperSize}
        onOpenPrefs={() => setPrefsOpen(true)}
      />
      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
      <div className="swill-body">
        <div className="swill-sidebar left">
          <ActiveSwatches />
          {tools && <ToolPalette tools={tools} orientation="vertical" />}
        </div>
        <div className="swill-canvas-host">
          <SceneCanvas<SwillData, SwillLayer, SwillPose>
            width={paper.width}
            height={paper.height}
            scene={scene}
            selection={selection}
            selectionMode="multi"
            backgroundFill={{ fill: 'solid', color: '#ffffff' }}
            toolBundle="exhaustive"
            viewport={{ pinchZoom: true }}
            cursorCoordsHud
            onToolsCreated={setTools}
            layers={gridVisible ? {
              grid: {
                spacing: 20,
                bounds: () => ({ x: 0, y: 0, width: paper.width, height: paper.height }),
                accentEvery: 5,
                style: {
                  line:   { paint: { fill: 'solid', color: 'rgba(0, 0, 0, 0.08)' }, width: 1 },
                  accent: { paint: { fill: 'solid', color: 'rgba(0, 0, 0, 0.18)' }, width: 1 },
                },
              },
            } : {}}
          />
        </div>
        <div className="swill-sidebar right">
          <RightSidebar scene={scene} selection={selection} />
        </div>
      </div>
    </div>
  );
}

export default App;
