import { createScene, defaultNodeProperties } from '@weasel-js/core';
import type { RectPose, Scene } from '@weasel-js/core';
import { defineInstrument, type RenderContext } from '@weasel-js/labkit';
import { useEffect, useRef } from 'react';
import { decodePrefValue, flattenPrefs, type PrefGroup, prefDefaults, prefsToFields, setAtPath } from './prefsToFields';
import { SceneFrame } from './SceneHost';

/** weasel's published property schema for a `rect` node — the same one
 *  `<SelectionPanel>` reads. Nothing here is written by hand. */
const RECT_SCHEMA: PrefGroup = defaultNodeProperties.find((e) => e.name === 'rect')!.schema;

interface ShapeData {
  shape: 'rect';
  fill: string;
  stroke: string;
  strokeWidth: number;
}
type Config = Record<string, unknown>;

const START: Config = {
  ...prefDefaults(RECT_SCHEMA),
  'pose.x': 120,
  'pose.y': 90,
  'pose.width': 260,
  'pose.height': 180,
  'data.fill': '#7fb069',
  'data.stroke': '#1c1c1c',
  'data.strokeWidth': 6,
};

function buildScene(): Scene<ShapeData, 'default', RectPose> {
  return createScene<ShapeData, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      {
        kind: 'leaf',
        layer: 'default',
        pose: { x: 120, y: 90, width: 260, height: 180 },
        data: { shape: 'rect', fill: '#7fb069', stroke: '#1c1c1c', strokeWidth: 6 },
      },
    ],
  });
}

/** Push every config key onto the node path its schema leaf names. No field
 *  is handled by name — the schema says where each value goes. */
function applyConfig(scene: Scene<ShapeData, 'default', RectPose>, config: Config): void {
  const id = scene.roots[0];
  const node = id ? scene.get(id) : undefined;
  if (!id || !node) return;
  const pose = { ...node.pose } as Record<string, unknown>;
  const data = { ...node.data } as Record<string, unknown>;
  for (const { path, leaf } of flattenPrefs(RECT_SCHEMA)) {
    if (!(path in config)) continue;
    const [root, ...rest] = path.split('.');
    const value = decodePrefValue(leaf, config[path]);
    if (root === 'pose') setAtPath(pose, rest, value);
    else if (root === 'data') setAtPath(data, rest, value);
  }
  scene.setPose(id, pose as unknown as RectPose);
  scene.update(id, { data: data as unknown as ShapeData });
}

function ShapeBody({ config }: { config: Config }) {
  const sceneRef = useRef<Scene<ShapeData, 'default', RectPose> | null>(null);
  if (sceneRef.current === null) sceneRef.current = buildScene();
  const scene = sceneRef.current;

  useEffect(() => {
    applyConfig(scene, config);
  }, [scene, config]);

  return <SceneFrame scene={scene} />;
}

export const ShapeInstrument = defineInstrument<Record<string, never>, Config>({
  name: 'ShapeProperties',
  defaultConfig: () => ({ ...START }),
  initialState: () => ({}),
  configSchema: () => prefsToFields(RECT_SCHEMA),
  render: (ctx) => <ShapeBody config={(ctx as RenderContext<Record<string, never>, Config>).config} />,
});
