import {
  SceneCanvas,
  WeaselProvider,
  createScene,
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

interface StubState {
  scene: SerializedSceneJSON | null;
}
interface StubConfig {
  showGrid: boolean;
}

const UNITS: UnitSystem = { base: 'px', units: { px: 1 } };
const SYSTEM_LAYERS = [{ id: 'default' as const }];
const INITIAL_NODES: readonly AddNodeSpec<NodeData, LayerId, Pose>[] = [
  {
    kind: 'leaf',
    layer: 'default',
    pose: { x: 120, y: 80, width: 120, height: 80 },
    data: { color: '#7fb069' },
  },
];

function buildScene(json: SerializedSceneJSON | null): Scene<NodeData, LayerId, Pose> {
  if (json) return sceneFromJSON<NodeData, LayerId, Pose>(json, {});
  return createScene<NodeData, LayerId, Pose>({
    systemLayers: SYSTEM_LAYERS,
    initial: INITIAL_NODES,
  });
}

interface BodyProps {
  config: StubConfig;
  state: StubState;
  setState: (next: StubState | ((prev: StubState) => StubState)) => void;
}

function Body({ config, state, setState }: BodyProps) {
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
          layers={layers}
        />
      </div>
    </div>
  );
}

export const StubInstrument = defineInstrument<StubState, StubConfig>({
  name: 'Stub',
  defaultConfig: () => ({ showGrid: true }),
  initialState: () => ({ scene: null }),
  configSchema: () => [
    { key: 'showGrid', label: 'Show grid', type: 'checkbox', default: true },
  ],
  undo: { snapshotOn: ['state.change'], maxDepth: 50 },
  render: (ctx) => {
    const typed = ctx as RenderContext<StubState, StubConfig>;
    return (
      <WeaselProvider>
        <Body config={typed.config} state={typed.state} setState={typed.setState} />
      </WeaselProvider>
    );
  },
});
