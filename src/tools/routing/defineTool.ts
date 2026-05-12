// src/tools/routing/defineTool.ts
import type { Tool, ToolCtx } from '../types';
import type { ToolDef, PhaseDef, ActionFn } from './types';
import type { Result, BeginSpec } from './result';
import { resolveRoute } from './lookup';

/** Translate a declarative `ToolDef<TScratch>` into the existing imperative
 *  `Tool<TScratch>` shape. The dispatcher consumes the resulting Tool as
 *  it does today; declarative authoring is the only change. */
export function defineTool<TScratch = void>(
  def: ToolDef<TScratch>,
): Tool<TScratch> {
  // Stores the active BeginSpec between gesture events. Keyed on the ctx
  // object so each tool instance has its own spec reference without
  // polluting the scratch shape. Using a WeakMap means no cleanup needed
  // when ctx is discarded.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const specMap = new WeakMap<object, BeginSpec<TScratch>>();

  // Phase state derives from ctx.scratch presence: scratch !== null means
  // engaged. The translated handlers consult def.engaged when scratch is
  // set, def.initial otherwise.
  const phaseOf = (ctx: ToolCtx<TScratch>): PhaseDef<TScratch> => {
    return ctx.scratch != null && def.engaged ? def.engaged : def.initial;
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
        // in the specMap (keyed on ctx) so they survive across pointer events.
        (ctx as { scratch: unknown }).scratch = result.spec.scratch;
        specMap.set(ctx as object, result.spec);
        return 'claim';
      }
      case 'hold':
        // Update scratch; spec stays in specMap so continuations remain wired.
        (ctx as { scratch: unknown }).scratch = result.scratch;
        return 'claim';
      case 'commit':
        ctx.applyOps(result.ops, result.label as string);
        (ctx as { scratch: unknown }).scratch = null;
        specMap.delete(ctx as object);
        return 'claim';
      case 'cancel':
        (ctx as { scratch: unknown }).scratch = null;
        specMap.delete(ctx as object);
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
        let action = resolveRoute(phase.click, ctx.target, ctx.modifiers);
        // Universal fallback: '*' matches any hit type (including empty) when
        // no more-specific route was found. The lookup engine excludes empty
        // hits from '*' to prevent accidental catch-alls; here the factory
        // re-checks explicitly so engaged-phase catch-alls like { '*': addAnchor }
        // respond to background clicks as intended by the tool author.
        if (!action && ctx.target.category === 'empty') {
          const star = phase.click['*'];
          if (typeof star === 'function') action = star;
        }
        if (!action) return 'pass';
        return applyResult(ctx, action(ctx));
      }
    : undefined;

  // Build drag handlers. drag can be either a route table or a function.
  const dragRoute = def.initial.drag;
  const onDragStart = dragRoute
    ? (_e: PointerEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
        const action = typeof dragRoute === 'function'
          ? dragRoute
          : ctx.target
            ? resolveRoute(dragRoute, ctx.target, ctx.modifiers)
            : undefined;
        if (!action) return 'pass';
        return applyResult(ctx, action(ctx));
      }
    : undefined;

  const onDragMove = (_e: PointerEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
    const spec = specMap.get(ctx as object);
    if (!spec?.onMove) return 'pass';
    return applyResult(ctx, spec.onMove(ctx));
  };

  const onDragEnd = (_e: PointerEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
    const spec = specMap.get(ctx as object);
    if (!spec?.onRelease) {
      // No explicit onRelease — close engaged without applying.
      (ctx as { scratch: unknown }).scratch = null;
      specMap.delete(ctx as object);
      return 'claim';
    }
    return applyResult(ctx, spec.onRelease(ctx));
  };

  const onDragCancel = (ctx: ToolCtx<TScratch>): void => {
    const spec = specMap.get(ctx as object);
    if (spec?.onCancel) {
      const r = spec.onCancel(ctx);
      if (r) applyResult(ctx, r);
    }
    (ctx as { scratch: unknown }).scratch = null;
    specMap.delete(ctx as object);
  };

  // Keyboard / wheel handlers — straightforward route lookups.
  const buildKeyHandler = (
    pick: (phase: PhaseDef<TScratch>) => Record<string, ActionFn<TScratch>> | undefined,
  ) => (e: KeyboardEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
    const table = pick(phaseOf(ctx));
    if (!table) return 'pass';
    const action = table[e.key];
    if (!action) return 'pass';
    return applyResult(ctx, action(ctx));
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

  // claimsAll lives on the engaged phase, optionally.
  const claimsAll = (ctx: ToolCtx<TScratch>): boolean => {
    return phaseOf(ctx).claimsAll === true;
  };

  return {
    id: def.id,
    presentation: def.presentation,
    keybinding: def.keybinding,
    onActivate: def.onActivate,
    onDeactivate: def.onDeactivate,
    initScratch: () => null as unknown as TScratch,
    cursor: resolveCursor,
    claimsAll,
    pointer: onClick ? { onClick } : undefined,
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
            const action = resolveRoute(table, ctx.target, ctx.modifiers);
            if (!action) return 'pass';
            return applyResult(ctx, action(ctx));
          },
        }
      : undefined,
    keyboard: (def.initial.keyDown || def.engaged?.keyDown || def.initial.keyUp || def.engaged?.keyUp)
      ? {
          onDown: buildKeyHandler((p) => p.keyDown),
          onUp:   buildKeyHandler((p) => p.keyUp),
        }
      : undefined,
    wheel: def.initial.wheel || def.engaged?.wheel
      ? {
          onWheel: (_e: WheelEvent, ctx: ToolCtx<TScratch>) => {
            const action = phaseOf(ctx).wheel;
            if (!action) return 'pass';
            return applyResult(ctx, action(ctx));
          },
        }
      : undefined,
  };
}
