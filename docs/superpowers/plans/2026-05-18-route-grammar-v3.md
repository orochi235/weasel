# Route Grammar v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v2 route grammar (`phase.gesture(arg).target[:modifiers]`) with v3 (`[phase] gesture(arg) => target +modSigils`). v3 introduces phase brackets with optional list/wildcard, an explicit gesture→target arrow, structured modifier atoms with explicit sigils, universal `*` wildcards, and reserved sigil characters for future expansion.

**Architecture:** The grammar lives in two files — `routeGrammar.ts` (the main parser/formatter) and `keyRouteGrammar.ts` (the key-arg mini-grammar, mostly untouched since it already used sigils). The parsed shape changes: `phase: RoutePhase` becomes `phases: readonly RoutePhase[]` (with `['*']` sentinel for "any"), and `modifiers: ModifierKey` (the positional string) becomes a structured `Record<ModName, 'required' | 'optional'>` map. Reflection and inspector both consume the new shape.

**Tech Stack:** TypeScript, vitest. No new dependencies.

**Prerequisite:** This plan assumes the `weasel-gestures` extraction is **not yet** complete — paths reference current locations under `src/tools/routing/` and `apps/swillustrator/src/dev/`. If the extraction lands first, the same code edits apply to `packages/weasel-gestures/src/` paths instead. Sequencing decision is yours; either order works.

**Out of scope:**
- `ModifierKey` enum retirement at the tool-authoring layer. Tool route tables continue using `Partial<Record<ModifierKey, ActionFn>>` as today; only the wire-format layer (route strings, reflection RegistryEntry, parsed shape) switches to structured.
- The optional `!`/`@`/`#`/`$`/`%`/`^`/`&` sigil semantics. Parser reserves them with a "reserved for future use" error; no atom is currently accepted with them.
- Multi-phase tool authoring (`[initial,engaged]click=>...` as a code-level shortcut). The grammar accepts it on parse but no code path emits multi-phase routes; that's a future ergonomic win.

---

## Grammar Reference (locked from prior discussion)

```
route       = phaseSlot WS gesture WS argSlot? WS targetSlot? WS modSlot?
phaseSlot   = '[' phaseList ']'
phaseList   = '*' | phase (WS ',' WS phase)*
argSlot     = '(' argValue ')'                 (whitespace inside parens is significant)
argValue    = '*' | <descriptor-specific>
targetSlot  = '=>' WS targetValue              (elided in canonical form when targetValue === '*')
targetValue = '*' | <hit-test target>
modSlot     = modAtom (WS modAtom)*
modAtom     = sigil modName
sigil       = '+' | '?'                        (! @ # $ % ^ & reserved → "reserved" error)
modName     = 'mod' | 'shift' | 'alt' | 'ctrl' | 'meta'
WS          = ' '*                             (ignored everywhere except inside argSlot)
```

**Canonical emit form:**

```
[initial] click                                  ≡  [initial] click => *
[initial] click => empty
[initial] click => empty +shift
[initial] click => selected-body +mod
[initial] keyDown(ArrowDown) ?shift
[initial] wheel(up)
[initial] wheel                                  ≡  [initial] wheel(*)
[initial,engaged] contextMenu                    (no comma spacing; the WS rule allows it on parse)
[*] click
[initial] click => empty +mod ?shift
```

(Parser also accepts: `[ initial , engaged ] click => empty + shift`, etc.)

---

## File Structure

**Modify:**
- `src/tools/routing/routeGrammar.ts` — new parser/formatter, new `ParsedRoute` shape
- `src/tools/routing/routeGrammar.test.ts` — full test rewrite for v3
- `src/tools/routing/reflection/registry.ts` — `RegistryEntry.modifiers` becomes structured; `walkModifierRoute` translates `ModifierKey` → structured map; emitted route strings round-trip through new `formatRoute`
- `src/tools/routing/reflection/registry.test.ts` — fixtures updated for structured modifiers
- `apps/swillustrator/src/dev/registryProbe.tsx` — `formatRoutes` rewritten to emit v3 strings via the kit's `formatRoute`
- `apps/swillustrator/src/dev/RegistryDetail.tsx` — `RouteBadge` reads `phases[]` and structured `modifiers`; renders bracketed phase list and sigil-prefixed mod chips
- `apps/swillustrator/src/dev/RegistryDetail.test.tsx` — new test cases for v3 strings

**Unchanged:**
- `src/tools/routing/gestures.ts`, `keyRouteGrammar.ts`, `modifiers.ts` (still used at the tool-authoring layer)
- `src/interactions/dispatcher/matcher.ts` (matcher operates on `ModSpec`, not on route strings)
- All tool definitions, `PhaseDef`, `defineTool`

