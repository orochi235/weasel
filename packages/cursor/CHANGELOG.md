# @weasel-js/cursor

## 1.18.2

### Patch Changes

- d416d0c: Fixes to press ownership, menus, tool sets and shortcuts in routing, and to cursor glyph lookup and mark placement.
  
  - A dispatcher leaves a press to an item inside it that opened a pointer session of its own before the dispatcher heard the press (an item listening natively rather than through React). Before, a press released in place on such an item also ran the surface's click binding.
  - `withoutTools` keeps the sets nested in the set it cuts from, so a stack inside one (path-tools' warp stack inside `RESHAPE_TOOLS`) is still a stack. Before, it flattened every nested set into plain ids. A nested set it empties is dropped.
  - A menu row asks `enabled` and `active` with the params its run hands `trigger`: the menu's own params and the point it opened at, as well as the variant's. Before, a row read only the variant's params, so an action judging the menu's params was shown disabled while `trigger` would run it, or the reverse.
  - `useCommand` compares `icon` by value, so an icon with a mark written inline (`{ name, mark }`) no longer replaces the action on every render.
  - `actionShortcuts` finds a variant's key through a binding whose `params` is a thunk.
  - `cursorFor` and `cursorGlyph` throw on a glyph or mark named like an `Object.prototype` member (`constructor`, `toString`) instead of baking it.
  - `placeCursorPath` (and `markedGlyph` through it) reads numbers written without a leading digit (`.5`), run together (`1.5.5`) or with an exponent (`1e-3`), and throws on a command whose numbers do not make whole points. Before, it misread the first three and dropped a trailing number.
- 19c6682: Fixes to shortcut chips, tuned actions, commands, gesture and UI-driven handles, the `key()` sugar and cursor angles.
  
  - `keySpecShortcut` and `actionShortcuts` give a key binding that requires `ctrl` or `meta` (without `mod`) no chip, as their docs say. Before, a Ctrl+Tab binding showed in menus and palettes as a bare `Tab`; an action bound that way now falls back to its next binding's chip, or shows none.
  - An action tuned with `params` (`ActionsRegistry.tune`, or the last-operation panel's session params) now has its `enabled` and `active` asked with those params beneath the call's, as `run`, `preview` and `cursor` already were. A trigger, menu row or palette entry no longer reads a tuned action as disabled, or not pressed, for want of a param the tuning supplies.
  - A handle opened by `beginUiOngoing` is out of flight before its `onEnd` runs, on `end()` and when a second `begin` auto-commits it, as a gesture's is. An `onEnd` reading the dispatcher no longer sees its own handle, and one that begins the same action again no longer has `onEnd` run twice.
  - `key('+')` is the plus key; it threw that the shortcut names no key. `'Mod++'` already read this way.
  - A cursor spec whose `angle` is NaN or infinite draws unrotated. Before, the baked cursor's hotspot read `NaN NaN`, so the browser dropped the cursor, and the painted tier drew nothing.
  - `useCommand` keeps its action across renders whose `keys` hold a new function in the same place, as an inline params thunk or target predicate is on every render, and the binding calls the latest one. Before, such a command was unregistered and registered again on every render.
  - An ongoing action whose `start` throws as a gesture opens it is caught and logged, as an immediate action's `run` is: the press is spent, nothing is left in flight, and the error no longer escapes into the pointer or key listener. A `start` deferred by `dragThresholdPx`, which runs on a later move, is not covered.
- b188aea: Fixes to the last operation, tunings, held previews, merged menus, tool options, scratch keys, `freshId`, cursor sizes and the scoping dim.
  
  - Adjusting the last operation after its action was unregistered, or while its `enabled` refuses, leaves the operation, the history and the selection as they were, and `adjust` returns `false`. Before, it undid the operation and put nothing in its place.
  - A tuning's params reach an action that declares a `params` form as the registry lists it, so `invokedParams` names them and a variant's shortcut chip shows for a binding that fires the variant through the tuning.
  - A held tool option that is NaN or infinite reads as its default, so the bracket keys step it again instead of leaving it NaN. An option named like an `Object.prototype` member (`toString`) reads its default.
  - `getScratch` reads a key named like an `Object.prototype` member as unset until it is written, instead of handing back the prototype's function.
  - A cursor glyph whose `size` or `worldRadius` is NaN, infinite, zero or negative draws at the default size, instead of baking `NaN` into its image, which the browser drops.
  - `createScopingDim` holds `dimAlpha` to [0, 1] and reads NaN as `OUT_OF_SCOPE_ALPHA`.
  - An action held through `holdPreview` asks its `enabled` again at the release, and runs nothing when it now refuses; the preview still comes down.
  - `freshId` numbers from 1 when `from` is NaN or infinite. Before, a NaN `from` looped forever when `base-NaN` was taken.
  - Two menu contributions sharing a key no longer overwrite a key already spelled `key~n`: the second takes the next free `~n`.
- Updated dependencies [b188aea]
  - @weasel-js/registry@1.18.2

## 1.18.1

### Patch Changes

- 7537af5: Set a mark in a cursor's corner instead of drawing one glyph per pair
  
  - A cursor glyph with a mark slot carries a mark naming what the tool does: `cursorFor('crosshair', { mark: 'rect' })`, or `{ glyph: 'pen', mark: 'add' }` as a `CursorSpec`. The mark is drawn after the glyph with a halo of its own, in both the baked and the painted tier.
  - `crosshair` and `pen` have slots. The marks are `add`, `remove`, `rect`, `ellipse`, `polygon`, `star` and `line`, in `MARKS`.
  - Breaking for `@weasel-js/cursor`: `crosshairRect`, `crosshairEllipse`, `crosshairLine`, `crosshairStar`, `crosshairPolygon` and `penPlus` are gone from `GLYPHS`. Write `cursorFor('crosshair', { mark: 'rect' })` and the like, and `{ glyph: 'pen', mark: 'add' }` for `penPlus`. Each pair bakes to the same pixels and hotspot the glyph it replaces did.
  - New exports: `cursorGlyph(name, mark?)`, `markedGlyph`, `placeCursorPath`, `cursorVariants()`, `MARKS`, and the types `CursorMark`, `CursorMarkSlot`, `CursorMarkName`, `CursorVariant` and `CursorForOptions`.
- @weasel-js/registry@1.18.1

## 1.18.0

### Patch Changes

- Updated dependencies [b93c1dd]
  - @weasel-js/registry@1.18.0

## 1.17.3

### Patch Changes

- @weasel-js/registry@1.17.3

## 1.17.2

### Patch Changes

- @weasel-js/registry@1.17.2

## 1.17.1

### Patch Changes

- @weasel-js/registry@1.17.1

## 1.17.0

### Patch Changes

- @weasel-js/registry@1.17.0

## 1.16.2

### Patch Changes

- @weasel-js/registry@1.16.2

## 1.16.1

### Patch Changes

- Updated dependencies [25a1ff7]
  - @weasel-js/registry@1.16.1

## 1.16.0

### Patch Changes

- @weasel-js/registry@1.16.0

## 1.15.2

### Patch Changes

- Updated dependencies [f1906a8]
  - @weasel-js/registry@1.15.2

## 1.15.1

### Patch Changes

- @weasel-js/registry@1.15.1

## 1.15.0

### Patch Changes

- @weasel-js/registry@1.15.0

## 1.14.2

### Patch Changes

- Updated dependencies [4bba14d]
  - @weasel-js/registry@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/registry@1.14.1

## 1.14.0

### Patch Changes

- @weasel-js/registry@1.14.0

## 1.13.0

### Patch Changes

- @weasel-js/registry@1.13.0

## 1.13.0-rc.0

### Patch Changes

- @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- @weasel-js/registry@1.11.1

## 1.11.0

### Patch Changes

- Updated dependencies [304f53a]
- Updated dependencies [63b310c]
- Updated dependencies [1be2ea9]
  - @weasel-js/registry@1.11.0

## 1.10.1

### Patch Changes

- b8bfb2d: History and its journals, `createSelectionStore`, a record cache's `subscribe` and `onOverruled`, `createPaintedCursorState`, and `useFrameClock` notify through `createEmitter()` from `@weasel-js/registry`, as every other store in the kit does. Each of these packages now depends on `@weasel-js/registry`.
  
  What changes for a consumer: a listener that throws no longer throws into whatever caused the notify, such as `applyOps`, `setSelection`, `set`, or a frame of the clock. The error goes to `console.error`, and the listeners after it still run. A notify also walks the listeners held when it began, so one added during a pass waits for the next.
- Updated dependencies [886380f]
  - @weasel-js/registry@1.10.1

## 1.10.0

### Patch Changes

- 329f658: Fixes a tool's cursor disappearing after a hover cursor: with a tool that declares a `cursor`, moving over something that shows a cursor of its own and off again left the canvas with no cursor until the tool changed. `SceneCanvas.toolCursor.test.tsx` shows it with a registered layer's hit claim. The tool's cursor and the hover cursor were written to the same inline `cursor` style by two writers, and clearing the second removed the first.
  
  Adds API: `createCursorSink({ element, painted })` in `@weasel-js/cursor`, also exported from `@weasel-js/core`, is one writer for both. It holds a base cursor and an override, writes the element's `cursor` style and the painted-cursor state, and puts the base back when the override clears. A canvas makes one and exposes it as `CanvasExtensionApi.cursorSink`; `useGestureDispatcher` takes it as the `cursorSink` option, and without one behaves as before. A hand-built `CanvasExtensionApi` now needs the `cursorSink` field.

## 1.9.4

### Patch Changes

- d0588d0: A painted cursor survives the hover-cursor pump. An action whose `activeCursor` is a painted glyph keeps its cursor through the gesture, where it used to show none: `Dispatcher.inFlightCursor()` now returns the declared `CursorSpec` and no longer its CSS form. And a painted tool cursor stops drawing under a CSS cursor a handle shows: `PaintedCursorState.setOverride` takes `'none'` for that, which paints nothing until the override clears.

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

No changes in this release.

## 1.6.1

No changes in this release.

## 1.6.0

## 1.5.2

## 1.5.1

### Patch Changes

- b6a5eed: Inserting a path anchor gets its own cursor. Alt over a segment in path-edit
  mode drew the pen tool's own glyph, so the pointer said nothing about what the
  click would do.
  
  The new `penPlus` glyph is the pen nib with a filled plus badge in the
  lower-right. The nib runs along the anti-diagonal and left no room on the
  diagonal for a badge, so it is shifted two units up and left — the same trade
  the shape cursors make with a short-armed crosshair. Proofed at 11x over the
  three grounds and on the pixel grid at 16 and 24 CSS px, 1x and 2x.

## 1.5.0

### Patch Changes

- a614be4: Extract binding-to-action routing into `@weasel-js/routing`.
  
  The gesture dispatcher, the action registry and invoker, tool and contribution
  declaration, the route grammar's reflection surface, and the eligibility rule
  algebra now live in their own package beside `@weasel-js/gestures` and
  `@weasel-js/history`. It ships two entry points: the pure dispatcher on the main
  entry — no React, no DOM — and the React seam that pumps browser events into it
  behind `@weasel-js/routing/react`, with React an optional peer. A kernel that
  drives routing itself can take the first without the second.
  
  `@weasel-js/core` depends on the new package and re-exports every symbol that
  moved, so **no existing import changes**, including `@weasel-js/core/routing`.
  A consumer that adds its own dependency still writes
  `declare module '@weasel-js/core'`; the merge carries through core's re-export.
  
  `createPaintedCursorState` and its types move to `@weasel-js/cursor`, where the
  cursor they hold is declared. `@weasel-js/core` re-exports them unchanged.

## 1.4.4

## 1.4.3

## 1.4.2

## 1.4.1

## 1.4.0

### Patch Changes

- 04ea2e8: The painted cursor tier, and cursors that tell the five shape tools apart.
  
  A cursor that cannot be a CSS cursor is now drawn into the canvas instead of
  being dropped. `resolveCursorTier` escalates when a glyph is sized in world
  units, or past the 128 CSS px above which the browser silently discards the
  image; `<Canvas>` then sets `cursor: none` and a screen-space layer paints the
  glyph at the pointer. Tools never choose the tier — they declare what they
  want, and a brush stays a brush across the radius where it stops being
  expressible as a CSS cursor.
  
  `brush` ships with it, sized by `worldRadius` so its ring measures the brush at
  every zoom. A glyph that measures something declares `CursorGlyph.radius` to
  name the circle being sized, and world-sized glyphs hold their line weight in
  CSS px while their geometry scales.
  
  `paint.ts` is the shared half: the baker and the painter both consume its
  ordered paint ops, so the two tiers draw one glyph rather than two drawings
  that resemble each other. The layer itself lives in core, which is where
  `RenderLayer` and `Path` live.
  
  rect, ellipse, line, star and polygon were all bare `crosshair` and so
  indistinguishable while in use; each now shows a crosshair badged with its
  shape, hotspotted on the cross. `Tool.cursor` on a built `Tool` widens from
  `string` to `CursorSpec`, which it should have done when `ToolDef.cursor` did.
  
  The `apps/draw` `cursor: copy` stub and its hand-rolled Alt listener are gone.
  They advertised an add-anchor sub-tool that does not exist, so the affordance
  was removed rather than relocated; `docs/TODO.md` records where it returns.
- b656ebf: Rotatable cursors, and a `CursorSpec` for the four fields that declare one.
  
  `bakeCursor` takes an `angle` in radians, quantized to 16 steps of 22.5°, and
  turns both the glyph and its hotspot. `Tool.cursor`, `Action.cursor`,
  `Action.activeCursor` and `AffordanceRegion.cursor` widen from `string` to
  `CursorSpec` — either a CSS keyword, which passes through untouched, or
  `{ glyph, size?, angle?, fallback? }`. Every cursor declaration written before
  this keeps working.
  
  Two glyphs ship with it. The selection's rotation ring now shows a real `rotate`
  cursor instead of a bare `grab`, and the resize corners show a `resize` arrow
  turned to the corner's actual axis — a rotated selection used to keep the
  unrotated diagonal, because CSS has four diagonal keywords and a rotation needs
  sixteen. The keyword remains as each spec's `fallback`.
- 36b6ee7: Add `@weasel-js/cursor` and give three tools real cursors.
  
  A cursor glyph is SVG path `d` strings tagged with a paint role plus a hotspot
  in glyph units — the one geometry form both a data-URI baker and a `Path2D`
  painter consume without translating. `bakeCursor` renders one to a
  `url(data:image/svg+xml,…)` string with the hotspot scaled to integer CSS px,
  and `cursorFor` memoizes that per name and size. The pencil, pen and eyedropper
  tools now show their own glyph instead of a shared `crosshair`.
  
  Cursors ship as SVG with no bitmap fallback: Chrome rasterizes an SVG data-URI
  cursor at device scale, so it is already crisp on a retina display. `bakeCursor`
  throws above 128 CSS px rather than emitting a cursor the browser would drop
  silently — that size is where a later painted tier will take over.
  
  Glyph geometry is authored in `scripts/glyphs/` and generated to resolved
  literals by `npm run gen:cursors`; `npm run proof:cursors` renders the baked
  assets over three backgrounds for inspection.
  
  New API: `bakeCursor`, `cursorFor`, `GLYPHS`, `haloFitsInBox`, `CursorGlyph`,
  `CursorPath`, `CursorGlyphName`, `BakeOptions`, and the register constants
  `CURSOR_INK`, `CURSOR_HALO`, `CURSOR_HALO_WIDTH`, `CURSOR_MAX_CSS_PX`.
