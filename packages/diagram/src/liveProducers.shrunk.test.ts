import { describe, expect, it } from 'vitest';
import type { RectPose } from '@weasel-js/core';
import { graphOf } from './graph';
import { easedProducer } from './liveProducers';

const one = (x: number, y: number) => graphOf([{ id: 'a', bounds: { x, y, width: 0, height: 0 }, pinned: false }], []);

describe('easedProducer, shrunk', () => {
  it('lands on a target 5e-324 from where 10 - 10 would round it', () => {
    const produce = easedProducer<RectPose>(one(0, 10), () => new Map([['a', { x: 0, y: 5e-324 }]]), { frames: 1 });
    expect(produce({ pinned: new Map(), frame: 0 }).result.get('a')).toEqual({ x: 0, y: 5e-324 });
  });

  it('stays finite walking from one end of the double range to the other', () => {
    const produce = easedProducer<RectPose>(one(-Number.MAX_VALUE, 0), () => new Map([['a', { x: Number.MAX_VALUE, y: 0 }]]), { frames: 4 });
    expect(Number.isFinite(produce({ pinned: new Map(), frame: 1 }).result.get('a')!.x)).toBe(true);
  });
});
