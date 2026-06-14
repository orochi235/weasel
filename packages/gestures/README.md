# @weasel-js/gestures

**Pure gesture-routing primitives.** No React, no DOM, no scene-graph
awareness — just types, parsers, and pure matcher functions. Designed
as the abstract foundation under [`@weasel-js/core`](../../README.md)'s
declarative tool routing, but usable independently of the kit.

This package answers two questions:

1. **What does a route look like?** A route is a small grammar string
   like `[engaged] drag(*) => node +shift` that names a gesture, the
   phase it fires in, an optional arg, an optional target kind, and
   any required/optional modifiers. The grammar is parseable to a
   structured `ParsedRoute` and back via `parseRoute` / `formatRoute`.
2. **Did this input event match a route?** Given a normalized
   `InputEvent` (the package's DOM-independent event shape) and a
   `GestureSpec` (the matchable form of a route), `matchSpec` returns
   true/false. The matcher is pure — no React, no element refs, no
   side effects.

The kit composes these primitives into Tool definitions, declarative
binding tables, and the dispatcher; downstream apps can also build
their own gesture systems on top of `matchSpec` without taking the
rest of the kit.

## Why a separate package?

The grammar and matcher have zero React / DOM dependencies. Splitting
them out makes:

- The kit's `useTools` / dispatcher implementation testable against the
  same matcher consumers can use.
- Headless or non-React environments (Worker / SSR / engines) able to
  reuse the route parsing without dragging in the rest of the kit.
- The grammar versionable independently — additions to the gesture set
  (new arg kinds, new modifier requirements) can land here without
  affecting downstream renderers.

This package is currently `private: true` and ships as a workspace
dependency of `@weasel-js/core`. Stabilize the surface here before
any external publish.

## Surface overview

Loosely grouped:

### Gesture taxonomy (`grammar/`)
- `GESTURE_DESCRIPTORS` / `getGestureDescriptor` — the closed list of
  recognized gesture names (`click`, `pointerDown`, `dblTap`, `drag`,
  `wheel`, `keyDown`, `keyUp`, `contextMenu`, `multiTouchTap`), each
  with their arg schema and whether they take a target.
- `GestureName` / `GestureDescriptor` / `GestureArgSpec` — the types.

### Route grammar
- `parseRoute` / `formatRoute` — string ↔ `ParsedRoute`. The v3
  grammar: `[phase] gesture(arg) => target +mod`.
- `parseKeyRoute` / `formatKeyRoute` / `keyRouteToSpec` — sugar for
  the keyboard-shortcut subset (`Cmd+K`-style strings).
- `ParsedRoute`, `ParsedKeyRoute`, `PhaseAtom`, `ChannelRef`,
  `ParsedModifiers`, `ModName`, `ModRequirement`.

### Matching (`ui/`)
- `matchSpec(event, spec)` — given a normalized input event and a
  `GestureSpec`, return whether the spec matches. Pure function.
- `matchModifiers`, `matchKey`, `matchTarget` — the three sub-matchers
  it composes.
- `GestureSpec` union covering each recognized gesture, plus
  per-gesture spec types (`KeySpec`, `DragSpec`, `ClickSpec`,
  `WheelSpec`, `KeyHeldSpec`, …).
- `InputEvent` — the package's DOM-independent input shape consumers
  feed into `matchSpec`.

### Modifier helpers
- `mods()` — fluent builder for `ModSpec`.
- `ModifierKey` / `modifierKeyToParsed` / `canonicalModifiers` — the
  string-key ↔ structured-modifier-map conversions used by the route
  grammar.

### Phases
- `RoutePhase` — the routing-phase enum the kit's dispatcher consults
  (`initial` / `engaged`).

## Directory layout

- `src/grammar/` — abstract logic. Gesture taxonomy, modifier helpers,
  route + key-route grammars, modifier reflection. No event / UI types.
- `src/ui/` — UI-flavored types. `GestureSpec` union, normalized
  `InputEvent`, the pure matcher, and `RoutePhase`.
- `src/index.ts` — re-exports both.

The split makes the grammar layer importable from environments where
even the lightweight `InputEvent` shape would be unwanted ceremony.

## Consuming

```ts
import {
  parseRoute,
  matchSpec,
  mods,
  type InputEvent,
  type DragSpec,
} from '@weasel-js/gestures';

const parsed = parseRoute('[engaged] drag => node +shift');
// parsed.phases = [{ channel: '&', phase: 'engaged' }]
// parsed.gesture = 'drag'
// parsed.target = 'node'
// parsed.modifiers = { shift: 'required' }

const spec: DragSpec = {
  kind: 'drag',
  target: 'node',
  mods: mods().shift(),
};
const event: InputEvent = { /* normalized pointermove event */ };
matchSpec(event, spec); // true / false
```
