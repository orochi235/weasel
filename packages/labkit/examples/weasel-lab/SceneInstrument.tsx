import {
  SceneCanvas,
  WeaselProvider,
  createScene,
  gridSnapStrategy,
  sceneFromJSON,
  useSelection,
} from '@orochi235/weasel';
import type {
  AddNodeSpec,
  RectPose,
  Scene,
  SerializedScene,
  UnitSystem,
} from '@orochi235/weasel';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { defineInstrument, type RenderContext } from '@lab-kit/react';

interface NodeData {
  color: string;
}
type Pose = RectPose;
type LayerId = 'default';

type SerializedSceneJSON = SerializedScene<NodeData, LayerId, Pose>;

interface SceneState {
  scene: SerializedSceneJSON | null;
}
interface SceneConfig {
  cellSize: number;
  showGrid: boolean;
}

const UNITS: UnitSystem = { base: 'px', units: { px: 1 } };

const INITIAL_NODES: readonly AddNodeSpec<NodeData, LayerId, Pose>[] = [
  {
    kind: 'leaf',
    layer: 'default',
    pose: { x: 40, y: 40, width: 80, height: 60 },
    data: { color: '#7fb069' },
  },
  {
    kind: 'leaf',
    layer: 'default',
    pose: { x: 180, y: 120, width: 100, height: 80 },
    data: { color: '#d4a574' },
  },
  {
    kind: 'leaf',
    layer: 'default',
    pose: { x: 340, y: 60, width: 70, height: 70 },
    data: { color: '#a48bd4' },
  },
];

const SYSTEM_LAYERS = [{ id: 'default' as const }];

function buildScene(json: SerializedSceneJSON | null): Scene<NodeData, LayerId, Pose> {
  if (json) return sceneFromJSON<NodeData, LayerId, Pose>(json, {});
  return createScene<NodeData, LayerId, Pose>({
    systemLayers: SYSTEM_LAYERS,
    initial: INITIAL_NODES,
  });
}

interface SceneBodyProps {
  config: SceneConfig;
  state: SceneState;
  setState: (next: SceneState | ((prev: SceneState) => SceneState)) => void;
}

function SceneBody({ config, state, setState }: SceneBodyProps) {
  // Scene held in a ref so we can swap it on external state changes (Reset)
  // without going through React state (which would cause cascade renders).
  const sceneRef = useRef<Scene<NodeData, LayerId, Pose> | null>(null);
  if (sceneRef.current === null) sceneRef.current = buildScene(state.scene);

  // The most-recent JSON we ourselves pushed up to labkit. Used to detect
  // when state.scene was changed by someone else (Reset / Clone hydration /
  // undo) so we can rebuild the underlying weasel scene.
  const lastPushedRef = useRef<SerializedSceneJSON | null>(state.scene);

  // Force a re-render after rebuilding the scene (the ref swap is invisible
  // to React). useSyncExternalStore below handles the *internal* mutations.
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (state.scene === lastPushedRef.current) return; // we wrote it; ignore
    // External change → rebuild scene.
    sceneRef.current = buildScene(state.scene);
    lastPushedRef.current = state.scene;
    forceRender((n) => n + 1);
  }, [state.scene]);

  const scene = sceneRef.current;

  // Subscribe React to internal scene mutations (drag/resize/etc).
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  // Push scene mutations up to labkit state so persistence/clone capture them.
  useEffect(() => {
    return scene.subscribe(() => {
      const json = scene.toJSON();
      lastPushedRef.current = json;
      setState((prev) => ({ ...prev, scene: json }));
    });
  }, [scene, setState]);

  const selection = useSelection();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
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

  const selectTool = useMemo(
    () => ({ snap: gridSnapStrategy<Pose>({ value: config.cellSize, unit: 'px' }, UNITS) }),
    [config.cellSize],
  );

  const layers = useMemo(
    () => ({
      grid: config.showGrid
        ? {
            spacing: { value: config.cellSize, unit: 'px' as const },
            unitSystem: UNITS,
            bounds: () => ({ x: 0, y: 0, width: 2000, height: 2000 }),
            accentEvery: 5,
          }
        : null,
      scene: {},
      selectionOverlay: { handles: true },
    }),
    [config.showGrid, config.cellSize],
  );

  return (
    <div
      ref={containerRef}
      className="lk-weasel-host"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        <SceneCanvas
          width={size.w}
          height={size.h}
          scene={scene}
          selection={selection}
          selectTool={selectTool}
          layers={layers}
        />
      </div>
    </div>
  );
}

export const SceneInstrument = defineInstrument<SceneState, SceneConfig>({
  name: 'WeaselScene',
  defaultConfig: () => ({ cellSize: 20, showGrid: true }),
  initialState: () => ({ scene: null }),
  configSchema: () => [
    { type: 'checkbox', key: 'showGrid', label: 'Show grid', default: true },
    {
      type: 'slider',
      key: 'cellSize',
      label: 'Grid spacing',
      min: 5,
      max: 80,
      step: 5,
      default: 20,
    },
  ],
  undo: { snapshotOn: ['state.change'], maxDepth: 50 },
  render: (ctx) => {
    const typed = ctx as RenderContext<SceneState, SceneConfig>;
    return (
      <WeaselProvider>
        <SceneBody config={typed.config} state={typed.state} setState={typed.setState} />
      </WeaselProvider>
    );
  },
});
