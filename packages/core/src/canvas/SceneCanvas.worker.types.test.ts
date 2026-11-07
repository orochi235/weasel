import { describe, expect, it } from 'vitest';
import type { SceneCanvasProps } from './SceneCanvas';
import type { Scene } from 'core/scene/types';
import type { Animator } from '@weasel-js/animator';

type Props = SceneCanvasProps<unknown, string, unknown>;
const scene = null as unknown as Scene<unknown, string, unknown>;
const animator = null as unknown as Animator;
const worker = () => ({}) as Worker;

// Each line under an expect-error is a prop `<SceneCanvas worker>` cannot honor; the typecheck
// fails if any of them compiles.
const refused: Props[] = [
  // @ts-expect-error animations run in the worker
  { scene, worker, animator },
  // @ts-expect-error a worker canvas is not a tile of a shared buffer
  { scene, worker, paintInto: { canvas: null, x: 0, y: 0 } },
  // @ts-expect-error a worker canvas paints with WebGL 2
  { scene, worker, backend: 'webgpu' },
  // @ts-expect-error the worker module's drawOne paints
  { scene, worker, layers: { scene: { drawOne: () => [] } } },
  // @ts-expect-error a clock is for the worker's animator
  { scene, clock: { clock: { elapsed: 0, rate: 0, subscribe: () => () => {} }, onFrame: () => () => {} } },
];

const accepted: Props[] = [
  { scene, worker, alphaFor: () => 1, geometry: { picking: 'shape' }, layers: { scene: { cull: true, ghostAlpha: 0.5 } } },
  { scene, animator, geometry: { picking: 'pixels' } },
  // Picking by pixels walks the shapes where a worker's ids cannot be read at once.
  { scene, worker, geometry: { picking: 'pixels' } },
  { scene, backend: 'webgpu' },
];

describe('<SceneCanvas worker> props', () => {
  it('compiles only the props worker mode honors', () => {
    expect(refused).toHaveLength(5);
    expect(accepted).toHaveLength(4);
  });
});
