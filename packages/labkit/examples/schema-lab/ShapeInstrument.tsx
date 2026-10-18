import { createScene, defaultNodeProperties, solid, strokeOf } from '@weasel-js/core';
import type { RectPose, Scene, Stroke, Fill } from '@weasel-js/core';
import { defineInstrument, f, hasConfigPath, type RenderContext, valueAtPath, withValueAtPath } from '@weasel-js/labkit';
import { prefSectionLeaves, type PrefSection } from '@weasel-js/prefs';
import { useEffect, useRef } from 'react';
import { SceneFrame } from './SceneHost';

/** weasel's published property schema for a `rect` node — the same one
 *  `<SelectionPanel>` reads. Nothing here is written by hand. */
const RECT_SCHEMA: PrefSection = defaultNodeProperties.find((e) => e.name === 'rect')!.schema;

/** The schema as the instrument's config: each value at the node path its leaf names, as the node stores it. */
const CONFIG = f.prefs(RECT_SCHEMA);

interface ShapeData {
  shape: 'rect';
  fill: Fill;
  stroke: Stroke;
}
type Config = Record<string, unknown>;

const FILL: Fill = { paint: solid('#7fb069') };
const STROKE: Stroke = strokeOf('#1c1c1c', 6);

/** Nested at each field's node path: labkit reads a dotted key as a path. */
export const START: Config = Object.entries({
  'pose.x': 120,
  'pose.y': 90,
  'pose.width': 260,
  'pose.height': 180,
  'data.fill': FILL,
  'data.stroke': STROKE,
}).reduce<Config>((config, [path, value]) => withValueAtPath(config, path, value), CONFIG.defaults());

export function buildScene(): Scene<ShapeData, 'default', RectPose> {
  return createScene<ShapeData, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      {
        kind: 'leaf',
        layer: 'default',
        pose: { x: 120, y: 90, width: 260, height: 180 },
        data: { shape: 'rect', fill: FILL, stroke: STROKE },
      },
    ],
  });
}

/** Push every config value onto the node path its schema leaf names. No field
 *  is handled by name — the schema says where each value goes, and the panel
 *  has already written it in the form the node stores. */
export function applyConfig(scene: Scene<ShapeData, 'default', RectPose>, config: Config): void {
  const id = scene.roots[0];
  const node = id ? scene.get(id) : undefined;
  if (!id || !node) return;
  let pose = { ...node.pose } as Record<string, unknown>;
  let data = { ...node.data } as Record<string, unknown>;
  for (const [path] of prefSectionLeaves(RECT_SCHEMA.members)) {
    if (!hasConfigPath(config, path)) continue;
    const [root, ...rest] = path.split('.');
    const value = valueAtPath(config, path);
    if (root === 'pose') pose = withValueAtPath(pose, rest.join('.'), value);
    else if (root === 'data') data = withValueAtPath(data, rest.join('.'), value);
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
  config: CONFIG,
  defaultConfig: () => ({ ...START }),
  initialState: () => ({}),
  render: (ctx) => <ShapeBody config={(ctx as RenderContext<Record<string, never>, Config>).config} />,
});
