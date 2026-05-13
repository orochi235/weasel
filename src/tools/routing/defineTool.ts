// src/tools/routing/defineTool.ts
import type { Tool, ToolCtx, ToolModifiers } from '../types';
import type { ToolDef, PhaseDef, ActionFn } from './types';
import type { Result, BeginSpec } from './result';
import { resolveRoute } from './lookup';
import { mods, type ModifierKey } from './modifiers';
import type {
  RouteResolvedInfo,
  RoutePhase,
  RouteGesture,
} from './reflection/route-resolved';

/** Translate a declarative `ToolDef<TScratch>` into the existing imperative
 *  `Tool<TScratch>` shape. The dispatcher consumes the resulting Tool as
 *  it does today; declarative authoring is the only change. */
export function defineTool<TScratch = void>(
  def: ToolDef<TScratch>,
): Tool<TScratch> {
  // Stores the active BeginSpec between gesture events. The factory
  // closure is per-tool-instance, and a tool can have at most one active
  // gesture at a time, so a single mutable slot is sufficient. We can't
  // key off ctx identity because the dispatcher spreads a fresh ctx
  // object (`{ ...base, scratch }`) on every pointer event — a
  // WeakMap<ctx, …> would always miss on onMove/onEnd.
  let activeSpec: BeginSpec<TScratch> | null = null;

  // Phase state derives from ctx.scratch presence: scratch !== null means
  // engaged. The translated handlers consult def.engaged when scratch is
  // set, def.initial otherwise.
  const phaseOf = (ctx: ToolCtx<TScratch>): PhaseDef<TScratch> => {
    return ctx.scratch != null && def.engaged ? def.engaged : def.initial;
  };

  // Which phase the resolution belongs to — `initial` vs `engaged` —
  // mirrors phaseOf but yields the spec's vocabulary string for the
  // reflection callback rather than the PhaseDef object.
  const phaseNameOf = (ctx: ToolCtx<TScratch>): RoutePhase => {
    return ctx.scratch != null && def.engaged ? 'engaged' : 'initial';
  };

  // Translate a ToolModifiers runtime snapshot to the canonical
  // ModifierKey string used in route sub-tables. Kept local because the
  // helper in lookup.ts is module-private and the reflection callback is
  // the only consumer outside it.
  const modifiersToCanonicalKey = (m: ToolModifiers): ModifierKey => {
    const active: Array<'mod' | 'shift' | 'alt'> = [];
    if (m.meta || m.ctrl) active.push('mod');
    if (m.shift) active.push('shift');
    if (m.alt) active.push('alt');
    return mods(...active);
  };

  // Emit a RouteResolvedInfo snapshot through the dispatcher-supplied
  // reporter. No-op when the dispatcher hasn't wired __reportRoute (e.g.
  // bare-bones test harnesses).
  const report = (
    ctx: ToolCtx<TScratch>,
    phase: RoutePhase,
    gesture: RouteGesture,
    matchedKey: string,
  ): void => {
    const info: RouteResolvedInfo = {
      toolId: def.id,
      phase,
      gesture,
      matchedKey,
      modifiers: modifiersToCanonicalKey(ctx.modifiers),
      target: ctx.target ?? { category: 'empty', kind: 'empty' },
      timestamp: performance.now(),
    };
    ctx.__reportRoute?.(info);
  };

  // Apply a Result by mutating ctx and/or dispatching ops. Returns the
  // dispatch decision ('claim' or 'pass') based on whether the handler
  // produced an effect.
  const applyResult = (
    ctx: ToolCtx<TScratch>,
    result: Result<TScratch> | void,
  ): 'claim' | 'pass' => {
    if (result == null) return 'pass';
    switch (result.kind) {
      case 'apply':
        ctx.applyOps(result.ops, result.label as string);
        return 'claim';
      case 'begin': {
        // Open engaged: install scratch and stash continuation closures
        // in activeSpec so they survive across pointer events.
        (ctx as { scratch: unknown }).scratch = result.spec.scratch;
        activeSpec = result.spec;
        return 'claim';
      }
      case 'hold':
        // Update scratch; activeSpec stays so continuations remain wired.
        (ctx as { scratch: unknown }).scratch = result.scratch;
        return 'claim';
      case 'commit':
        ctx.applyOps(result.ops, result.label as string);
        (ctx as { scratch: unknown }).scratch = null;
        activeSpec = null;
        return 'claim';
      case 'cancel':
        (ctx as { scratch: unknown }).scratch = null;
        activeSpec = null;
        return 'claim';
      case 'claim':
        return 'claim';
      case 'none':
        return 'pass';
    }
  };

  // Build pointer.onClick handler from click route table.
  const onClick = def.initial.click || def.engaged?.click
    ? (_e: PointerEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
        const phase = phaseOf(ctx);
        if (!phase.click) return 'pass';
        if (!ctx.target) return 'pass';
        // Primary lookup: four-level target precedence via resolveRoute.
        let match = resolveRoute(phase.click, ctx.target, ctx.modifiers);
        // Universal fallback: '*' matches any hit type (including empty) when
        // no more-specific route was found. The lookup engine excludes empty
        // hits from '*' to prevent accidental catch-alls; here the factory
        // re-checks explicitly so engaged-phase catch-alls like { '*': addAnchor }
        // respond to background clicks as intended by the tool author.
        if (!match && ctx.target.category === 'empty') {
          const star = phase.click['*'];
          if (typeof star === 'function') match = { action: star, matchedKey: '*' };
        }
        if (!match) return 'pass';
        report(ctx, phaseNameOf(ctx), 'click', match.matchedKey);
        return applyResult(ctx, match.action(ctx, _e));
      }
    : undefined;

  // Build pointer.onDown handler from pointerDown route table. Mirrors
  // onClick but runs at pointerdown (pre-threshold). Returns 'pass' for
  // unrouted targets and for routes that return none(), so the
  // dispatcher can continue to its threshold-gated click vs. drag
  // classification.
  const onDown = def.initial.pointerDown || def.engaged?.pointerDown
    ? (_e: PointerEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
        const phase = phaseOf(ctx);
        if (!phase.pointerDown) return 'pass';
        if (!ctx.target) return 'pass';
        let match = resolveRoute(phase.pointerDown, ctx.target, ctx.modifiers);
        // Universal fallback for empty hits — mirrors onClick semantics
        // so engaged-phase '*' routes (e.g. pen's empty-canvas anchor
        // add) respond to pointerdown on background.
        if (!match && ctx.target.category === 'empty') {
          const star = phase.pointerDown['*'];
          if (typeof star === 'function') match = { action: star, matchedKey: '*' };
        }
        if (!match) return 'pass';
        // pointerDown shares the 'click' gesture channel for reflection
        // purposes — it's a pre-threshold classifier on the same pointer
        // surface, and overlay consumers don't need to distinguish.
        report(ctx, phaseNameOf(ctx), 'click', match.matchedKey);
        return applyResult(ctx, match.action(ctx, _e));
      }
    : undefined;

  // Build drag handlers. drag can be either a route table or a function.
  const dragRoute = def.initial.drag;
  const onDragStart = dragRoute
    ? (_e: PointerEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
        // Function-form drag has an implicit matched key of '*' — there's
        // no route table to discriminate against.
        if (typeof dragRoute === 'function') {
          report(ctx, phaseNameOf(ctx), 'drag', '*');
          return applyResult(ctx, dragRoute(ctx, _e));
        }
        if (!ctx.target) return 'pass';
        const match = resolveRoute(dragRoute, ctx.target, ctx.modifiers);
        if (!match) return 'pass';
        report(ctx, phaseNameOf(ctx), 'drag', match.matchedKey);
        return applyResult(ctx, match.action(ctx, _e));
      }
    : undefined;

  const onDragMove = (_e: PointerEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
    if (!activeSpec?.onMove) return 'pass';
    return applyResult(ctx, activeSpec.onMove(ctx, _e));
  };

  const onDragEnd = (_e: PointerEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
    if (!activeSpec?.onRelease) {
      // No explicit onRelease — close engaged without applying.
      (ctx as { scratch: unknown }).scratch = null;
      activeSpec = null;
      return 'claim';
    }
    return applyResult(ctx, activeSpec.onRelease(ctx, _e));
  };

  const onDragCancel = (ctx: ToolCtx<TScratch>): void => {
    if (activeSpec?.onCancel) {
      const r = activeSpec.onCancel(ctx);
      if (r) applyResult(ctx, r);
    }
    (ctx as { scratch: unknown }).scratch = null;
    activeSpec = null;
  };

  // Keyboard / wheel handlers — straightforward route lookups.
  const buildKeyHandler = (
    gesture: 'keyDown' | 'keyUp',
    pick: (phase: PhaseDef<TScratch>) => Record<string, ActionFn<TScratch>> | undefined,
  ) => (e: KeyboardEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
    const table = pick(phaseOf(ctx));
    if (!table) return 'pass';
    const action = table[e.key];
    if (!action) return 'pass';
    // Keyboard routes are flat string→ActionFn maps — matched key is the
    // pressed key itself ('Escape', 'Enter', ...).
    report(ctx, phaseNameOf(ctx), gesture, e.key);
    return applyResult(ctx, action(ctx, e));
  };

  // cursor: phase override beats top-level. Returns '' (not undefined) so
  // the function-form signature satisfies Tool.cursor: (ctx) => string.
  const resolveCursor = (ctx: ToolCtx<TScratch>): string => {
    const phaseCursor = phaseOf(ctx).cursor;
    if (phaseCursor != null) {
      return typeof phaseCursor === 'function' ? phaseCursor(ctx) : phaseCursor;
    }
    if (def.cursor != null) {
      return typeof def.cursor === 'function' ? def.cursor(ctx) : def.cursor;
    }
    return '';
  };

  // claimsAll lives on the active phase, optionally. Boolean and
  // function forms both supported; the function form receives the
  // live ctx (scratch, view, target, modifiers) and is re-evaluated
  // on every pointerdown the dispatcher considers.
  const claimsAll = (ctx: ToolCtx<TScratch>): boolean => {
    const v = phaseOf(ctx).claimsAll;
    if (v === undefined) return false;
    return typeof v === 'function' ? v(ctx) : v;
  };

  return {
    id: def.id,
    presentation: def.presentation,
    keybinding: def.keybinding,
    hotkey: def.hotkey,
    onActivate: def.onActivate,
    onDeactivate: def.onDeactivate,
    initScratch: def.initScratch ?? (() => null as unknown as TScratch),
    cursor: resolveCursor,
    claimsAll,
    hitOverride: def.hitOverride,
    pointer: (onClick || onDown)
      ? { ...(onClick ? { onClick } : {}), ...(onDown ? { onDown } : {}) }
      : undefined,
    drag: onDragStart ? {
      onStart: onDragStart,
      onMove: onDragMove,
      onEnd: onDragEnd,
      onCancel: onDragCancel,
    } : undefined,
    dblTap: def.initial.dblTap || def.engaged?.dblTap
      ? {
          onTap: (_e: PointerEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
            const table = phaseOf(ctx).dblTap;
            if (!table) return 'pass';
            if (!ctx.target) return 'pass';
            let match = resolveRoute(table, ctx.target, ctx.modifiers);
            // Universal fallback for empty hits — mirrors onClick / onDown
            // semantics so consumers writing `dblTap: { '*': fn }` to
            // handle "double-tap anywhere" get the callback on
            // empty-canvas double-taps.
            if (!match && ctx.target.category === 'empty') {
              const star = table['*'];
              if (typeof star === 'function') match = { action: star, matchedKey: '*' };
            }
            if (!match) return 'pass';
            report(ctx, phaseNameOf(ctx), 'dblTap', match.matchedKey);
            return applyResult(ctx, match.action(ctx, _e));
          },
        }
      : undefined,
    keyboard: (def.initial.keyDown || def.engaged?.keyDown || def.initial.keyUp || def.engaged?.keyUp)
      ? {
          onDown: buildKeyHandler('keyDown', (p) => p.keyDown),
          onUp:   buildKeyHandler('keyUp',   (p) => p.keyUp),
        }
      : undefined,
    wheel: def.initial.wheel || def.engaged?.wheel
      ? {
          onWheel: (_e: WheelEvent, ctx: ToolCtx<TScratch>) => {
            const action = phaseOf(ctx).wheel;
            if (!action) return 'pass';
            // Wheel routes are a single ActionFn, no table — matched key '*'.
            report(ctx, phaseNameOf(ctx), 'wheel', '*');
            return applyResult(ctx, action(ctx, _e));
          },
        }
      : undefined,
    overlay: def.initial.overlay ? def.initial.overlay() : undefined,
  };
}
