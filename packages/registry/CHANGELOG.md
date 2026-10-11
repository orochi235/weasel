# @weasel-js/registry

## 1.9.4

### Patch Changes

- 001aaae: `@weasel-js/registry` exports `createEmitter()`, one subscribe/notify pair with stated semantics: a pass calls the listeners held when it began, one unsubscribed before its turn is skipped, and a listener that throws is reported to `console.error` without stopping the others or throwing into the store. The reflectable registry, modes' scoping layer and decorations, and core's pose overrides, pose feed, layout reflow, parallax plane, and key state are built on it. For those stores, a listener that subscribes during a notify now waits for the next one, and a throwing listener no longer aborts the notify.
- 4d559ca: `isPlainObject` lives in `@weasel-js/registry` (core still exports it), and `@weasel-js/geom` exports a scalar `clamp(v, lo, hi)`. theme, prefs, labkit, and forge read plain objects through the one realm-safe test, so a `Date` or a `Map` no longer passes where they accept a record; ui's Slider and ResizeHandle, hud's loupe, and labkit's ZoomControl use geom's clamp. When its bounds cross, ResizeHandle now holds to `min` where it held to `max`. theme and prefs gain a dependency on registry, and ui's on geom moves from dev to runtime.

## 1.9.3

No changes in this release.

## 1.9.2

No changes in this release.

## 1.9.1

No changes in this release.

## 1.9.0

No changes in this release.

## 1.8.1

No changes in this release.

## 1.8.0

No changes in this release.

## 1.7.3

No changes in this release.

## 1.7.2

No changes in this release.

## 1.7.1

No changes in this release.

## 1.7.0

### Patch Changes

- a028cc3: New package `@weasel-js/registry`: `createReflectable()` is a keyed store a registry embeds to hand out a uniform read-only `Reflection` — `get`, `has`, `entries()`, `subscribe` and `getVersion`, shaped for `useSyncExternalStore`. Each entry reports the registrant's `source` and the registrants it displaced (`shadowed`), so overrides of one key show up as conflicts.
  
  The kit's module-level registries now expose one: `paintKindRegistry`, `markerRegistry`, `opFactoryRegistry`, `fontRegistry`, `fontOutlineRegistry` (which also notifies as a face's load state moves), and, from `@weasel-js/core/renderer`, `programSourceRegistry` and `textureRegistry`. `ModeRegistry` gains `reflection`. Built-in paint kinds and markers report `source: 'kit'`.
  
  Fixes paint-kind and marker overrides disposed out of order: with two overrides of one id, disposing the earlier and then the later used to restore the already-disposed earlier one instead of the built-in. Overrides now stack, and each disposer removes only its own entry.
