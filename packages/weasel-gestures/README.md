# @orochi235/weasel-gestures

Pure gesture-routing primitives for the weasel kit and downstream apps. No React, no DOM, no scene-graph awareness. Just types, parsers, and pure matcher functions.

Exports:
- `GESTURE_DESCRIPTORS`, `getGestureDescriptor`, `GestureName`, `GestureDescriptor`, `GestureArgSpec`
- `parseRoute`, `formatRoute`, `ParsedRoute`
- `parseKeyRoute`, `formatKeyRoute`, `keyRouteToSpec`, `ParsedKeyRoute`, `OptionalMod`
- `matchSpec`, `matchModifiers`, `matchKey`, `matchTarget`
- `modifierKeyToParsed`, `canonicalModifiers`
- `GestureSpec`, `KeySpec`, `KeyHeldSpec`, `WheelSpec`, `ClickSpec`, `DragSpec`, `MultiTouchSpec`, `ContextMenuSpec`, `MultiTouchTapSpec`, `ModSpec`, `TargetSpec`
- `ModifierKey`, `mods()`
- `RoutePhase`, `InputEvent`

This package is consumed by `@orochi235/weasel` and is currently `private: true`. Stabilize and lock in before any external publish.

## Directory layout

- `src/grammar/` — abstract logic: gesture taxonomy, modifier helpers, route + key-route grammars, modifier reflection. No event/UI types.
- `src/ui/` — UI-flavored types: `GestureSpec` union, normalized `InputEvent`, the pure matcher, and `RoutePhase`.

The root `src/index.ts` re-exports both.
