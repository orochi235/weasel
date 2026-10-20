import { describe, expect, it } from 'vitest';
import { createScene, type ActionDeps, type ImmediateInvoker, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from '../edge';
import { createSetHopsAction, SET_HOPS_ACTION_ID } from './hopsAction';
import { HOPS_DOC_KEY } from './types';

describe('the line jumps command', () => {
  it('turns hops on at its size and off again, each in one entry, and is active while on', () => {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
    const action = createSetHopsAction({ size: 7 });
    const deps = { scene } as unknown as ActionDeps;
    const run = () => (action.invoker as ImmediateInvoker).run(deps, undefined);
    expect(action.id).toBe(SET_HOPS_ACTION_ID);
    expect(action.active?.(deps)).toBe(false);
    const depth = scene.historyEntries().length;
    run();
    expect(scene.doc.get(HOPS_DOC_KEY)).toEqual({ size: 7 });
    expect(action.active?.(deps)).toBe(true);
    expect(scene.historyEntries().length).toBe(depth + 1);
    run();
    expect(scene.doc.get(HOPS_DOC_KEY)).toBeUndefined();
    expect(action.active?.(deps)).toBe(false);
    expect(scene.historyEntries().length).toBe(depth + 2);
  });
});
