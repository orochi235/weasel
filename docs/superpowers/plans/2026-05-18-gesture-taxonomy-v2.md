# Gesture Taxonomy v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ad-hoc gesture/route encoding with a declarative gesture taxonomy that knows which gestures hit-test, which carry arguments, and what argument values are legal. Adds first-class support for right-click (`contextMenu`), two/three-finger taps (`multiTouchTap`), wheel-direction filtering (`wheel(up|down|both)`), and an optional-modifier mini-grammar for key routes.

**Architecture:** A single `GestureDescriptor` table is the source of truth for gesture metadata (`hasTarget`, `arg`, `argValues`). The route-string grammar widens from `phase.gesture.target[:modifiers]` to `phase.gesture[(arg)][.target][:modifiers]`, with which slots are present determined by the descriptor. `PhaseDef` gains three new gestures and a structured form for key gestures that supports `"ArrowDown?shift"` (shift-is-optional) without burning modifier-slot ambiguity. Reflection, the runtime matcher, and the inspector RouteBadge all read the descriptor table — no symbol does its own gesture-shape inference.

**Tech Stack:** TypeScript, React, vitest, React Testing Library. No new deps.

**Scope note:** This plan touches five subsystems (taxonomy, route grammar, PhaseDef, reflection, matcher, inspector UI). They're tightly coupled through the route string, so splitting plans across them would force one phase to write broken grammar and the next to fix it. Keeping them together; phases F (multitouch) and G (UI polish) are independently deferrable.

**What we are NOT doing here:** No platform-wide right-click rebinding, no PWA/touch-event polyfill, no migration of existing `useFooTool` routes — they remain valid because the bare grammar (`phase.gesture.target[:modifiers]` with no arg slot) stays accepted as a strict subset.

---

## File Structure

**Create:**
- `src/tools/routing/gestures.ts` — gesture descriptor table + helpers
- `src/tools/routing/gestures.test.ts` — descriptor invariants + lookup tests
- `src/tools/routing/routeGrammar.ts` — `parseRoute`/`formatRoute` for v2 grammar
- `src/tools/routing/routeGrammar.test.ts`
- `src/tools/routing/keyRouteGrammar.ts` — `parseKeyRoute`/`formatKeyRoute` for `"ArrowDown?shift"` strings
- `src/tools/routing/keyRouteGrammar.test.ts`

**Modify:**
- `src/tools/routing/types.ts` — extend `PhaseDef` with `contextMenu`, `multiTouchTap`, structured wheel + key tables
- `src/tools/routing/reflection/route-resolved.ts` — widen `RouteGesture` union; add arg field
- `src/tools/routing/reflection/registry.ts` — emit new grammar from PhaseDef
- `src/interactions/dispatcher/matcher.ts` — wheel-direction filter, optional-mod key match
- `src/interactions/dispatcher/dispatcher.ts` — route contextmenu + multitouch to new PhaseDef channels
- `apps/swillustrator/src/dev/registryData.ts` — `parseRoute` proxies to new grammar
- `apps/swillustrator/src/dev/RegistryDetail.tsx` — `RouteBadge` renders arg chip; descriptor-driven slot presence
- `apps/swillustrator/src/dev/RegistryDetail.test.tsx` — assert new chip layout

**Delete:** none.

---

## Phase A — Gesture Descriptor Table

### Task A1: Descriptor types + lookup

**Files:**
- Create: `src/tools/routing/gestures.ts`
- Test: `src/tools/routing/gestures.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/tools/routing/gestures.test.ts
import { describe, it, expect } from 'vitest';
import { GESTURE_DESCRIPTORS, getGestureDescriptor, type GestureName } from './gestures';

describe('GESTURE_DESCRIPTORS', () => {
  it('declares every gesture name exactly once', () => {
    const names = GESTURE_DESCRIPTORS.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('click has a target slot and no arg', () => {
    const d = getGestureDescriptor('click');
    expect(d.hasTarget).toBe(true);
    expect(d.arg).toBeUndefined();
  });

  it('wheel has no target and a direction arg with default "both"', () => {
    const d = getGestureDescriptor('wheel');
    expect(d.hasTarget).toBe(false);
    expect(d.arg?.name).toBe('direction');
    expect(d.arg?.values).toEqual(['up', 'down', 'both']);
    expect(d.arg?.default).toBe('both');
  });

  it('keyDown has no target and a free-form key arg', () => {
    const d = getGestureDescriptor('keyDown');
    expect(d.hasTarget).toBe(false);
    expect(d.arg?.name).toBe('key');
    expect(d.arg?.values).toBe('free');
  });

  it('contextMenu has a target slot and no arg', () => {
    const d = getGestureDescriptor('contextMenu');
    expect(d.hasTarget).toBe(true);
    expect(d.arg).toBeUndefined();
  });

  it('multiTouchTap has no target and an enumerated fingers arg', () => {
    const d = getGestureDescriptor('multiTouchTap');
    expect(d.hasTarget).toBe(false);
    expect(d.arg?.name).toBe('fingers');
    expect(d.arg?.values).toEqual(['2', '3', '4']);
  });

  it('drag is a special case: target slot, but function-form drops it (no arg)', () => {
    const d = getGestureDescriptor('drag');
    expect(d.hasTarget).toBe(true);
    expect(d.arg).toBeUndefined();
  });

  it('getGestureDescriptor throws on unknown name', () => {
    expect(() => getGestureDescriptor('bogus' as GestureName)).toThrow(/unknown gesture/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/routing/gestures.test.ts`
Expected: FAIL with "Cannot find module './gestures'"

- [ ] **Step 3: Write the descriptor table**