---

## Phase A — Grammar parser/formatter rewrite

### Task A1: New `ParsedRoute` shape + canonical-form helpers

**Files:**
- Modify: `/Users/mike/src/weasel/src/tools/routing/routeGrammar.ts`

- [ ] **Step 1: Replace `ParsedRoute` interface**

In `routeGrammar.ts`, replace the existing `ParsedRoute` with:

```ts
import { getGestureDescriptor, isKnownGestureName, type GestureName } from './gestures';
import type { RoutePhase } from './reflection/route-resolved';

/** v3 modifier requirement on a single modifier key. Absent from the map
 *  means "must not be held" (strict default); presence narrows. */
export type ModRequirement = 'required' | 'optional';

/** Canonical modifier names accepted in the modSlot. */
export type ModName = 'mod' | 'shift' | 'alt' | 'ctrl' | 'meta';

/** Parsed-form modifiers — a structured map where absent keys are
 *  implicitly forbidden. Empty object means "no modifier constraints"
 *  (= every modifier must NOT be held). */
export type ParsedModifiers = Partial<Record<ModName, ModRequirement>>;

export interface ParsedRoute {
  /** One or more phases. `['*']` is the "any phase" sentinel. Empty array
   *  is invalid (parser rejects `[]`); use `['*']` for wildcard. */
  phases: readonly RoutePhase[] | readonly ['*'];
  gesture: GestureName;
  /** Resolved arg. For arg-bearing gestures, the descriptor's default is
   *  filled in when the slot is omitted (e.g. `wheel` → `arg: '*'`).
   *  Undefined for gestures whose descriptor has no `arg`. */
  arg: string | undefined;
  /** For hasTarget gestures: the target string, with `'*'` as the wildcard
   *  sentinel. Defaults to `'*'` when the slot is omitted. Undefined for
   *  hasTarget=false gestures. */
  target: string | undefined;
  /** Structured modifier requirements. Empty map = "no modifiers held". */
  modifiers: ParsedModifiers;
}

const RESERVED_SIGILS = new Set(['!', '@', '#', '$', '%', '^', '&']);
const ACTIVE_SIGILS = new Set(['+', '?']);
const VALID_MOD_NAMES: readonly ModName[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];
const MOD_NAME_SET = new Set<string>(VALID_MOD_NAMES);
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/mike/src/weasel && npx tsc --noEmit 2>&1 | grep -E "routeGrammar" | head -10
```

Expect errors only at the existing `parseRoute`/`formatRoute` implementations below (still using v2 shape). Don't fix yet — that's A2/A3.

- [ ] **Step 3: Commit the type scaffold**

```bash
cd /Users/mike/src/weasel
git add src/tools/routing/routeGrammar.ts
git commit -m "feat(routing): v3 ParsedRoute shape + sigil reservations (WIP, parser still v2)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A2: New `parseRoute` (tokenizer-based, ws-tolerant)

**Files:**
- Modify: `/Users/mike/src/weasel/src/tools/routing/routeGrammar.ts`
- Modify: `/Users/mike/src/weasel/src/tools/routing/routeGrammar.test.ts`

- [ ] **Step 1: Write failing tests for v3 parsing**

Replace the existing `routeGrammar.test.ts` content with:

```ts
import { describe, it, expect } from 'vitest';
import { parseRoute, formatRoute, type ParsedRoute } from './routeGrammar';

