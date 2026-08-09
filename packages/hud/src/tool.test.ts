import { describe, it, expect } from 'vitest';
import type { Action, InvocationCtx, View } from '@weasel-js/core';
import { createHudTool, HUD_AFFORDANCE_KIND } from './tool';
import type { HudPointerEvent, PointerClaim, Widget } from './widget';

function stubWidget(seen: HudPointerEvent[]): Widget {
  return {
    id: 'w',
    bounds: { x: 0, y: 0, w: 10, h: 10 },
    hidden: false,
    draw: () => [],
    hitTest: () => true,
    onPointer: (evt): PointerClaim => { seen.push(evt); return 'claim'; },
    dispose: () => {},
  };
}

const VIEW: View = { x: -100, y: -50, scale: { x: 2, y: 2 } };

function ctx(over: Partial<InvocationCtx>): InvocationCtx {
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {},
    ...over,
  } as InvocationCtx;
}

function actionById(id: string): Action {
  const tool = createHudTool() as unknown as { actions: Action[] };
  const found = tool.actions.find((a) => a.id === id);
  if (!found) throw new Error(`no action ${id}`);
  return found;
}

describe('hud.drag', () => {
  it('converts move/end world points with the view captured at start', () => {
    const seen: HudPointerEvent[] = [];
    const widget = stubWidget(seen);
    const deps = { view: { get: () => VIEW } };
    const start = actionById('hud.drag').invoker as {
      start(c: InvocationCtx): {
        onMove?(c: InvocationCtx): void;
        onEnd?(c: InvocationCtx, reason: 'commit' | 'cancel'): void;
      };
    };

    const handle = start.start(ctx({
      deps,
      drag: {
        start: { x: 0, y: 0 },
        current: { x: 0, y: 0 },
        delta: { x: 0, y: 0 },
        affordance: { kind: HUD_AFFORDANCE_KIND, payload: { widget } },
      },
    } as Partial<InvocationCtx>));

    // The dispatcher builds every move/end pump ctx with an empty dep bag.
    handle.onMove?.(ctx({ world: { x: 0, y: 0 } }));
    handle.onEnd?.(ctx({ world: { x: 50, y: 25 } }), 'commit');

    expect(seen).toEqual([
      { type: 'move', x: 200, y: 100, native: null },
      { type: 'up', x: 300, y: 150, native: null },
    ]);
  });
});