```ts
// src/tools/routing/gestures.ts
/**
 * Declarative gesture taxonomy. Single source of truth for:
 *   - which gestures hit-test (have a `.target` slot in the route string)
 *   - which gestures carry an argument and what values are legal
 *   - the default arg value (used when none is specified in a route)
 *
 * Reflection, matcher, and inspector UI all read this table. Adding a new
 * gesture name in one place updates every consumer.
 */

export type GestureName =
  | 'click'
  | 'pointerDown'
  | 'dblTap'
  | 'drag'
  | 'wheel'
  | 'keyDown'
  | 'keyUp'
  | 'contextMenu'
  | 'multiTouchTap';

export interface GestureArgSpec {
  /** Display name for the arg in inspector chips (`direction`, `key`, `fingers`). */
  name: string;
  /** Acceptable values. `'free'` means any string (e.g. key names). */
  values: readonly string[] | 'free';
  /** Default value when a route omits the arg slot. Must be in `values`
   *  unless `values === 'free'`. Optional: no default means routes that
   *  omit the arg slot match every value (only legal for `'free'` args). */
  default?: string;
}

export interface GestureDescriptor {
  name: GestureName;
  /** Does the route's `.target` slot apply? Targetless gestures (`wheel`,
   *  `keyDown/Up`, `multiTouchTap`) elide it entirely in the v2 grammar. */
  hasTarget: boolean;
  /** Optional argument spec. Encoded as `gesture(value)` in the route string. */
  arg?: GestureArgSpec;
}

export const GESTURE_DESCRIPTORS: readonly GestureDescriptor[] = [
  { name: 'click',         hasTarget: true  },
  { name: 'pointerDown',   hasTarget: true  },
  { name: 'dblTap',        hasTarget: true  },
  { name: 'drag',          hasTarget: true  },
  { name: 'wheel',         hasTarget: false, arg: { name: 'direction', values: ['up', 'down', 'both'], default: 'both' } },
  { name: 'keyDown',       hasTarget: false, arg: { name: 'key',       values: 'free' } },
  { name: 'keyUp',         hasTarget: false, arg: { name: 'key',       values: 'free' } },
  { name: 'contextMenu',   hasTarget: true  },
  { name: 'multiTouchTap', hasTarget: false, arg: { name: 'fingers',   values: ['2', '3', '4'] } },
];

const BY_NAME = new Map<string, GestureDescriptor>(
  GESTURE_DESCRIPTORS.map((d) => [d.name, d]),
);

export function getGestureDescriptor(name: GestureName): GestureDescriptor {
  const d = BY_NAME.get(name);
  if (!d) throw new Error(`unknown gesture: ${name}`);
  return d;
}

export function isKnownGestureName(name: string): name is GestureName {
  return BY_NAME.has(name);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tools/routing/gestures.test.ts`
Expected: PASS, 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/routing/gestures.ts src/tools/routing/gestures.test.ts
git commit -m "feat(routing): introduce GestureDescriptor taxonomy table"
```

---

## Phase B — Route Grammar v2

### Task B1: parseRoute / formatRoute for `phase.gesture[(arg)][.target][:modifiers]`

**Files:**
- Create: `src/tools/routing/routeGrammar.ts`
- Test: `src/tools/routing/routeGrammar.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/tools/routing/routeGrammar.test.ts
import { describe, it, expect } from 'vitest';
import { parseRoute, formatRoute } from './routeGrammar';

describe('parseRoute (v2 grammar)', () => {
  it('parses a click with target and modifiers', () => {
    expect(parseRoute('initial.click.empty:shift')).toEqual({
      phase: 'initial', gesture: 'click', arg: undefined, target: 'empty', modifiers: 'shift',
    });
  });

  it('parses a wheel with direction arg, no target', () => {
    expect(parseRoute('initial.wheel(up)')).toEqual({
      phase: 'initial', gesture: 'wheel', arg: 'up', target: undefined, modifiers: 'default',
    });
  });

  it('parses a wheel without arg as the descriptor default', () => {
    expect(parseRoute('initial.wheel')).toEqual({
      phase: 'initial', gesture: 'wheel', arg: 'both', target: undefined, modifiers: 'default',
    });
  });

  it('parses keyDown with a key arg', () => {
    expect(parseRoute('initial.keyDown(ArrowDown)')).toEqual({
      phase: 'initial', gesture: 'keyDown', arg: 'ArrowDown', target: undefined, modifiers: 'default',
    });
  });

  it('parses contextMenu like click (target slot present)', () => {
    expect(parseRoute('initial.contextMenu.empty')).toEqual({
      phase: 'initial', gesture: 'contextMenu', arg: undefined, target: 'empty', modifiers: 'default',
    });
  });

  it('parses multiTouchTap with fingers arg, no target', () => {
    expect(parseRoute('initial.multiTouchTap(2)')).toEqual({
      phase: 'initial', gesture: 'multiTouchTap', arg: '2', target: undefined, modifiers: 'default',
    });
  });

  it('rejects an arg on a no-arg gesture', () => {
    expect(() => parseRoute('initial.click(foo).empty')).toThrow(/click.*does not take an argument/);
  });

  it('rejects a target on a no-target gesture', () => {
    expect(() => parseRoute('initial.wheel(up).foo')).toThrow(/wheel.*does not have a target/);
  });

  it('rejects an unknown enumerated arg value', () => {
    expect(() => parseRoute('initial.wheel(sideways)')).toThrow(/sideways.*not in.*up.*down.*both/);
  });
});