describe('parseRoute v3', () => {
  // ---- Basic shape ----

  it('parses a click with empty target and one modifier', () => {
    expect(parseRoute('[initial] click => empty +shift')).toEqual({
      phases: ['initial'], gesture: 'click', arg: undefined,
      target: 'empty', modifiers: { shift: 'required' },
    } satisfies ParsedRoute);
  });

  it('parses an optional modifier', () => {
    expect(parseRoute('[initial] keyDown(ArrowDown) ?shift')).toEqual({
      phases: ['initial'], gesture: 'keyDown', arg: 'ArrowDown',
      target: undefined, modifiers: { shift: 'optional' },
    });
  });

  it('parses multiple modifier atoms', () => {
    expect(parseRoute('[initial] click => empty +mod ?shift')).toEqual({
      phases: ['initial'], gesture: 'click', arg: undefined,
      target: 'empty', modifiers: { mod: 'required', shift: 'optional' },
    });
  });

  it('parses a phase list', () => {
    expect(parseRoute('[initial,engaged] contextMenu => empty')).toEqual({
      phases: ['initial', 'engaged'], gesture: 'contextMenu',
      arg: undefined, target: 'empty', modifiers: {},
    });
  });

  it('parses [*] as the wildcard phase', () => {
    expect(parseRoute('[*] click => empty')).toEqual({
      phases: ['*'], gesture: 'click', arg: undefined,
      target: 'empty', modifiers: {},
    });
  });

  // ---- Wildcards & elision ----

  it('omitted targetSlot resolves to "*" for hasTarget gestures', () => {
    expect(parseRoute('[initial] click')).toEqual({
      phases: ['initial'], gesture: 'click', arg: undefined,
      target: '*', modifiers: {},
    });
  });

  it('explicit "=> *" parses to the same shape as omitted target', () => {
    expect(parseRoute('[initial] click => *')).toEqual(parseRoute('[initial] click'));
  });

  it('omitted argSlot resolves to descriptor default for wheel', () => {
    expect(parseRoute('[initial] wheel')).toEqual({
      phases: ['initial'], gesture: 'wheel', arg: '*',
      target: undefined, modifiers: {},
    });
  });

  it('explicit "wheel(*)" parses to the same shape as omitted arg', () => {
    expect(parseRoute('[initial] wheel(*)')).toEqual(parseRoute('[initial] wheel'));
  });

  // ---- Whitespace tolerance ----

  it('accepts arbitrary whitespace between tokens', () => {
    const canonical = '[initial] click => empty +shift';
    const messy    = '[ initial ]   click   =>   empty   +shift';
    expect(parseRoute(messy)).toEqual(parseRoute(canonical));
  });

  it('accepts whitespace in phase list', () => {
    expect(parseRoute('[ initial , engaged ] click')).toEqual(
      parseRoute('[initial,engaged] click'),
    );
  });

  it('preserves whitespace inside argSlot', () => {
    // The space key fires as KeyboardEvent.key === ' '.
    expect(parseRoute('[initial] keyDown( )')).toEqual({
      phases: ['initial'], gesture: 'keyDown', arg: ' ',
      target: undefined, modifiers: {},
    });
  });

  // ---- Errors ----

  it('rejects empty phase list', () => {
    expect(() => parseRoute('[] click')).toThrow(/empty phase list/i);
  });

  it('rejects missing phase brackets', () => {
    expect(() => parseRoute('initial click')).toThrow(/phase.*bracket/i);
  });

  it('rejects unknown gesture name', () => {
    expect(() => parseRoute('[initial] bogus => empty')).toThrow(/unknown gesture/i);
  });

  it('rejects target slot on a no-target gesture', () => {
    expect(() => parseRoute('[initial] wheel(up) => foo')).toThrow(/wheel.*no target/i);
  });

  it('rejects arg slot on a no-arg gesture', () => {
    expect(() => parseRoute('[initial] click(foo) => empty')).toThrow(/click.*no arg/i);
  });

  it('rejects unknown enum arg value', () => {
    expect(() => parseRoute('[initial] wheel(sideways)')).toThrow(/sideways.*up.*down/i);
  });

  it('rejects unknown modifier name', () => {
    expect(() => parseRoute('[initial] click => empty +bogus')).toThrow(/unknown modifier/i);
  });

  it('rejects duplicate modifier in modSlot', () => {
    expect(() => parseRoute('[initial] click => empty +shift ?shift')).toThrow(/duplicate modifier/i);
    expect(() => parseRoute('[initial] click => empty +shift +shift')).toThrow(/duplicate modifier/i);
  });

  it('rejects reserved sigils', () => {
    for (const sigil of ['!', '@', '#', '$', '%', '^', '&']) {
      expect(() => parseRoute(`[initial] click => empty ${sigil}shift`))
        .toThrow(/reserved/i);
    }
  });

  it('rejects unbalanced argSlot parens', () => {
    expect(() => parseRoute('[initial] keyDown(ArrowDown')).toThrow(/unbalanced|paren/i);
    expect(() => parseRoute('[initial] keyDown ArrowDown)')).toThrow(/unbalanced|paren|unexpected/i);
  });
});

