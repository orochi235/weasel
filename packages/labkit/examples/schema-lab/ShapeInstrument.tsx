import { createScene, defaultNodeProperties, solid, strokeOf } from '@weasel-js/core';
import type { FillStyle, RectPose, Scene, Stroke } from '@weasel-js/core';
import { defineInstrument, hasConfigPath, type RenderContext, valueAtPath, withValueAtPath } from '@weasel-js/labkit';
import { useEffect, useRef } from 'react';
import { decodePrefValue, flattenPrefs, type PrefGroup, prefDefaults, prefsToFields, setAtPath } from './prefsToFields';
import { SceneFrame } from './SceneHost';

/** weasel's published property schema for a `rect` node — the same one
 *  `<SelectionPanel>` reads. Nothing here is written by hand. */
const RECT_SCHEMA: PrefGroup = defaultNodeProperties.find((e) => e.name === 'rect')!.schema;

interface ShapeData {
  shape: 'rect';
  fill: FillStyle;
  stroke: Stroke;
}
type Config = Record<string, unknown>;

/** Nested at each field's node path: labkit reads a dotted key as a path. */
export const START: Config = Object.entries({
  'pose.x': 120,
  'pose.y': 90,
  'pose.width': 260,
  'pose.height': 180,
  'data.stroke.width': 6,
}).reduce<Config>((config, [path, value]) => withValueAtPath(config, path, value), prefDefaults(RECT_SCHEMA));

export function buildScene(): Scene<ShapeData, 'default', RectPose> {
  return createScene<ShapeData, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      {
        kind: 'leaf',
        layer: 'default',
        pose: { x: 120, y: 90, width: 260, height: 180 },
        data: { shape: 'rect', fill: solid('#7fb069'), stroke: strokeOf('#1c1c1c', 6) },
      },
    ],
  });
}

/** Push every config key onto the node path its schema leaf names. No field
 *  is handled by name — the schema says where each value goes. */
export function applyConfig(scene: Scene<ShapeData, 'default', RectPose>, config: Config): void {
  const id = scene.roots[0];
  const node = id ? scene.get(id) : undefined;
  if (!id || !node) return;
  const pose = { ...node.pose } as Record<string, unknown>;
  const data = { ...node.data } as Record<string, unknown>;
  for (const { path, leaf } of flattenPrefs(RECT_SCHEMA)) {
    if (!hasConfigPath(config, path)) continue;
    const [root, ...rest] = path.split('.');
    const target = root === 'pose' ? pose : root === 'data' ? data : undefined;
    if (!target) continue;
    const siblings = rest.length > 1 ? valueAtPath(target, rest.slice(0, -1).join('.')) : undefined;
    const value = decodePrefValue(leaf, valueAtPath(config, path), siblings as Record<string, unknown> | undefined);
    setAtPath(target, rest, value);
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