describe('formatRoute', () => {
  it('round-trips click', () => {
    const r = { phase: 'initial' as const, gesture: 'click' as const, arg: undefined, target: 'empty', modifiers: 'shift' };
    expect(parseRoute(formatRoute(r))).toEqual(r);
  });

  it('elides default arg for wheel', () => {
    expect(formatRoute({ phase: 'initial', gesture: 'wheel', arg: 'both', target: undefined, modifiers: 'default' }))
      .toBe('initial.wheel');
  });

  it('keeps explicit arg for wheel(up)', () => {
    expect(formatRoute({ phase: 'initial', gesture: 'wheel', arg: 'up', target: undefined, modifiers: 'default' }))
      .toBe('initial.wheel(up)');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tools/routing/routeGrammar.test.ts`
Expected: FAIL with "Cannot find module './routeGrammar'"

- [ ] **Step 3: Implement parseRoute / formatRoute**

```ts
// src/tools/routing/routeGrammar.ts
/**
 * Route-string grammar v2:
 *
 *   route       = phase '.' gesture argSlot? targetSlot? modSlot?
 *   argSlot     = '(' value ')'        // present iff descriptor.arg is set
 *   targetSlot  = '.' target           // present iff descriptor.hasTarget
 *   modSlot     = ':' modifierKey      // optional; absent === 'default'
 *
 * Examples:
 *   initial.click.empty:shift
 *   initial.wheel                       (== initial.wheel(both))
 *   initial.wheel(up)
 *   initial.keyDown(ArrowDown)
 *   initial.contextMenu.empty
 *   initial.multiTouchTap(2)
 */
import { getGestureDescriptor, isKnownGestureName, type GestureName } from './gestures';
import type { ModifierKey } from './modifiers';
import type { RoutePhase } from './reflection/route-resolved';

export interface ParsedRoute {
  phase: RoutePhase;
  gesture: GestureName;
  /** Resolved arg value. For a gesture with a default arg, the default is
   *  filled in when the route omits the slot. Undefined iff descriptor.arg
   *  is undefined OR a free-form arg slot was omitted. */
  arg: string | undefined;
  target: string | undefined;
  modifiers: ModifierKey;
}

const ARG_RE = /^([^(]+)\(([^)]*)\)$/;

export function parseRoute(route: string): ParsedRoute {
  const [body, modsPart] = route.split(':') as [string, string | undefined];
  const segments = body.split('.');
  if (segments.length < 2) throw new Error(`invalid route (need phase.gesture): ${route}`);
  const [phase, gestureRaw, ...rest] = segments as [RoutePhase, string, ...string[]];

  const argMatch = ARG_RE.exec(gestureRaw);
  const gestureName = argMatch ? argMatch[1] : gestureRaw;
  const rawArg = argMatch ? argMatch[2] : undefined;

  if (!isKnownGestureName(gestureName)) {
    throw new Error(`invalid route (unknown gesture "${gestureName}"): ${route}`);
  }
  const desc = getGestureDescriptor(gestureName);

  if (rawArg !== undefined && !desc.arg) {
    throw new Error(`invalid route (${gestureName} does not take an argument): ${route}`);
  }
  let arg: string | undefined;
  if (desc.arg) {
    arg = rawArg ?? desc.arg.default;
    if (arg !== undefined && desc.arg.values !== 'free' && !desc.arg.values.includes(arg)) {
      throw new Error(`invalid route (${arg} not in [${desc.arg.values.join(', ')}]): ${route}`);
    }
  }

  const target = rest.length > 0 ? rest.join('.') : undefined;
  if (target !== undefined && !desc.hasTarget) {
    throw new Error(`invalid route (${gestureName} does not have a target): ${route}`);
  }

  const modifiers = (modsPart ?? 'default') as ModifierKey;
  return { phase, gesture: gestureName, arg, target, modifiers };
}

export function formatRoute(r: ParsedRoute): string {
  const desc = getGestureDescriptor(r.gesture);
  let out = `${r.phase}.${r.gesture}`;
  if (desc.arg && r.arg !== undefined && r.arg !== desc.arg.default) {
    out += `(${r.arg})`;
  }
  if (r.target !== undefined) out += `.${r.target}`;
  if (r.modifiers !== 'default') out += `:${r.modifiers}`;
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/tools/routing/routeGrammar.test.ts`
Expected: PASS, 12 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/routing/routeGrammar.ts src/tools/routing/routeGrammar.test.ts
git commit -m "feat(routing): add v2 route grammar with arg slot"
```

---

### Task B2: Key route grammar with optional modifiers

**Files:**
- Create: `src/tools/routing/keyRouteGrammar.ts`
- Test: `src/tools/routing/keyRouteGrammar.test.ts`

The `keyDown`/`keyUp` `arg` slot accepts a mini-grammar so a single tool route can declare "ArrowDown, with or without shift":

```
keyRoute    = key ('?' optionalMod)*
optionalMod = 'mod' | 'shift' | 'alt' | 'ctrl' | 'meta'
```

Example: `ArrowDown?shift` — fires on `ArrowDown` whether or not shift is held; shift's state is delivered to the handler via the usual modifier snapshot. Required modifiers continue to use the route's `:modifiers` slot.

- [ ] **Step 1: Write failing test**

```ts
// src/tools/routing/keyRouteGrammar.test.ts
import { describe, it, expect } from 'vitest';
import { parseKeyRoute, formatKeyRoute } from './keyRouteGrammar';

describe('parseKeyRoute', () => {
  it('parses a bare key', () => {
    expect(parseKeyRoute('ArrowDown')).toEqual({ key: 'ArrowDown', optionalMods: [] });
  });

  it('parses one optional modifier', () => {
    expect(parseKeyRoute('ArrowDown?shift')).toEqual({ key: 'ArrowDown', optionalMods: ['shift'] });
  });

  it('parses multiple optional modifiers in input order', () => {
    expect(parseKeyRoute('ArrowDown?shift?alt')).toEqual({ key: 'ArrowDown', optionalMods: ['shift', 'alt'] });
  });

  it('rejects an unknown optional modifier', () => {
    expect(() => parseKeyRoute('ArrowDown?cape')).toThrow(/unknown optional modifier/i);
  });

  it('rejects duplicate optional modifiers', () => {
    expect(() => parseKeyRoute('ArrowDown?shift?shift')).toThrow(/duplicate optional modifier/i);
  });
});

describe('formatKeyRoute', () => {
  it('round-trips bare key', () => {
    const r = { key: 'Enter', optionalMods: [] };
    expect(parseKeyRoute(formatKeyRoute(r))).toEqual(r);
  });

  it('round-trips with optional mods', () => {
    const r = { key: 'ArrowDown', optionalMods: ['shift' as const, 'alt' as const] };
    expect(parseKeyRoute(formatKeyRoute(r))).toEqual(r);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tools/routing/keyRouteGrammar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/tools/routing/keyRouteGrammar.ts
/**
 * Mini-grammar for the `arg` slot of `keyDown` / `keyUp` routes.
 *
 *   keyRoute    = key ('?' optionalMod)*
 *   optionalMod = 'mod' | 'shift' | 'alt' | 'ctrl' | 'meta'
 *
 * `?shift` means "shift may or may not be held; either fires this route."
 * Required modifiers still belong in the route's `:modifiers` slot — this
 * grammar only widens which events match, never narrows.
 */

export type OptionalMod = 'mod' | 'shift' | 'alt' | 'ctrl' | 'meta';
const OPTIONAL_MODS: readonly OptionalMod[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];
const OPTIONAL_SET = new Set<string>(OPTIONAL_MODS);

export interface ParsedKeyRoute {
  key: string;
  optionalMods: readonly OptionalMod[];
}

export function parseKeyRoute(input: string): ParsedKeyRoute {
  const [key, ...mods] = input.split('?');
  if (!key) throw new Error(`invalid key route (empty key): ${input}`);
  const seen = new Set<string>();
  for (const m of mods) {
    if (!OPTIONAL_SET.has(m)) throw new Error(`unknown optional modifier "${m}" in ${input}`);
    if (seen.has(m)) throw new Error(`duplicate optional modifier "${m}" in ${input}`);
    seen.add(m);
  }
  return { key, optionalMods: mods as OptionalMod[] };
}

export function formatKeyRoute(r: ParsedKeyRoute): string {
  return r.optionalMods.length === 0 ? r.key : `${r.key}?${r.optionalMods.join('?')}`;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/tools/routing/keyRouteGrammar.test.ts`
Expected: PASS, 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/routing/keyRouteGrammar.ts src/tools/routing/keyRouteGrammar.test.ts
git commit -m "feat(routing): key-route mini-grammar with optional modifiers"
```

---

## Phase C — PhaseDef extensions

### Task C1: Widen `RouteGesture` union + `PhaseDef` shape

**Files:**
- Modify: `src/tools/routing/reflection/route-resolved.ts`
- Modify: `src/tools/routing/types.ts`

- [ ] **Step 1: Update `RouteGesture`**

In `src/tools/routing/reflection/route-resolved.ts`, replace the existing line:

```ts
export type RouteGesture = 'click' | 'dblTap' | 'drag' | 'wheel' | 'keyDown' | 'keyUp';
```

with an import from the descriptor table:

```ts
import type { GestureName } from '../gestures';
export type RouteGesture = GestureName;
```

Update `RouteResolvedInfo` to carry the resolved arg:

```ts
export interface RouteResolvedInfo {
  toolId: string;
  phase: RoutePhase;
  gesture: RouteGesture;
  /** Argument captured at match time for arg-bearing gestures
   *  (`wheel` direction, `keyDown`/`keyUp` key, `multiTouchTap` fingers).
   *  Undefined for no-arg gestures. */
  arg: string | undefined;
  matchedKey: string;
  modifiers: ModifierKey;
  target: HitResult;
  timestamp: number;
}
```

Update `formatRouteResolved` to include arg:

```ts
export function formatRouteResolved(info: RouteResolvedInfo): string {
  const argPart = info.arg !== undefined ? `(${info.arg})` : '';
  const mod = info.modifiers === 'default' ? '' : ` mods=${info.modifiers}`;
  return `${info.toolId} [${info.phase}] ${info.gesture}${argPart} → ${info.matchedKey}${mod}`;
}
```

- [ ] **Step 2: Extend `PhaseDef` in `src/tools/routing/types.ts`**

Replace the existing `PhaseDef` block (lines around 20–46) with:

```ts
import type { ParsedKeyRoute } from './keyRouteGrammar';

/** Map from key-route string (e.g. `"ArrowDown"`, `"ArrowDown?shift"`) to
 *  action. Parsed lazily by the reflection emitter and dispatcher. */
export type KeyRouteTable<TScratch> = Partial<Record<string, ActionFn<TScratch>>>;

/** Wheel direction sub-table. Keys: `'up' | 'down' | 'both'`. Function form
 *  is sugar for `{ both: fn }`. */
export type WheelTable<TScratch> = Partial<Record<'up' | 'down' | 'both', ActionFn<TScratch>>>;

/** MultiTouch tap fingers sub-table. Keys: `'2' | '3' | '4'`. */
export type MultiTouchTapTable<TScratch> = Partial<Record<'2' | '3' | '4', ActionFn<TScratch>>>;

export interface PhaseDef<TScratch> {
  click?:         RouteTable<TScratch>;
  pointerDown?:   RouteTable<TScratch>;
  dblTap?:        RouteTable<TScratch>;
  contextMenu?:   RouteTable<TScratch>;
  drag?:          RouteTable<TScratch> | ActionFn<TScratch>;
  wheel?:         WheelTable<TScratch> | ActionFn<TScratch>;
  keyDown?:       KeyRouteTable<TScratch>;
  keyUp?:         KeyRouteTable<TScratch>;
  multiTouchTap?: MultiTouchTapTable<TScratch>;
  cursor?:        string | ((ctx: ToolCtx<TScratch>) => string);
  overlay?:       () => RenderLayer<unknown>;
  claimsAll?:     boolean | ((ctx: ToolCtx<TScratch>) => boolean);
}
```

(Preserve the doc-comments from the original file on each field; only the type changes for `wheel`/`keyDown`/`keyUp` are functional. `contextMenu` and `multiTouchTap` are new additions.)

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors (some downstream files may need touch-ups in later tasks).

- [ ] **Step 4: Commit**

```bash
git add src/tools/routing/reflection/route-resolved.ts src/tools/routing/types.ts
git commit -m "feat(routing): widen PhaseDef with contextMenu, multiTouchTap, structured wheel"
```

---

### Task C2: Migrate built-in tools that use `wheel: fn` to the new structured form

`PhaseDef.wheel` is now `WheelTable | ActionFn`. The function form remains valid (= `{ both: fn }`), so existing tools compile unchanged. This task is just to confirm — no code edits expected.

- [ ] **Step 1: Locate existing wheel handlers**

```bash
grep -rn "wheel:" src/tools/builtin src/canvas --include='*.ts' --include='*.tsx' | grep -v test
```

- [ ] **Step 2: Confirm they're function-form (no migration needed)**

Each match should look like `wheel: (ctx) => …`. If any tool uses an object-keyed wheel table directly, migrate to the new `WheelTable<TScratch>` shape.

- [ ] **Step 3: Run the wider test suite**

Run: `npx vitest run src/tools/builtin src/canvas`
Expected: all green.

- [ ] **Step 4: Commit if any edits**

```bash
git add -p
git commit -m "chore(tools): align builtin wheel handlers with new PhaseDef shape"
```

---

## Phase D — Reflection emitter

### Task D1: `RegistryEntry` carries arg; emitter respects descriptor

**Files:**
- Modify: `src/tools/routing/reflection/registry.ts`

- [ ] **Step 1: Update `RegistryEntry`**

Around line 13–17 of `registry.ts`:

```ts
import { getGestureDescriptor, type GestureName } from '../gestures';

export interface RegistryEntry {
  toolId: string;
  phase: RoutePhase;
  gesture: GestureName;
  /** Resolved arg value at emission time. Undefined for no-arg gestures. */
  arg: string | undefined;
  target: string | undefined;
  modifiers: ModifierKey;
}
```

(`target` becomes `string | undefined` — `undefined` for gestures whose descriptor has `hasTarget: false`, instead of the `'*'` sentinel.)

- [ ] **Step 2: Update emitters**

Replace `walkPhase` body:

```ts
function walkPhase(
  toolId: string,
  phase: RoutePhase,
  phaseDef: PhaseDef<unknown>,
  out: RegistryEntry[],
): void {
  if (phaseDef.click)        walkRouteTable(toolId, phase, 'click',       phaseDef.click,       out);
  if (phaseDef.pointerDown)  walkRouteTable(toolId, phase, 'pointerDown', phaseDef.pointerDown, out);
  if (phaseDef.dblTap)       walkRouteTable(toolId, phase, 'dblTap',      phaseDef.dblTap,      out);
  if (phaseDef.contextMenu)  walkRouteTable(toolId, phase, 'contextMenu', phaseDef.contextMenu, out);
  if (phaseDef.drag)         walkDrag(toolId, phase, phaseDef.drag, out);
  if (phaseDef.wheel)        walkWheel(toolId, phase, phaseDef.wheel, out);
  if (phaseDef.keyDown)      walkKeyMap(toolId, phase, 'keyDown', phaseDef.keyDown, out);
  if (phaseDef.keyUp)        walkKeyMap(toolId, phase, 'keyUp',   phaseDef.keyUp,   out);
  if (phaseDef.multiTouchTap) walkMultiTouchTap(toolId, phase, phaseDef.multiTouchTap, out);
}
```

Add new walkers (and update `walkRouteTable` / `walkKeyMap`):

```ts
function walkRouteTable(
  toolId: string,
  phase: RoutePhase,
  gesture: GestureName,
  table: RouteTable<unknown>,
  out: RegistryEntry[],
): void {
  for (const target of Object.keys(table)) {
    const entry = table[target];
    if (entry == null) continue;
    if (typeof entry === 'function') {
      out.push({ toolId, phase, gesture, arg: undefined, target, modifiers: 'default' });
    } else {
      walkModifierRoute(toolId, phase, gesture, target, entry, out);
    }
  }
}

function walkDrag(
  toolId: string,
  phase: RoutePhase,
  drag: RouteTable<unknown> | ActionFn<unknown>,
  out: RegistryEntry[],
): void {
  if (typeof drag === 'function') {
    // Function-form drag — targetless (continues from the original pointerdown).
    out.push({ toolId, phase, gesture: 'drag', arg: undefined, target: undefined, modifiers: 'default' });
  } else {
    walkRouteTable(toolId, phase, 'drag', drag, out);
  }
}

function walkWheel(
  toolId: string,
  phase: RoutePhase,
  wheel: WheelTable<unknown> | ActionFn<unknown>,
  out: RegistryEntry[],
): void {
  if (typeof wheel === 'function') {
    out.push({ toolId, phase, gesture: 'wheel', arg: 'both', target: undefined, modifiers: 'default' });
    return;
  }
  for (const dir of Object.keys(wheel) as Array<'up' | 'down' | 'both'>) {
    if (wheel[dir] == null) continue;
    out.push({ toolId, phase, gesture: 'wheel', arg: dir, target: undefined, modifiers: 'default' });
  }
}

function walkKeyMap(
  toolId: string,
  phase: RoutePhase,
  gesture: 'keyDown' | 'keyUp',
  table: KeyRouteTable<unknown>,
  out: RegistryEntry[],
): void {
  for (const keyRoute of Object.keys(table)) {
    if (table[keyRoute] == null) continue;
    out.push({ toolId, phase, gesture, arg: keyRoute, target: undefined, modifiers: 'default' });
  }
}

function walkMultiTouchTap(
  toolId: string,
  phase: RoutePhase,
  table: MultiTouchTapTable<unknown>,
  out: RegistryEntry[],
): void {
  for (const fingers of Object.keys(table) as Array<'2' | '3' | '4'>) {
    if (table[fingers] == null) continue;
    out.push({ toolId, phase, gesture: 'multiTouchTap', arg: fingers, target: undefined, modifiers: 'default' });
  }
}
```

- [ ] **Step 3: Update reflection tests**

```bash
grep -rn "target: '\*'" src/tools/routing/reflection --include='*.test.ts'
```

Replace each `target: '*'` with `target: undefined` and add the appropriate `arg:` field per descriptor.

- [ ] **Step 4: Run reflection tests**

Run: `npx vitest run src/tools/routing/reflection`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/routing/reflection
git commit -m "feat(routing): reflection emits v2 grammar with arg slot"
```

---

## Phase E — Runtime matcher

### Task E1: Wheel direction filter

**Files:**
- Modify: `src/interactions/dispatcher/matcher.ts` (around line 298, `case 'wheel'`)

- [ ] **Step 1: Add failing test**

In `src/interactions/dispatcher/matcher.test.ts` add:

```ts
it('wheel spec with direction: "up" matches only deltaY < 0', () => {
  const spec = { kind: 'wheel' as const, direction: 'up' as const };
  const up   = { kind: 'wheel' as const, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, deltaX: 0, deltaY: -3, clientX: 0, clientY: 0 };
  const down = { ...up, deltaY: 3 };
  expect(matchSpec(spec, up).matched).toBe(true);
  expect(matchSpec(spec, down).matched).toBe(false);
});

it('wheel spec with direction: "both" (default) matches both signs', () => {
  const spec = { kind: 'wheel' as const };
  const up   = { kind: 'wheel' as const, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, deltaX: 0, deltaY: -3, clientX: 0, clientY: 0 };
  const down = { ...up, deltaY: 3 };
  expect(matchSpec(spec, up).matched).toBe(true);
  expect(matchSpec(spec, down).matched).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/interactions/dispatcher/matcher.test.ts -t wheel`
Expected: FAIL (direction not yet a spec field).

- [ ] **Step 3: Extend `WheelSpec` and matcher**

In `src/interactions/gestures/spec.ts`:

```ts
export interface WheelSpec {
  kind: 'wheel';
  direction?: 'up' | 'down' | 'both';   // default 'both'
  mods?: ModSpec;
}
```

In `src/interactions/dispatcher/matcher.ts`, in `case 'wheel'`:

```ts
case 'wheel': {
  if (e.kind !== 'wheel') return false;
  if (!matchModifiers(e, spec.mods, isMac)) return false;
  const direction = spec.direction ?? 'both';
  if (direction === 'up'   && !(e.deltaY < 0)) return false;
  if (direction === 'down' && !(e.deltaY > 0)) return false;
  return true;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/interactions/dispatcher/matcher.test.ts -t wheel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/interactions/dispatcher/matcher.ts src/interactions/gestures/spec.ts src/interactions/dispatcher/matcher.test.ts
git commit -m "feat(matcher): wheel spec supports direction (up|down|both)"
```

---

### Task E2: Key route grammar at match time

**Files:**
- Modify: `src/interactions/dispatcher/matcher.ts` (key/key-held cases)

- [ ] **Step 1: Add failing test**

```ts
it('key spec from a parsed key route widens shift when optional', () => {
  // "ArrowDown?shift" → matches both unshifted and shifted ArrowDown.
  const spec: KeySpec = { kind: 'key', key: 'ArrowDown', mods: { shift: 'optional' } };
  const plain   = { kind: 'key' as const, key: 'ArrowDown', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
  const shifted = { ...plain, shiftKey: true };
  expect(matchSpec(spec, plain).matched).toBe(true);
  expect(matchSpec(spec, shifted).matched).toBe(true);
});
```

The matcher already supports `shift: 'optional'` — the test exists to lock that contract as the binding produced by parsing `"ArrowDown?shift"`.

- [ ] **Step 2: Verify the test passes (matcher already supports it)**

Run: `npx vitest run src/interactions/dispatcher/matcher.test.ts -t optional`
Expected: PASS.

- [ ] **Step 3: Add a converter from `ParsedKeyRoute` to `KeySpec`**

Append to `src/tools/routing/keyRouteGrammar.ts`:

```ts
import type { KeySpec, ModSpec } from '../../interactions/gestures/spec';

/** Build a runtime KeySpec from a parsed key route. Optional modifiers
 *  become `mods.X: 'optional'` where supported, otherwise widen the spec
 *  by leaving the field absent (which today means "must not be held" —
 *  for non-shift optional mods we'd need matcher extension; v1 supports
 *  shift only). */
export function keyRouteToSpec(r: ParsedKeyRoute): KeySpec {
  const mods: ModSpec = {};
  for (const m of r.optionalMods) {
    if (m === 'shift') mods.shift = 'optional';
    // mod/alt/ctrl/meta: not yet supported by matcher as 'optional'. Track
    // as a TODO once a real use case appears; matcher widening is a 5-line
    // change mirroring the shift branch in matchModifiers.
  }
  return { kind: 'key', key: r.key, ...(Object.keys(mods).length ? { mods } : {}) };
}
```

Add a test:

```ts
// in keyRouteGrammar.test.ts
import { keyRouteToSpec } from './keyRouteGrammar';

it('keyRouteToSpec converts ?shift to mods.shift = "optional"', () => {
  expect(keyRouteToSpec({ key: 'ArrowDown', optionalMods: ['shift'] }))
    .toEqual({ kind: 'key', key: 'ArrowDown', mods: { shift: 'optional' } });
});

it('keyRouteToSpec returns no mods for bare key', () => {
  expect(keyRouteToSpec({ key: 'Enter', optionalMods: [] }))
    .toEqual({ kind: 'key', key: 'Enter' });
});
```

- [ ] **Step 4: Run all routing tests**

Run: `npx vitest run src/tools/routing src/interactions/dispatcher`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/routing/keyRouteGrammar.ts src/tools/routing/keyRouteGrammar.test.ts src/interactions/dispatcher/matcher.test.ts
git commit -m "feat(routing): keyRouteToSpec converter; matcher honors optional shift"
```

---

### Task E3: Wire `contextMenu` events through the dispatcher

**Files:**
- Modify: `src/interactions/dispatcher/matcher.ts` — extend `InputEvent` union
- Modify: `src/interactions/dispatcher/dispatcher.ts` — listen for `contextmenu` DOM events
- Modify: `src/interactions/gestures/spec.ts` — add `ContextMenuSpec`

- [ ] **Step 1: Failing test**

```ts
// matcher.test.ts
it('contextMenu spec matches contextmenu InputEvent', () => {
  const spec = { kind: 'contextMenu' as const };
  const e = { kind: 'contextmenu' as const, target: undefined, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, bodyTarget: 'empty' as const };
  expect(matchSpec(spec, e).matched).toBe(true);
});
```

- [ ] **Step 2: Extend types**

In `src/interactions/gestures/spec.ts`:

```ts
export interface ContextMenuSpec {
  kind: 'contextMenu';
  target?: TargetSpec;
  mods?: ModSpec;
}

export type GestureSpec =
  | KeySpec | KeyHeldSpec | WheelSpec | ClickSpec | DragSpec | MultiTouchSpec | ContextMenuSpec;
```

In `src/interactions/dispatcher/matcher.ts`, extend `InputEvent`:

```ts
| {
    kind: 'contextmenu';
    target?: unknown;
    altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean;
    bodyTarget?: 'empty' | 'selected-body' | 'unselected-body';
  }
```

Add the matcher case (mirror `click`):

```ts
case 'contextMenu': {
  if (e.kind !== 'contextmenu') return false;
  if (!matchModifiers(e, spec.mods, isMac)) return false;
  return matchTarget(spec.target, e);
}
```

- [ ] **Step 3: Wire the DOM listener**

In `src/interactions/dispatcher/dispatcher.ts`, find the existing `pointerdown`/`click` listeners and add a sibling:

```ts
const onContextMenu = (e: MouseEvent) => {
  e.preventDefault();   // suppress the native menu; tools decide what to show.
  handleInput({
    kind: 'contextmenu',
    target: e.target,
    altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
    bodyTarget: classifyTarget?.(e),
  });
};
element.addEventListener('contextmenu', onContextMenu);
// …and in the cleanup branch:
element.removeEventListener('contextmenu', onContextMenu);
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/interactions/dispatcher`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/interactions/dispatcher src/interactions/gestures/spec.ts
git commit -m "feat(dispatcher): wire contextMenu gesture (right-click) end-to-end"
```

---

## Phase F — Multitouch tap

### Task F1: Map low-level multitouch → `multiTouchTap` PhaseDef channel

**Files:**
- Modify: `src/interactions/dispatcher/dispatcher.ts` — when a `multitouch` event closes without spread/centroid movement past a threshold, treat as a tap and re-dispatch as a `multiTouchTap` event.

- [ ] **Step 1: Failing test**

```ts
// dispatcher.test.ts (new "multitouch tap" describe block)
it('two-finger touchdown + release without movement fires multiTouchTap(2)', () => {
  const fired: string[] = [];
  const tool = defineTool({
    id: 'demo',
    initial: { multiTouchTap: { '2': () => { fired.push('two-tap'); return none(); } } },
  });
  // simulate the multitouch event sequence here
  expect(fired).toEqual(['two-tap']);
});
```

(Exact event-shape construction follows the existing multitouch tests in `dispatcher.test.ts`.)

- [ ] **Step 2: Add tap classifier in dispatcher**

In `dispatcher.ts`, where multitouch handles open and close:

```ts
// On close: if (spread, centroid) didn't move past TAP_THRESHOLD_PX during
// the gesture lifetime, synthesize a `multiTouchTap` event whose `arg` is
// the fingers count, and dispatch through the normal route-matching path.
if (closeReason === 'release' && !movedPastTapThreshold) {
  handleInput({
    kind: 'multitouchtap',
    fingers,
    altKey, ctrlKey, metaKey, shiftKey,
  });
}
```

Extend `InputEvent` union in `matcher.ts`:

```ts
| { kind: 'multitouchtap'; fingers: number; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }
```

Add matcher case mirroring `multiTouch`:

```ts
case 'multiTouchTap': {
  if (e.kind !== 'multitouchtap') return false;
  if (e.fingers !== spec.fingers) return false;
  if (!matchModifiers(e, spec.mods, isMac)) return false;
  return true;
}
```

Add spec to `src/interactions/gestures/spec.ts`:

```ts
export interface MultiTouchTapSpec {
  kind: 'multiTouchTap';
  fingers: number;
  mods?: ModSpec;
}
// extend GestureSpec union accordingly.
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/interactions/dispatcher`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add src/interactions/dispatcher src/interactions/gestures/spec.ts
git commit -m "feat(dispatcher): synthesize multiTouchTap from multitouch tap"
```

---

## Phase G — Inspector UI

### Task G1: Update `apps/swillustrator/src/dev/registryData.ts` to use the new grammar

**Files:**
- Modify: `apps/swillustrator/src/dev/registryData.ts`

Replace the local `parseRoute` (line ~446) with a passthrough:

```ts
export { parseRoute } from '@orochi235/weasel/routing';   // re-export the v2 grammar
export type { ParsedRoute } from '@orochi235/weasel/routing';
```

(Ensure `@orochi235/weasel/routing` re-exports `parseRoute` from `src/tools/routing/routeGrammar.ts` via the package's barrel.)

- [ ] **Run inspector tests**

Run: `npx vitest run apps/swillustrator/src/dev`
Expected: green.

- [ ] **Commit**

```bash
git add apps/swillustrator/src/dev/registryData.ts src/index.ts
git commit -m "refactor(inspector): consume v2 route grammar from kit"
```

---

### Task G2: Render arg chip in `RouteBadge`

**Files:**
- Modify: `apps/swillustrator/src/dev/RegistryDetail.tsx` (the `RouteBadge` function)
- Modify: `apps/swillustrator/src/dev/RegistryDetail.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
it('renders the arg as a chip between gesture and target/modifiers', () => {
  render(<RouteBadge route="initial.keyDown(ArrowDown)" />);
  expect(screen.getByText('ArrowDown')).toBeTruthy();
  expect(screen.queryByText('ANY')).toBeFalsy();   // targetless → no ANY badge
});

it('renders wheel(up) with an "up" arg chip', () => {
  render(<RouteBadge route="initial.wheel(up)" />);
  expect(screen.getByText('up')).toBeTruthy();
});
```

- [ ] **Step 2: Update RouteBadge**

Replace the existing `RouteBadge` body:

```tsx
function RouteBadge({ route }: { route: string }) {
  const parsed = parseRoute(route);
  const desc = getGestureDescriptor(parsed.gesture);
  const modKeys = modifierKeys(parsed.modifiers);
  const showArg = desc.arg && parsed.arg !== undefined && parsed.arg !== desc.arg.default;
  const targetless = !desc.hasTarget;
  return (
    <span className={s.routeBadge}>
      <Badge {...(PHASE_BADGE_PROPS as BadgeProps)}>{parsed.phase}</Badge>
      <Badge
        {...(GESTURE_BADGE_PROPS as BadgeProps)}
        className={targetless ? s.flatRight : undefined}
      >
        {parsed.gesture}
      </Badge>
      {showArg && <code className={s.argChip}>{parsed.arg}</code>}
      {!targetless && parsed.target !== undefined && (
        <code className={s.tag}>{parsed.target}</code>
      )}
      {modKeys && <KeySequence keys={modKeys} />}
    </span>
  );
}
```

Add CSS to `RegistryInspector.module.css`:

```css
.argChip {
  background: var(--wzl-fg, #d4c4a8);
  color: var(--wzl-bg, #1e1610);
  padding: 1px 6px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  margin-right: 4px;
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run apps/swillustrator/src/dev/RegistryDetail.test.tsx`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add apps/swillustrator/src/dev
git commit -m "feat(inspector): RouteBadge renders gesture arg chip"
```

---

## Phase H — Final integration

### Task H1: Full test sweep

- [ ] **Step 1: Run everything**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: both clean.

- [ ] **Step 2: Build**

```bash
npx tsup build
```

Expected: build succeeds.

- [ ] **Step 3: Commit any final polish**

```bash
git add -p
git commit -m "chore: final pass for gesture taxonomy v2"
```

---

## Self-Review (author's notes)

**Spec coverage:**

- ✅ Per-gesture descriptor with `hasTarget` + `arg` (Phase A)
- ✅ Acceptable arg values per gesture (`GESTURE_DESCRIPTORS`)
- ✅ Wheel up/down/both with `both` as default (Phase A + E1)
- ✅ Right-click as a separate `contextMenu` gesture (Phase E3)
- ✅ Multitouch as a separate `multiTouchTap` gesture (Phase F)
- ✅ Key grammar with optional modifiers (`ArrowDown?shift`) (Phase B2 + E2)
- ✅ Inspector renders the new grammar without losing info (Phase G)

**Known scope cuts (deliberate):**

- Optional `mod`/`alt`/`ctrl`/`meta` in key routes is parsed but only `shift` is wired through the matcher (Task E2 note). Widening is mechanical when a consumer needs it; doing it speculatively now would mean writing test cases against unused branches.
- `multiTouchTap` arg values are `'2' | '3' | '4'` — 5+ fingers is a hardware edge case (palm rejection territory) and adding it would require matching device-conformance tests we don't have.
- No migration of existing `target: '*'` strings in stored data — the grammar change is a one-way cut. All existing emitters are updated in Phase D.

**Phase ordering rationale:** A → B → C → D → E → G is the dependency chain (each phase consumes the previous). F (multitouch) and G (UI) are independently deferrable if you want to ship in steps. E3 (contextmenu) can also be deferred — `contextMenu` is in the type system from Phase C onward, but no tool needs to bind to it until a real use case appears.
