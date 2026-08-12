import { describe, it, expect } from 'vitest';
import type { Action, ClaimableGesture, InvocationCtx, View } from '@weasel-js/core';
import { createHudContribution, HUD_AFFORDANCE_KIND } from './tool';
import { scopeBindings } from '@weasel-js/core';
import type { HudPointerEvent, Widget } from './widget';

function stubWidget(seen: HudPointerEvent[]): Widget {
  return {
    id: 'w',
    bounds: { x: 0, y: 0, w: 10, h: 10 },
    hidden: false,
    draw: () => [],
    hitTest: () => true,
    onPointer: (evt): void => { seen.push(evt); },
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
  const tool = createHudContribution() as unknown as { actions: Action[] };
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

describe('createHudContribution eligibility', () => {
  it('is live at ambient scope whatever tool is focused', () => {
    // The HUD floats over the active tool. Nothing here passes it in an
    // "ambient" slot — the entry's own declaration is what puts it there.
    const scoped = scopeBindings([createHudContribution()], {
      focusedId: 'rect',
      heldTriggers: new Set<string>(),
    });
    expect(scoped).toHaveLength(7);
    expect(new Set(scoped.map((s) => s.scope))).toEqual(new Set(['ambient']));
    expect(scoped.map((s) => s.binding.actionId)).toEqual([
      'hud.press', 'hud.release', 'hud.drag',
      'hud.doubleClick', 'hud.contextMenu', 'hud.longPress', 'hud.wheel',
    ]);
  });
});

describe('the non-pointer gestures', () => {
  const deps = { view: { get: () => VIEW } };
  const affordanceFor = (widget: Widget) => ({ kind: HUD_AFFORDANCE_KIND, payload: { widget } });

  /** World (0,0) under VIEW (x: -100, y: -50, scale 2) lands at screen (200, 100). */
  const SCREEN_OF_ORIGIN = { x: 200, y: 100 };

  function runImmediate(id: string, params: Record<string, unknown>): void {
    const invoker = actionById(id).invoker as { run(d: unknown, p: unknown): void };
    invoker.run(deps, params);
  }

  it.each([
    ['hud.doubleClick', 'doubleclick'],
    ['hud.contextMenu', 'contextmenu'],
    ['hud.longPress', 'longpress'],
  ])('%s delivers a %s at the converted screen point', (actionId, type) => {
    const seen: HudPointerEvent[] = [];
    const widget = stubWidget(seen);
    runImmediate(actionId, { worldX: 0, worldY: 0, affordance: affordanceFor(widget) });
    expect(seen).toEqual([{ type, ...SCREEN_OF_ORIGIN, native: null }]);
  });

  it('hud.wheel delivers canvas-local coords without a view conversion', () => {
    const seen: HudPointerEvent[] = [];
    const widget = stubWidget(seen);
    runImmediate('hud.wheel', {
      clientX: 12, clientY: 34, deltaX: 0, deltaY: 10, affordance: affordanceFor(widget),
    });
    expect(seen).toEqual([
      { type: 'wheel', x: 12, y: 34, deltaX: 0, deltaY: 10, native: null },
    ]);
  });

  it('every action ignores an affordance carrying no widget', () => {
    for (const id of ['hud.doubleClick', 'hud.contextMenu', 'hud.longPress', 'hud.wheel']) {
      expect(() => runImmediate(id, { worldX: 0, worldY: 0, clientX: 0, clientY: 0 })).not.toThrow();
    }
  });
});

describe('binding targets gate on the widget claim set', () => {
  function kindOfFor(specKind: string): (hit: unknown) => boolean {
    const binding = createHudContribution().bindings!.find((b) => b.spec.kind === specKind);
    if (!binding) throw new Error(`no binding for ${specKind}`);
    return (binding.spec as { target: { kindOf: (hit: unknown) => boolean } }).target.kindOf;
  }

  function hitFor(claims?: readonly ClaimableGesture[]): unknown {
    const widget = { ...stubWidget([]), ...(claims !== undefined ? { claims } : {}) };
    return { kind: HUD_AFFORDANCE_KIND, payload: { widget } };
  }

  it('binds all seven kinds', () => {
    expect(createHudContribution().bindings!.map((b) => b.spec.kind)).toEqual([
      'pointerDown', 'click', 'drag', 'doubleClick', 'contextMenu', 'longPress', 'wheel',
    ]);
  });

  it('a widget declaring nothing fails the wheel target and passes the rest', () => {
    expect(kindOfFor('wheel')(hitFor())).toBe(false);
    expect(kindOfFor('doubleClick')(hitFor())).toBe(true);
    expect(kindOfFor('contextMenu')(hitFor())).toBe(true);
    expect(kindOfFor('longPress')(hitFor())).toBe(true);
    expect(kindOfFor('drag')(hitFor())).toBe(true);
  });

  it('a widget that claims wheel passes it', () => {
    expect(kindOfFor('wheel')(hitFor(['pointer', 'wheel']))).toBe(true);
  });

  it('a widget that claims only pointer fails every other target', () => {
    expect(kindOfFor('pointerDown')(hitFor(['pointer']))).toBe(true);
    expect(kindOfFor('doubleClick')(hitFor(['pointer']))).toBe(false);
    expect(kindOfFor('contextMenu')(hitFor(['pointer']))).toBe(false);
  });

  it('declines a hit that is not the HUD layer', () => {
    expect(kindOfFor('drag')({ kind: 'handle:top-left' })).toBe(false);
    expect(kindOfFor('drag')(null)).toBe(false);
  });

  it('every target declares that it reads the affordance', () => {
    for (const b of createHudContribution().bindings!) {
      const kindOf = (b.spec as { target: { kindOf: { readsAffordance?: boolean } } }).target.kindOf;
      expect(kindOf.readsAffordance).toBe(true);
    }
  });
});
