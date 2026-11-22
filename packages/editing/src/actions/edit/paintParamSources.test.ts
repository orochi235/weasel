import { describe, expect, it } from 'vitest';
import type { Action } from '@weasel-js/routing';
import { solid, solidStroke } from '@weasel-js/paint';
import { makeCtx, makeScene, ongoingInvoker } from './paintActionTestUtils';
import { setFillAction } from './setFill';
import { setStrokeAction } from './setStroke';
import { setStrokeWidthAction } from './setStrokeWidth';

const gradient = {
  kind: 'linear-gradient' as const,
  from: { x: 0, y: 0 },
  to: { x: 10, y: 0 },
  stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
  units: 'local' as const,
};

function run(action: Action, invocation: Record<string, unknown>, binding: Record<string, unknown>, moves: Record<string, unknown>[] = []) {
  const scene = makeScene({ a: { fill: { paint: solid('#336699ff') }, stroke: solidStroke('#00ff00ff', 3) } });
  const ctx = makeCtx({ selectionIds: ['a'], scene, params: invocation });
  const h = ongoingInvoker(action).start(ctx, { params: binding });
  for (const params of moves) h.onMove?.({ ...ctx, params });
  h.onEnd?.(ctx, 'commit');
  return scene.get('a' as never)!.data as Record<string, unknown>;
}

describe("a color paint action's params from the invocation and the binding", () => {
  it("setFill takes the invocation's color over the binding's paint", () => {
    expect(run(setFillAction, { color: '#ff0000ff' }, { paint: gradient }).fill).toEqual({ paint: solid('#ff0000ff') });
  });

  it("setStroke takes the invocation's color over the binding's None", () => {
    expect(run(setStrokeAction, { color: '#ff0000ff' }, { paint: null }).stroke).toEqual(solidStroke('#ff0000ff', 3));
  });

  it('setFill ignores a color that is not a string', () => {
    expect(run(setFillAction, { color: '#ff0000ff' }, {}, [{ color: null }, { color: 7 }]).fill).toEqual({ paint: solid('#ff0000ff') });
  });

  it('setStroke ignores a color that is not a string at start', () => {
    expect(run(setStrokeAction, { color: 7 }, { color: '#0000ffff' }).stroke).toEqual(solidStroke('#0000ffff', 3));
  });
});

describe("a selected 'inherit' child of a selected container", () => {
  function commit(action: Action, params: Record<string, unknown>) {
    const scene = makeScene(
      { g: { fill: { paint: solid('#ff0000ff') }, stroke: solidStroke('#ff0000ff', 2) }, c: { fill: 'inherit', stroke: 'inherit' } },
      { c: 'g' },
    );
    const ctx = makeCtx({ selectionIds: ['g', 'c'], scene, params });
    const h = ongoingInvoker(action).start(ctx, { params });
    const previewed = h.previewIds?.() ?? [];
    h.onEnd?.(ctx, 'commit');
    return { g: scene.get('g' as never)!.data as Record<string, unknown>, c: scene.get('c' as never)!.data as Record<string, unknown>, previewed };
  }

  it('setFill leaves it inheriting the container’s new fill, and previews it', () => {
    const { g, c, previewed } = commit(setFillAction, { color: '#0000ffff' });
    expect(g.fill).toEqual({ paint: solid('#0000ffff') });
    expect(c.fill).toBe('inherit');
    expect(previewed).toContain('c');
  });

  it('setStrokeWidth leaves it inheriting the container’s new stroke', () => {
    const { g, c } = commit(setStrokeWidthAction, { width: 5 });
    expect(g.stroke).toEqual(solidStroke('#ff0000ff', 5));
    expect(c.stroke).toBe('inherit');
  });
});