describe('formatRoute v3 (canonical form)', () => {
  it('emits one space after "]"', () => {
    expect(formatRoute({
      phases: ['initial'], gesture: 'click', arg: undefined,
      target: 'empty', modifiers: { shift: 'required' },
    })).toBe('[initial] click => empty +shift');
  });

  it('emits two spaces around "=>"', () => {
    expect(formatRoute({
      phases: ['initial'], gesture: 'click', arg: undefined,
      target: 'selected-body', modifiers: {},
    })).toBe('[initial] click => selected-body');
  });

  it('emits space before each mod atom', () => {
    expect(formatRoute({
      phases: ['initial'], gesture: 'click', arg: undefined,
      target: 'empty', modifiers: { mod: 'required', shift: 'optional' },
    })).toBe('[initial] click => empty +mod ?shift');
  });

  it('elides "=> *" for hasTarget gestures', () => {
    expect(formatRoute({
      phases: ['initial'], gesture: 'click', arg: undefined,
      target: '*', modifiers: {},
    })).toBe('[initial] click');
  });

  it('elides default arg for wheel', () => {
    expect(formatRoute({
      phases: ['initial'], gesture: 'wheel', arg: '*',
      target: undefined, modifiers: {},
    })).toBe('[initial] wheel');
  });

  it('keeps explicit arg', () => {
    expect(formatRoute({
      phases: ['initial'], gesture: 'wheel', arg: 'up',
      target: undefined, modifiers: {},
    })).toBe('[initial] wheel(up)');
  });

  it('emits no spaces in phase list comma', () => {
    expect(formatRoute({
      phases: ['initial', 'engaged'], gesture: 'contextMenu', arg: undefined,
      target: '*', modifiers: {},
    })).toBe('[initial,engaged] contextMenu');
  });

  it('round-trips every example', () => {
    const examples = [
      '[initial] click',
      '[initial] click => empty',
      '[initial] click => empty +shift',
      '[initial] click => selected-body +mod',
      '[initial] keyDown(ArrowDown) ?shift',
      '[initial] wheel(up)',
      '[initial] wheel',
      '[initial,engaged] contextMenu',
      '[*] click',
      '[initial] click => empty +mod ?shift',
    ];
    for (const r of examples) {
      expect(formatRoute(parseRoute(r))).toBe(r);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/mike/src/weasel && npx vitest run src/tools/routing/routeGrammar.test.ts 2>&1 | tail -15
```

Expected: nearly all tests fail (parser still v2).

- [ ] **Step 3: Implement v3 parseRoute**

Replace the body of `parseRoute` in `routeGrammar.ts` with a tokenizer-based parser. Sketch:

```ts
export function parseRoute(input: string): ParsedRoute {
  // 1) Extract bracketed phaseSlot from the head.
  const trimmed = input.trim();
  if (!trimmed.startsWith('[')) {
    throw new Error(`invalid route (phase brackets required): ${input}`);
  }
  const closeIdx = trimmed.indexOf(']');
  if (closeIdx < 0) throw new Error(`invalid route (unclosed phase bracket): ${input}`);
  const phaseListRaw = trimmed.slice(1, closeIdx).trim();
  const phases = parsePhaseList(phaseListRaw, input);
  let rest = trimmed.slice(closeIdx + 1).trim();

  // 2) Pull off the gesture name (alphanumeric).
  const gestureMatch = /^([A-Za-z]+)/.exec(rest);
  if (!gestureMatch) throw new Error(`invalid route (no gesture): ${input}`);
  const gestureName = gestureMatch[1]!;
  if (!isKnownGestureName(gestureName)) {
    throw new Error(`invalid route (unknown gesture "${gestureName}"): ${input}`);
  }
  rest = rest.slice(gestureMatch[0].length).trimStart();
  const desc = getGestureDescriptor(gestureName);

  // 3) Optional argSlot: `(...)`. Whitespace inside parens is significant.
  let arg: string | undefined;
  if (rest.startsWith('(')) {
    const closeArg = rest.indexOf(')');
    if (closeArg < 0) throw new Error(`invalid route (unbalanced arg parens): ${input}`);
    const argRaw = rest.slice(1, closeArg);   // no trim — whitespace significant
    if (!desc.arg) throw new Error(`invalid route (${gestureName} has no arg): ${input}`);
    if (argRaw !== '*' && desc.arg.values !== 'free' && !desc.arg.values.includes(argRaw)) {
      throw new Error(`invalid route (${argRaw} not in ${desc.arg.values.join('|')}): ${input}`);
    }
    arg = argRaw;
    rest = rest.slice(closeArg + 1).trimStart();
  } else if (desc.arg) {
    arg = desc.arg.default ?? '*';
  }

  // 4) Optional targetSlot: `=> <target>`.
  let target: string | undefined;
  if (rest.startsWith('=>')) {
    if (!desc.hasTarget) throw new Error(`invalid route (${gestureName} has no target): ${input}`);
    rest = rest.slice(2).trimStart();
    // Target extends until whitespace or sigil character.
    const tgtMatch = /^([^\s+?!@#$%^&]+)/.exec(rest);
    if (!tgtMatch) throw new Error(`invalid route (missing target after "=>"): ${input}`);
    target = tgtMatch[1]!;
    rest = rest.slice(tgtMatch[0].length).trimStart();
  } else if (desc.hasTarget) {
    target = '*';
  } else if (rest.length > 0 && (rest.startsWith('=>') || /^[a-z]/.test(rest))) {
    throw new Error(`invalid route (${gestureName} has no target): ${input}`);
  }

  // 5) modSlot — zero or more sigil-prefixed atoms separated by whitespace.
  const modifiers: ParsedModifiers = {};
  while (rest.length > 0) {
    const ch = rest[0]!;
    if (RESERVED_SIGILS.has(ch)) {
      throw new Error(`invalid route ("${ch}" is reserved for future use): ${input}`);
    }
    if (!ACTIVE_SIGILS.has(ch)) {
      throw new Error(`invalid route (unexpected "${ch}" at "${rest}"): ${input}`);
    }
    const sigil = ch;
    rest = rest.slice(1);
    const nameMatch = /^([a-z]+)/.exec(rest);
    if (!nameMatch) throw new Error(`invalid route (sigil "${sigil}" without modifier name): ${input}`);
    const name = nameMatch[1]!;
    if (!MOD_NAME_SET.has(name)) {
      throw new Error(`invalid route (unknown modifier "${name}"): ${input}`);
    }
    if (modifiers[name as ModName] !== undefined) {
      throw new Error(`invalid route (duplicate modifier "${name}"): ${input}`);
    }
    modifiers[name as ModName] = sigil === '+' ? 'required' : 'optional';
    rest = rest.slice(nameMatch[0].length).trimStart();
  }

  return { phases, gesture: gestureName, arg, target, modifiers };
}

function parsePhaseList(raw: string, input: string): ParsedRoute['phases'] {
  if (raw === '') throw new Error(`invalid route (empty phase list): ${input}`);
  if (raw === '*') return ['*'];
  const phases = raw.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
  if (phases.length === 0) throw new Error(`invalid route (empty phase list): ${input}`);
  return phases as readonly RoutePhase[];
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd /Users/mike/src/weasel && npx vitest run src/tools/routing/routeGrammar.test.ts 2>&1 | tail -10
```

Expected: parser tests pass; formatter tests still fail (next task).

- [ ] **Step 5: Commit (parser only)**

```bash
cd /Users/mike/src/weasel
git add src/tools/routing/routeGrammar.ts src/tools/routing/routeGrammar.test.ts
git commit -m "feat(routing): v3 parseRoute with bracketed phases, sigil mods, wildcards

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A3: New `formatRoute` (canonical emit form)

**Files:**
- Modify: `/Users/mike/src/weasel/src/tools/routing/routeGrammar.ts`

- [ ] **Step 1: Implement formatRoute**

Replace the existing `formatRoute` body in `routeGrammar.ts`:

```ts
const MOD_ORDER: readonly ModName[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];

export function formatRoute(r: ParsedRoute): string {
  const desc = getGestureDescriptor(r.gesture);

  // Phase slot.
  const phaseStr =
    r.phases.length === 1 && r.phases[0] === '*'
      ? '[*]'
      : `[${r.phases.join(',')}]`;

  let out = `${phaseStr} ${r.gesture}`;

  // Arg slot — elide default.
  if (desc.arg) {
    const isDefault = r.arg === undefined || (desc.arg.default !== undefined && r.arg === desc.arg.default);
    if (!isDefault) out += `(${r.arg})`;
  }

  // Target slot — elide "*" (the wildcard default for hasTarget gestures).
  if (desc.hasTarget && r.target !== undefined && r.target !== '*') {
    out += ` => ${r.target}`;
  }

  // Mod atoms in canonical order, space-separated.
  const atoms: string[] = [];
  for (const name of MOD_ORDER) {
    const req = r.modifiers[name];
    if (req === 'required') atoms.push(`+${name}`);
    else if (req === 'optional') atoms.push(`?${name}`);
  }
  if (atoms.length > 0) out += ` ${atoms.join(' ')}`;

  return out;
}
```

- [ ] **Step 2: Run all routeGrammar tests**

```bash
cd /Users/mike/src/weasel && npx vitest run src/tools/routing/routeGrammar.test.ts 2>&1 | tail -10
```

Expected: every test (parser + formatter + round-trip) passes.

- [ ] **Step 3: Typecheck**

```bash
cd /Users/mike/src/weasel && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only at downstream consumers (registry.ts, registryProbe, RouteBadge) — they consume the old v2 shape. Don't fix yet.

- [ ] **Step 4: Commit**

```bash
cd /Users/mike/src/weasel
git add src/tools/routing/routeGrammar.ts
git commit -m "feat(routing): v3 formatRoute with canonical spacing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase B — Downstream consumer migration

### Task B1: Reflection emitter — structured modifiers in `RegistryEntry`

**Files:**
- Modify: `/Users/mike/src/weasel/src/tools/routing/reflection/registry.ts`
- Modify: `/Users/mike/src/weasel/src/tools/routing/reflection/registry.test.ts`

- [ ] **Step 1: Update `RegistryEntry`**

In `registry.ts`, change `modifiers` from `ModifierKey` to the structured form:

```ts
import type { ParsedModifiers } from '../routeGrammar';
import { modifierKeyToParsed } from './modifierKeyToParsed';

export interface RegistryEntry {
  toolId: string;
  phase: RoutePhase;
  gesture: GestureName;
  arg: string | undefined;
  target: string | undefined;
  /** Structured modifier requirements (v3 shape). Empty object = "no
   *  modifiers held" (the strict default). */
  modifiers: ParsedModifiers;
}
```

- [ ] **Step 2: Add the `ModifierKey` → `ParsedModifiers` adapter**

Create `/Users/mike/src/weasel/src/tools/routing/reflection/modifierKeyToParsed.ts`:

```ts
import type { ModifierKey } from '../modifiers';
import type { ParsedModifiers, ModName } from '../routeGrammar';

/** Translate the tool-authoring `ModifierKey` enum (positional string like
 *  `'mod+shift+alt'`) to the v3 structured-map form (every listed mod
 *  becomes 'required', unlisted means forbidden). 'default' yields {}. */
export function modifierKeyToParsed(key: ModifierKey): ParsedModifiers {
  if (key === 'default') return {};
  const out: ParsedModifiers = {};
  for (const part of key.split('+')) {
    out[part as ModName] = 'required';
  }
  return out;
}
```

- [ ] **Step 3: Update emitters in `registry.ts`**

Every `out.push({ ..., modifiers: 'default' })` becomes `modifiers: {}`. Every `modifiers: modKey` (in `walkModifierRoute`) becomes `modifiers: modifierKeyToParsed(modKey)`.

- [ ] **Step 4: Update tests**

In `registry.test.ts`, replace every `modifiers: 'default'` with `modifiers: {}`, every `modifiers: 'shift'` with `modifiers: { shift: 'required' }`, every `modifiers: 'mod+shift'` with `modifiers: { mod: 'required', shift: 'required' }`. Same for any other `modifiers:` literal.

Then in `conflicts.ts`/`conflicts.test.ts` (Phase D in the prior plan widened these), the conflict-dedup key should now stringify the structured modifiers stably. Update the key derivation to JSON.stringify the modifiers map (or sort keys + concat) so equivalent maps hash identically.

- [ ] **Step 5: Run tests**

```bash
cd /Users/mike/src/weasel && npx vitest run src/tools/routing/reflection 2>&1 | tail -10
cd /Users/mike/src/weasel && npx tsc --noEmit 2>&1 | head -30
```

Expected: reflection tests pass; ToolkitBuilder + registryProbe tsc errors remain (next tasks).

- [ ] **Step 6: Commit**

```bash
cd /Users/mike/src/weasel
git add src/tools/routing/reflection
git commit -m "feat(routing): RegistryEntry.modifiers is now structured (v3 shape)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task B2: `registryProbe.tsx` — emit v3 route strings via `formatRoute`

**Files:**
- Modify: `/Users/mike/src/weasel/apps/swillustrator/src/dev/registryProbe.tsx`

- [ ] **Step 1: Locate `formatRoutes`**

```bash
grep -n "formatRoutes\|formatRoute\b" /Users/mike/src/weasel/apps/swillustrator/src/dev/registryProbe.tsx
```

- [ ] **Step 2: Rewrite to use the kit's `formatRoute`**

Replace the body of `formatRoutes` with a one-liner per entry:

```ts
import { formatRoute } from '@orochi235/weasel/routing';

function formatRoutes(entries: readonly RegistryEntry[]): readonly string[] {
  return entries.map((e) => formatRoute({
    phases: [e.phase],
    gesture: e.gesture,
    arg: e.arg,
    target: e.target,
    modifiers: e.modifiers,
  }));
}
```

(`RegistryEntry.modifiers` is already `ParsedModifiers` after B1, so no translation needed.)

- [ ] **Step 3: Run tests**

```bash
cd /Users/mike/src/weasel && npx vitest run apps/swillustrator 2>&1 | tail -10
```

Expected: most inspector tests pass; RouteBadge tests fail (next task).

- [ ] **Step 4: Commit**

```bash
cd /Users/mike/src/weasel
git add apps/swillustrator/src/dev/registryProbe.tsx
git commit -m "refactor(inspector): registryProbe emits v3 route strings via kit formatter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task B3: `RouteBadge` renders v3 shape

**Files:**
- Modify: `/Users/mike/src/weasel/apps/swillustrator/src/dev/RegistryDetail.tsx`
- Modify: `/Users/mike/src/weasel/apps/swillustrator/src/dev/RegistryDetail.test.tsx`
- Maybe modify: `/Users/mike/src/weasel/apps/swillustrator/src/dev/RegistryInspector.module.css`

- [ ] **Step 1: Write failing tests**

Replace the existing `RouteBadge` test block in `RegistryDetail.test.tsx` with v3 cases:

```tsx
describe('RouteBadge v3', () => {
  it('renders bracketed phase list', () => {
    render(<RouteBadge route="[initial] click => empty +shift" />);
    expect(screen.getByText('initial')).toBeTruthy();
    expect(screen.getByText('click')).toBeTruthy();
    expect(screen.getByText('empty')).toBeTruthy();
    expect(screen.getByText('⇧')).toBeTruthy();
  });

  it('renders multi-phase list', () => {
    render(<RouteBadge route="[initial,engaged] contextMenu => empty" />);
    expect(screen.getByText('initial')).toBeTruthy();
    expect(screen.getByText('engaged')).toBeTruthy();
  });

  it('renders [*] as the "any phase" badge', () => {
    render(<RouteBadge route="[*] click => empty" />);
    expect(screen.getByText('*')).toBeTruthy();
  });

  it('renders optional modifier inverted', () => {
    const { container } = render(<RouteBadge route="[initial] keyDown(ArrowDown) ?shift" />);
    // Inverted keycap: the ⇧ chip has data-inverted set.
    const cap = container.querySelector('[data-inverted]');
    expect(cap?.textContent).toBe('⇧');
  });

  it('renders wildcard target as no target chip', () => {
    const { container } = render(<RouteBadge route="[initial] click" />);
    // No `.tag` chip for the elided "*" target.
    expect(container.querySelector(`.${require('./RegistryInspector.module.css').default.tag}`)).toBeFalsy();
  });
});
```

(The `.tag` selector is fragile to CSS-module hashing — adjust to the actual assertion technique that works in this codebase if needed.)

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/dev/RegistryDetail.test.tsx -t RouteBadge 2>&1 | tail -10
```

Expected: failures.

- [ ] **Step 3: Rewrite `RouteBadge`**

In `RegistryDetail.tsx`, update `modifierKeys` to consume the structured `ParsedModifiers` shape, and update `RouteBadge` to render the v3 phase list:

```tsx
import type { ParsedModifiers, ModName } from '@orochi235/weasel/routing';

const MOD_GLYPHS: Record<ModName, string> = { mod: '⌘', shift: '⇧', alt: '⌥', ctrl: '⌃', meta: '⌘' };
const MOD_ORDER: readonly ModName[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];

function modifierKeys(modifiers: ParsedModifiers): readonly KeySpec[] | undefined {
  const keys: KeySpec[] = [];
  for (const name of MOD_ORDER) {
    const req = modifiers[name];
    if (req !== undefined) {
      keys.push({ label: MOD_GLYPHS[name], optional: req === 'optional' });
    }
  }
  return keys.length > 0 ? keys : undefined;
}

export function RouteBadge({ route }: { route: string }) {
  const parsed = parseRoute(route);
  const desc = getGestureDescriptor(parsed.gesture as GestureName);
  const modKeys = modifierKeys(parsed.modifiers);
  const showArg = !!desc.arg
    && parsed.arg !== undefined
    && (desc.arg.default === undefined || parsed.arg !== desc.arg.default);
  const showTarget = desc.hasTarget && parsed.target !== undefined && parsed.target !== '*';
  const targetless = !desc.hasTarget;

  return (
    <span className={s.routeBadge}>
      {/* Bracketed phase list. */}
      <span className={s.phaseGroup}>
        {parsed.phases.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && <span className={s.phaseSep}>,</span>}
            <Badge {...(PHASE_BADGE_PROPS as BadgeProps)}>{p}</Badge>
          </Fragment>
        ))}
      </span>
      <Badge
        {...(GESTURE_BADGE_PROPS as BadgeProps)}
        className={targetless && !showArg ? s.flatRight : undefined}
      >
        {parsed.gesture}
      </Badge>
      {showArg && (
        <code className={[s.argChip, targetless ? s.flatLeft : undefined].filter(Boolean).join(' ')}>
          {parsed.arg}
        </code>
      )}
      {showTarget && <code className={s.tag}>{parsed.target}</code>}
      {modKeys && <KeySequence keys={modKeys} />}
    </span>
  );
}
```

Add CSS in `RegistryInspector.module.css`:

```css
.phaseGroup { display: inline-flex; align-items: center; gap: 2px; }
.phaseSep { color: var(--wzl-muted, #a59685); font-size: 11px; }
```

- [ ] **Step 4: Run tests + full suite**

```bash
cd /Users/mike/src/weasel
npx vitest run apps/swillustrator/src/dev/RegistryDetail.test.tsx 2>&1 | tail -10
npx vitest run --reporter=dot 2>&1 | tail -10
npx tsc --noEmit 2>&1 | head -10
```

Expected: green across the board.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/src/weasel
git add apps/swillustrator/src/dev
git commit -m "feat(inspector): RouteBadge renders v3 grammar (bracketed phases, structured mods)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase C — Cleanup

### Task C1: Sweep for stale v2 references

**Files:** any.

- [ ] **Step 1: Grep for v2 leftovers**

```bash
cd /Users/mike/src/weasel
grep -rn "modifiers: 'default'\|modifiers === 'default'\|ModifierKey\b" src apps packages --include='*.ts' --include='*.tsx' 2>/dev/null | head -30
```

For each result:
- Tool-authoring sites (`ModifierRoute<TScratch>` uses, `mods()` helper, computed-property keys in route tables) — **leave alone**. `ModifierKey` continues to exist at the tool-authoring layer.
- Wire-format sites (anything that touches a `RegistryEntry.modifiers`, parsed route, or route string) — **update** to the v3 structured form.

- [ ] **Step 2: Run full suite**

```bash
cd /Users/mike/src/weasel && npx vitest run --reporter=dot 2>&1 | tail -8
cd /Users/mike/src/weasel && npx tsc --noEmit
cd /Users/mike/src/weasel && npm run build 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 3: Commit if any edits**

```bash
cd /Users/mike/src/weasel
git commit -am "chore(routing): sweep v2 modifier-string references

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**

- ✅ Bracketed phase slot with list + `*` wildcard (A2)
- ✅ `=>` separator between gesture and target (A2 parser; A3 formatter)
- ✅ Sigil-prefixed mod atoms (`+`, `?`) (A2/A3)
- ✅ Reserved sigils `! @ # $ % ^ &` rejected with "reserved" error (A2)
- ✅ `*` as universal wildcard in phase / arg / target slots (A2/A3)
- ✅ Canonical spacing: one space after `]`, two around `=>`, space between mod atoms (A3)
- ✅ Whitespace tolerance everywhere except inside `(...)` (A2)
- ✅ `=> *` and `wheel(*)` elision in canonical form (A3)
- ✅ Structured `ParsedRoute.modifiers` map; `ModifierKey` kept for tool-authoring only (A1, B1)
- ✅ Reflection emitter + inspector both consume v3 (B1, B2, B3)

**Known sequencing:**

- Phase A is self-contained — the grammar files swap out without touching consumers. The kit will fail to typecheck mid-phase (between A3 and B1), which is fine for a feature branch but means **don't push** until B3 lands.
- Phase B1/B2/B3 each fix one downstream consumer. Each task ends in a green tsc + full test sweep.

**Risks:**

- The `conflicts.ts` dedup key needs a stable stringification for the new structured modifiers map. JSON.stringify is fine as long as the keys are sorted; safer to write a tiny canonical-modifiers serializer (`Object.keys(mods).sort().map(...)`). Flag in B1.
- The "elide `=> *`" rule means a tool with no routes for any target won't appear in the inspector's RouteTargets list. That's already the v2 behavior (`collectRouteTargets` filters undefined) and stays correct: `*` is still a string, so `collectRouteTargets` would put `'*'` in the list. Filter `'*'` out alongside undefined in `collectRouteTargets`.
- Existing tests use route strings like `'initial.click.empty:shift'` as fixtures. Every such literal needs migration to v3. Search for `.click.\|.drag.\|.wheel\|.keyDown\|.dblTap\|.contextMenu\|.multiTouchTap` across tests during C1.
