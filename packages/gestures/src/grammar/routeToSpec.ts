import type { GestureSpec, ModSpec, PhaseSpec, TargetSpec } from '../ui/spec';
import { parseTargetSpec } from '../ui/match';
import { formatRoute, type ParsedRoute } from './routeGrammar';
import { parseKeyRoute } from './keyRouteGrammar';
import { specKindForRouteGesture } from './specKinds';

/**
 * Build the `GestureSpec` a parsed route describes, so a route string can
 * drive `matchSpec` and `specificity` directly.
 *
 * Wildcards become omitted fields: a `*` target, direction or MIME list, and a
 * `[*]` phase slot. A `keyDown` / `keyHeld` arg is read as a key route, so
 * `keyDown(z?shift)` yields `mods.shift: 'optional'`; a drop or paste arg is
 * a `|`-separated MIME list.
 *
 * Throws on a route no spec can express: `keyUp`, a key or finger-count
 * wildcard, or a target that is not a `TargetSpec` form.
 */
export function routeToSpec(parsed: ParsedRoute): GestureSpec {
  const fail = (why: string): never => {
    throw new Error(`routeToSpec: ${why}: ${formatRoute(parsed)}`);
  };
  const arg = parsed.arg === '*' ? undefined : parsed.arg;

  const mods: ModSpec = {};
  for (const [name, req] of Object.entries(parsed.modifiers)) {
    mods[name as keyof ModSpec] = req === 'required' ? true : 'optional';
  }

  const common: { mods?: ModSpec; phase?: PhaseSpec } = {};
  const isAnySelfPhase = parsed.phases.length === 1
    && parsed.phases[0]!.channel === '&' && parsed.phases[0]!.phase === '*';
  if (!isAnySelfPhase) common.phase = parsed.phases;

  const withMods = <S extends GestureSpec>(spec: S): S => {
    const extra = spec.mods;
    const merged = { ...mods, ...extra };
    const out = { ...spec, ...common };
    if (Object.keys(merged).length > 0) out.mods = merged;
    return out;
  };

  let target: TargetSpec | undefined;
  if (parsed.target !== undefined && parsed.target !== '*') {
    if (parseTargetSpec(parsed.target as TargetSpec) === null) {
      fail(`"${parsed.target}" is not a target form`);
    }
    target = parsed.target as TargetSpec;
  }
  const t = target === undefined ? {} : { target };

  const kind = specKindForRouteGesture(parsed.gesture);
  switch (kind) {
    case undefined:
      return fail(`${parsed.gesture} has no GestureSpec kind`);
    case 'click':
    case 'pointerDown':
    case 'doubleClick':
    case 'drag':
    case 'contextMenu':
    case 'longPress':
      return withMods({ kind, ...t });
    case 'wheel':
      return withMods({ kind, ...(arg ? { direction: arg as 'up' | 'down' } : {}), ...t });
    case 'pinch':
      return withMods({ kind, ...(arg ? { direction: arg as 'in' | 'out' } : {}), ...t });
    case 'key':
    case 'key-held': {
      if (arg === undefined) return fail('a key spec needs a concrete key');
      const { key, optionalMods } = parseKeyRoute(arg);
      const optional: ModSpec = {};
      for (const m of optionalMods) optional[m] = 'optional';
      return withMods({ kind, key, ...(optionalMods.length > 0 ? { mods: optional } : {}) });
    }
    case 'multiTouchTap':
      if (arg === undefined) return fail('a multiTouchTap spec needs concrete fingers');
      return withMods({ kind, fingers: Number(arg) });
    case 'drop':
    case 'paste':
      return withMods({ kind, ...(arg ? { types: arg.split('|') } : {}) });
    case 'multiTouch':
      return fail('multiTouch has no route gesture');
  }
}
