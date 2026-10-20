/** Test fixture for the lanes look, shared by its tests. */
import { diagramScene } from '../fromData';
import { lanes } from './lanes';
import { io, w } from './skipFixture';
import type { EffectPipeline } from './types';

/** An image chain with a quality check, a blur steered by a control number,
 *  and a composite that also reads a mask. */
export const P: EffectPipeline = {
  types: { number: { control: true } },
  stages: [
    io('src', { kind: 'source', inputs: [] }),
    { id: 'q', title: 'high?', kind: 'decision', inputs: [{ id: 'in', type: 'image' }],
      outputs: [{ id: 'yes', type: 'image' }, { id: 'no', type: 'image' }] },
    io('blur', { inputs: [{ id: 'in', type: 'image' }, { id: 'radius', type: 'number' }], params: [{ label: 'radius', value: '6 px' }] }),
    io('mix', { inputs: [{ id: 'base', type: 'image' }, { id: 'over', type: 'image' }, { id: 'mask', type: 'mask' }] }),
    io('out', { kind: 'sink', outputs: [] }),
    { id: 'osc', title: 'Oscillator', outputs: [{ id: 'value', type: 'number' }] },
    { id: 'cut', title: 'Mask', outputs: [{ id: 'out', type: 'mask' }] },
  ],
  wires: [
    w(['src', 'out'], ['q', 'in']), w(['q', 'yes'], ['blur', 'in']), w(['q', 'no'], ['mix', 'base']),
    w(['blur', 'out'], ['mix', 'over']), w(['mix', 'out'], ['out', 'in']), w(['osc', 'value'], ['blur', 'radius']),
    w(['cut', 'out'], ['mix', 'mask']),
  ],
  groups: [{ id: 'g', label: 'Soften', members: ['blur'] }],
};

export type Box = { x: number; y: number; width: number; height: number };
/** The lanes look of `p`, its scene, and the pose of any node in it. */
export const built = (p: EffectPipeline, options?: Parameters<typeof lanes>[1]) => {
  const drawn = lanes(p, options);
  const specs = diagramScene(drawn.data, drawn.scene);
  const box = (id: string) => specs.find((s) => s.id === id)!.pose as Box;
  return { drawn, specs, box };
};
