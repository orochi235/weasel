import { describe, expect, it } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core/engine';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { actionItems } from '@weasel-js/routing';
import { swapAction } from './action';

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

function setup() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
  const b = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(50, 0) });
  const c = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(100, 0) });
  const wide = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(150, 0, 30) });
  let selected: string[] = [];
  const deps = { scene, operands: { get: () => selected } } as unknown as ActionDeps;
  return { scene, a, b, c, wide, deps, select: (...ids: string[]) => { selected = ids; } };
}

const run = (deps: ActionDeps) => (swapAction.invoker as ImmediateInvoker).run(deps, {});

describe('swapAction', () => {
  it('is enabled for exactly two nodes that may trade places', () => {
    const { a, b, c, wide, deps, select } = setup();
    expect(swapAction.enabled!(deps)).not.toBe(true);
    select(a);
    expect(swapAction.enabled!(deps)).not.toBe(true);
    select(a, b);
    expect(swapAction.enabled!(deps)).toBe(true);
    select(a, b, c);
    expect(swapAction.enabled!(deps)).not.toBe(true);
    select(a, wide);
    expect(swapAction.enabled!(deps)).not.toBe(true);
  });

  it('asks the canSwap dep', () => {
    const { a, wide, deps, select } = setup();
    select(a, wide);
    expect(swapAction.enabled!({ ...deps, canSwap: () => true })).toBe(true);
  });

  it('trades the two places in one undo step labeled Swap', () => {
    const { scene, a, b, deps, select } = setup();
    select(a, b);
    const before = scene.historyEntries().length;
    run(deps);
    expect(scene.get(a)!.pose).toEqual(box(50, 0));
    expect(scene.get(b)!.pose).toEqual(box(0, 0));
    expect(scene.historyEntries().length).toBe(before + 1);
    expect(scene.historyEntries().at(-1)?.label).toBe('Swap');
  });

  it('does nothing for a pair it is disabled for', () => {
    const { scene, a, wide, deps, select } = setup();
    select(a, wide);
    const before = scene.historyEntries().length;
    run(deps);
    expect(scene.historyEntries().length).toBe(before);
  });

  it('is one entry with editing’s swap glyph', () => {
    expect(actionItems(swapAction).map((i) => [i.key, i.icon])).toEqual([['swap', 'editing:swap']]);
  });
});
