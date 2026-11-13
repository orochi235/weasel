import { createScene, pathFromD } from '@weasel-js/core';
import type { Path, RectPose, Scene, Stroke } from '@weasel-js/core';
import { defineInstrument, f, type RenderContext } from '@weasel-js/labkit';
import { useEffect, useRef } from 'react';
import { SceneFrame } from './SceneHost';

/** Zigzag with a deliberately acute spike on the right, so `join` and
 *  `miterLimit` both have something to act on. */
const ZIGZAG: Path = pathFromD(
  'M 40 250 L 110 120 L 180 250 L 250 120 L 320 250 M 380 250 L 402 110 L 424 250',
);

/** `data.stroke` takes a whole `Stroke`, so the built-in `kit:path` painter
 *  draws every field the panel edits — no painter of our own. */
interface StrokeData {
  path: Path;
  fill: null;
  stroke: Stroke;
}

const DASHES: Record<string, number[] | undefined> = {
  solid: undefined,
  dashed: [24, 16],
  dotted: [1, 18],
  'dash-dot': [30, 12, 4, 12],
};

/** Hand-written from `Stroke` in `@weasel-js/core` (paint-types.ts). Two of its
 *  fields have no control kind to map onto: `paint` is a `Paint` union, and
 *  `dash` is a `number[]` — a preset list stands in for the latter. */
const STROKE_SCHEMA = f.schema({
  color: f.color('#a48bd4').label('Paint'),
  width: f.number(18).range(1, 48).step(1),
  cap: f.enum('butt', [
    { value: 'butt', label: 'Butt' },
    { value: 'round', label: 'Round' },
    { value: 'square', label: 'Square' },
  ]),
  join: f.enum('miter', [
    { value: 'miter', label: 'Miter' },
    { value: 'round', label: 'Round' },
    { value: 'bevel', label: 'Bevel' },
  ]),
  miterLimit: f.number(4).range(1, 20).step(0.5).label('Miter limit'),
  dash: f.enum('solid', [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' },
    { value: 'dash-dot', label: 'Dash-dot' },
  ]),
  align: f.enum('center', [
    { value: 'center', label: 'Center' },
    { value: 'inner', label: 'Inner' },
    { value: 'outer', label: 'Outer' },
  ]),
});

interface StrokeConfig {
  color: string;
  width: number;
  cap: 'butt' | 'round' | 'square';
  join: 'miter' | 'round' | 'bevel';
  miterLimit: number;
  dash: string;
  align: 'center' | 'inner' | 'outer';
}

function strokeFromConfig(c: StrokeConfig): Stroke {
  return {
    paint: { color: c.color },
    width: c.width,
    cap: c.cap,
    join: c.join,
    miterLimit: c.miterLimit,
    align: c.align,
    ...(DASHES[c.dash] ? { dash: DASHES[c.dash] } : {}),
  };
}

function buildScene(config: StrokeConfig): Scene<StrokeData, 'default', RectPose> {
  return createScene<StrokeData, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      {
        kind: 'mark',
        layer: 'default',
        pose: { x: 40, y: 110, width: 384, height: 140 },
        data: { path: ZIGZAG, fill: null, stroke: strokeFromConfig(config) },
      },
    ],
  });
}

function StrokeBody({ config }: { config: StrokeConfig }) {
  const sceneRef = useRef<Scene<StrokeData, 'default', RectPose> | null>(null);
  if (sceneRef.current === null) sceneRef.current = buildScene(config);
  const scene = sceneRef.current;

  useEffect(() => {
    const id = scene.roots[0];
    const node = id ? scene.get(id) : undefined;
    if (!id || !node) return;
    scene.update(id, { data: { ...node.data, stroke: strokeFromConfig(config) } });
  }, [scene, config]);

  return <SceneFrame scene={scene} />;
}

export const StrokeInstrument = defineInstrument<Record<string, never>, StrokeConfig>({
  name: 'Stroke',
  config: STROKE_SCHEMA,
  initialState: () => ({}),
  render: (ctx) => <StrokeBody config={(ctx as RenderContext<Record<string, never>, StrokeConfig>).config} />,
});
