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
import { ToolPalette } from '@orochi235/weasel-ui';

import { ActionBar, type FlipAxis, type PaperSizeKey } from './ActionBar';
import { ActiveSwatches, type ActivePaint } from './ActiveSwatches';
import { PreferencesModal } from './PreferencesModal';
import { ColorContextProvider } from './tools/colorContext/ColorContextProvider';
import { LayerList } from './ui/LayerList';
import { useLayerList } from './ui/LayerList/useLayerList';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { useSceneAdapter } from '@orochi235/weasel';
import type { Obj } from './poseUpdate';
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

  return (
    <>
      <LayerList {...layerListProps} empty={<em style={{ opacity: 0.6 }}>No nodes</em>} />
      <PropertiesPanel title="Properties">
        <div style={{ padding: 8, fontSize: 12, lineHeight: 1.6 }}>
          {selectedCount === 0 && <em style={{ opacity: 0.6 }}>No selection</em>}
          {selectedCount > 1 && <em style={{ opacity: 0.6 }}>{selectedCount} selected</em>}
          {selectedCount === 1 && firstSelected && (
            <PropRows pose={firstSelected.pose as SwillPose} data={firstSelected.data as SwillData} />
          )}
        </div>
      </PropertiesPanel>
    </>
  );
}

function PropRows({ pose, data }: { pose: SwillPose; data: SwillData }): ReactElement {
  return (
    <>
      <Row label="x" value={pose.x.toFixed(1)} />
      <Row label="y" value={pose.y.toFixed(1)} />
      <Row label="w" value={pose.width.toFixed(1)} />
      <Row label="h" value={pose.height.toFixed(1)} />
      {pose.rotation !== undefined && <Row label="rot°" value={((pose.rotation * 180) / Math.PI).toFixed(1)} />}
      {typeof data.fill === 'string' && <Row label="fill" value={data.fill} swatch={data.fill} />}
      {typeof data.stroke === 'string' && <Row label="stroke" value={data.stroke} swatch={data.stroke} />}
      {data.strokeWidth !== undefined && <Row label="strokeW" value={String(data.strokeWidth)} />}
      {data.text !== undefined && <Row label="text" value={`"${data.text}"`} />}
    </>
  );
}

function Row({ label, value, swatch }: { label: string; value: string; swatch?: string }): ReactElement {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}>
        {swatch && <span style={{ width: 10, height: 10, background: swatch, border: '1px solid rgba(255,255,255,0.15)' }} />}
        {value}
      </span>
    </div>
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
        onOpenSvg={() => {/* v0: SVG import deferred (TODO.md) */}}
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
          {tools && <ToolPalette tools={tools} orientation="vertical" />}
          <ActiveSwatches />
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
            onToolsCreated={setTools}
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
