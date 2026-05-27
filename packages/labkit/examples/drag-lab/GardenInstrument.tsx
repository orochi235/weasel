import {
  SceneCanvas,
  WeaselProvider,
  createScene,
  sceneFromJSON,
  screenToWorld,
  useSelection,
  viewToTransform,
} from '@orochi235/weasel';
import type {
  AddNodeSpec,
  RectPose,
  Scene,
  SerializedScene,
  UnitSystem,
  View,
} from '@orochi235/weasel';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { defineInstrument, type RenderContext } from '@labkit/react';

type Kind = 'tree' | 'shrub' | 'flower';

interface NodeData {
  kind: Kind;
  color: string;
}
type Pose = RectPose;
type LayerId = 'default';
type SerializedSceneJSON = SerializedScene<NodeData, LayerId, Pose>;

interface GardenState {
  scene: SerializedSceneJSON | null;
}
interface GardenConfig {
  showGrid: boolean;
}

const UNITS: UnitSystem = { base: 'px', units: { px: 1 } };
const SYSTEM_LAYERS = [{ id: 'default' as const }];

const KIND_COLORS: Record<Kind, string> = {
  tree: '#2d6a4f',
  shrub: '#74c69d',
  flower: '#e07a5f',
};
const KIND_SIZE: Record<Kind, number> = { tree: 44, shrub: 28, flower: 16 };
const KIND_LABEL: Record<Kind, string> = {
  tree: '🌳 Tree',
  shrub: '🌿 Shrub',
  flower: '🌸 Flower',
};
const KINDS: Kind[] = ['tree', 'shrub', 'flower'];

const DEFAULT_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

const INITIAL_NODES: readonly AddNodeSpec<NodeData, LayerId, Pose>[] = [
  {
    kind: 'leaf',
    layer: 'default',
    pose: { x: 180, y: 140, width: KIND_SIZE.tree, height: KIND_SIZE.tree },
    data: { kind: 'tree', color: KIND_COLORS.tree },
  },
  {
    kind: 'leaf',
    layer: 'default',
    pose: { x: 280, y: 200, width: KIND_SIZE.shrub, height: KIND_SIZE.shrub },
    data: { kind: 'shrub', color: KIND_COLORS.shrub },
  },
  {
    kind: 'leaf',
    layer: 'default',
    pose: { x: 360, y: 160, width: KIND_SIZE.flower, height: KIND_SIZE.flower },
    data: { kind: 'flower', color: KIND_COLORS.flower },
  },
];

function buildScene(json: SerializedSceneJSON | null): Scene<NodeData, LayerId, Pose> {
  if (json) return sceneFromJSON<NodeData, LayerId, Pose>(json, {});
  return createScene<NodeData, LayerId, Pose>({
    systemLayers: SYSTEM_LAYERS,
    initial: INITIAL_NODES,
  });
}

const DRAG_MIME = 'application/x-garden-kind';

interface BodyProps {
  config: GardenConfig;
  state: GardenState;
  setState: (next: GardenState | ((prev: GardenState) => GardenState)) => void;
}

function GardenBody({ config, state, setState }: BodyProps) {
  const sceneRef = useRef<Scene<NodeData, LayerId, Pose> | null>(null);
  if (sceneRef.current === null) sceneRef.current = buildScene(state.scene);

  const lastPushedRef = useRef<SerializedSceneJSON | null>(state.scene);
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (state.scene === lastPushedRef.current) return;
    sceneRef.current = buildScene(state.scene);
    lastPushedRef.current = state.scene;
    forceRender((n) => n + 1);
  }, [state.scene]);

  const scene = sceneRef.current;
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  useEffect(() => {
    return scene.subscribe(() => {
      const json = scene.toJSON();
      lastPushedRef.current = json;
      setState((prev) => ({ ...prev, scene: json }));
    });
  }, [scene, setState]);

  const selection = useSelection();
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const viewRef = useRef<View>(DEFAULT_VIEW);

  useEffect(() => {
    const el = canvasHostRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentBoxSize?.[0];
      const w = Math.round(box ? box.inlineSize : entry.contentRect.width);
      const h = Math.round(box ? box.blockSize : entry.contentRect.height);
      if (w <= 0 || h <= 0) return;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layers = useMemo(
    () => ({
      grid: config.showGrid
        ? {
            spacing: { value: 20, unit: 'px' as const },
            unitSystem: UNITS,
            bounds: () => ({ x: 0, y: 0, width: 2000, height: 2000 }),
            accentEvery: 5,
          }
        : null,
      scene: {},
      selectionOverlay: { handles: true },
    }),
    [config.showGrid],
  );

  const handlePaletteDragStart = (kind: Kind) => (e: React.DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(DRAG_MIME, kind);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const kind = e.dataTransfer.getData(DRAG_MIME) as Kind;
    if (!kind || !KIND_SIZE[kind]) return;
    e.preventDefault();
    const host = canvasHostRef.current;
    if (!host) return;
    const r = host.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const [wx, wy] = screenToWorld(sx, sy, viewToTransform(viewRef.current));
    const s = KIND_SIZE[kind];
    scene.add({
      kind: 'leaf',
      layer: 'default',
      pose: { x: wx - s / 2, y: wy - s / 2, width: s, height: s },
      data: { kind, color: KIND_COLORS[kind] },
    });
  };

  return (
    <div className="lk-garden-layout">
      <div
        ref={canvasHostRef}
        className="lk-garden-canvas"
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
      >
        <div className="lk-garden-canvas__inner">
          <SceneCanvas
            width={size.w}
            height={size.h}
            scene={scene}
            selection={selection}
            defaultView={DEFAULT_VIEW}
            onViewChange={(v) => {
              viewRef.current = v;
            }}
            layers={layers}
          />
        </div>
      </div>
      <div className="lk-garden-palette">
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            draggable
            onDragStart={handlePaletteDragStart(kind)}
            className="lk-garden-palette__item"
          >
            {KIND_LABEL[kind]}
          </button>
        ))}
      </div>
    </div>
  );
}

export const GardenInstrument = defineInstrument<GardenState, GardenConfig>({
  name: 'Garden',
  defaultConfig: () => ({ showGrid: true }),
  initialState: () => ({ scene: null }),
  configSchema: () => [
    { type: 'checkbox', key: 'showGrid', label: 'Show grid', default: true },
  ],
  undo: { snapshotOn: ['state.change'], maxDepth: 50 },
  render: (ctx) => {
    const typed = ctx as RenderContext<GardenState, GardenConfig>;
    return (
      <WeaselProvider>
        <GardenBody config={typed.config} state={typed.state} setState={typed.setState} />
      </WeaselProvider>
    );
  },
});
