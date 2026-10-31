import { createScene, pathFromD, type RectPose, type Scene } from '@weasel-js/core';

/** A scene touching the main paint paths: solid and gradient fills, strokes, a curved path, and a
 *  translucent fill over a transparent background, which the readback has to unpremultiply. */
export function fixtureScene(): Scene<unknown, 'main', RectPose> {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    kind: 'mark', layer: 'main', pose: { x: 4, y: 4, width: 40, height: 28 },
    data: { shape: 'rect', fill: { paint: { color: '#d03030' } } },
  });
  scene.add({
    kind: 'mark', layer: 'main', pose: { x: 30, y: 12, width: 50, height: 36 },
    data: {
      shape: 'ellipse',
      fill: {
        paint: {
          kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, units: 'bounds',
          stops: [{ offset: 0, color: '#2060ff' }, { offset: 1, color: '#20d090' }],
        },
      },
      stroke: { paint: { color: '#101820' }, width: 2 },
    },
  });
  scene.add({
    kind: 'mark', layer: 'main', pose: { x: 6, y: 34, width: 30, height: 26 },
    data: { shape: 'star', points: 5, fill: { paint: { color: '#f0c020' } }, stroke: { paint: { color: '#603000' }, width: 1.5 } },
  });
  scene.add({
    kind: 'mark', layer: 'main', pose: { x: 40, y: 40, width: 50, height: 20 },
    data: {
      path: pathFromD('M0 20 C10 -10 40 30 50 0'),
      stroke: { paint: { color: '#8020c0' }, width: 3 },
    },
  });
  scene.add({
    kind: 'mark', layer: 'main', pose: { x: 50, y: 2, width: 40, height: 30 },
    data: { shape: 'rect', fill: { paint: { color: '#00a0ff80' } } },
  });
  return scene;
}

/** The fixture's render: a 96 × 64 rect at an anisotropic scale, so curves flatten per axis. */
export const FIXTURE_RENDER = {
  sourceRect: { x: 0, y: 0, width: 96, height: 64 },
  scale: { x: 1.5, y: 1.25 },
} as const;
