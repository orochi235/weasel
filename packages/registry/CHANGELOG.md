# @weasel-js/registry

## 1.10.1

### Patch Changes

- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.

## 1.10.0

### Patch Changes

- 27b827e: text: the run algebra lives here now: `styleAtRange`, `applyStyleToRange`, `patchRangeStyle`, `effectiveRangeStyle`, `rangeWeight`, `setFlagOverRange`, `nodeHasFlag`, and `unboldPatch`, with the `RangeStyle`, `RunStylePatch`, `StyleKey`, `FlagKey`, and `SetFlagResult` types. `runsCarryStyling` and `supersededKey` are exported beside them. None of them needed a scene. The `MIXED` sentinel and its `Mixed` type moved to `@weasel-js/registry`, and text exports them too. `@weasel-js/core` still exports every name it did before.
- ee08fa5: Adds API: `Reflectable.release(key, registrant)` removes exactly one registrant from a key's stack, live or shadowed, whether `push` or `set` wrote it, and returns whether it was there. Removing the live one uncovers the one beneath. It shares one removal path with the function `push` returns, so releasing by either makes the other a no-op.
  
  Adds API: `ReflectedEntry.live` is the registrant holding the key. It is the same frozen object in every snapshot, and the one `shadowed` lists once something displaces it, so a row drawn from `reflection.entries()` can hand any registrant it shows straight to `release`. `value` and `source` stay on the entry as they were.

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
