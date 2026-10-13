/** The three-layer scene, node data, and pose the `scene.*` tests share. */

import { createScene } from '../scene';
import type { Scene } from '../types';

export type Layer = 'background' | 'structures' | 'plantings';
export interface Data { label: string }

export const POSE = { x: 0, y: 0, width: 10, height: 10 };

export function makeScene(): Scene<Data, Layer> {
  return createScene<Data, Layer>({
    systemLayers: [
      { id: 'background' },
      { id: 'structures' },
      { id: 'plantings' },
    ],
  });
}
