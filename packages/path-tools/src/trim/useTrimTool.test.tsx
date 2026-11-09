import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { matchSpec, type InputEvent } from '@weasel-js/gestures';
import { pathFromD } from '@weasel-js/geom';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { asNodeId } from '@weasel-js/core';
import { useTrimTool } from './useTrimTool';

const NO_MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

function setup() {
  const paths = { line: 'M0 0 H30', w1: 'M10 -10 V10', w2: 'M20 -10 V10' };
  const nodes = new Map(Object.entries(paths).map(([id, d]) => [id, {
    id: asNodeId(id), kind: 'mark', layer: 'main', pose: pathFromD(d), data: {}, parent: null,
  }]));
  const scene = {
    get: (id: string) => nodes.get(id),
    childrenOf: () => [],
    getVersion: () => 1,
    renderOrderNodes: () => [...nodes.values()],
  };
  const deps = { scene, view: { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }) } } as never;
  const { result } = renderHook(() => useTrimTool());
  const tool = result.current;
  /** Run every binding the event matches, as the dispatcher runs every live hover. */
  const dispatch = (e: InputEvent) => {
    for (const b of tool.bindings ?? []) {
      if (!matchSpec(e, b.spec, true)) continue;
      const action = tool.actions?.find((a) => a.id === b.actionId);
      (action?.invoker as ImmediateInvoker | undefined)?.run(deps, { world: { x: e.x, y: e.y } } as never);
    }
  };
  const drawn = () => tool.overlay!.draw(null, { x: 0, y: 0, scale: { x: 1, y: 1 } } as never, { width: 0, height: 0, dpr: 1 } as never);
  return { dispatch, drawn };
}

describe('useTrimTool', () => {
  it('clears the piece it previews when the pointer leaves the canvas', () => {
    const t = setup();
    t.dispatch({ kind: 'hover', x: 15, y: 1, clientX: 15, clientY: 1, bodyTarget: 'empty', ...NO_MODS } as InputEvent);
    expect(t.drawn()).toHaveLength(1);
    t.dispatch({
      kind: 'hover', off: true, x: 15, y: 1, clientX: 15, clientY: 1, bodyTarget: 'empty', ...NO_MODS,
      from: { bodyTarget: 'empty' },
    } as InputEvent);
    expect(t.drawn()).toEqual([]);
  });
});
