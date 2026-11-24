# Audit round 80 — loupe

## `pick()` at the aim samples under a stationary lens, which `pick(p)` refuses
- where: packages/loupe/src/model.ts:236 (createLoupeModel → pick)
- scenario: a stationary lens (one whose `covers` answers true over its frame) with a pinned aim; the surface's camera pans so `pointFor(pin)` now stands under the lens frame (or `holdPin(c)` puts it there). `pick()` with no `p` samples `aim.now()` without asking `surface.covers`, and reports the lens's own chrome to `onPick`. `pick(p)` refuses exactly that case ("sampling there reports the lens' own chrome as artwork") and `aimAt`/`pinAt` refuse covered points, so one question gets two answers. `sampleColor` after `holdPin` has the same gap, and `color` becomes the chrome's.
- evidence: read
- severity: medium

## `holdPin` skips the hidden and covers checks every other aim entry point applies
- where: packages/loupe/src/model.ts:226 (createLoupeModel → holdPin)
- scenario: while `surface.hidden()` is true, `holdPin(c)` pins, samples the aim at once (or flags it for the next frame) and calls `surface.changed()`. `aimAt`, `pinAt` and `resample` are ignored while hidden, and the frame callback that later samples a flagged aim does not check `hidden` either, so a hidden lens reports `onColorChange` for a point nobody can see. Restoring a pin with `holdPin` onto a point under the lens likewise samples the lens itself, which `pinAt` refuses.
- evidence: read
- severity: low

## `aimAt` while pinned returns before noticing the surface is gone
- where: packages/loupe/src/model.ts:211 (createLoupeModel → aimAt)
- scenario: a pinned model whose surface reports `gone()`; the host keeps feeding pointer moves through `loupe.aim`. `aim.mode === 'pinned'` short-circuits before `refuses(p)`, so `dead()` never runs and `onDispose` never fires, although `LoupeSurface.gone` promises the model tears itself down "the next time it is called". The painter keeps what it holds until some other entry point is called or a frame lands.
- evidence: read
- severity: low

## Eyedropper hover leaves the last point's color when the sampler throws synchronously
- where: packages/loupe/src/eyedropper.ts:67 (createEyedropperModel → hover)
- scenario: a sampler whose `sample` throws at once (for example a `canvasPixelSource` whose probe `drawImage` throws something other than a `SecurityError`). `hovers.take()` has already invalidated the earlier hover, the throw escapes, and `color` stays the previous point's with no `onColorChange(null)`. The same failure answered through a rejected promise settles `null` ("the last point's color is not this one's"), so a failed read is handled two ways depending on whether the sampler was async.
- evidence: read
- severity: low

## The aim holds the caller's point object by reference
- where: packages/loupe/src/aim.ts:41 (createLoupeAim → follow, hold)
- scenario: a host that reuses one scratch `{x, y}` for every pointer move (an allocation-free pointermove handler) passes it to `model.aimAt(p)`. `follow` stores `p` itself and `model.aim` returns that same object, so the next mutation of the scratch point moves the aim without `aimAt` running — the aim no longer matches `color`, the frame-sampling flag is never set, and a hover the model refused (covered or hidden) still moves the aim. `hold(c)`/`pin` share the same object the same way.
- evidence: read
- severity: low

## Files read
packages/loupe/src/actionParamSchema.ts
packages/loupe/src/actions.ts
packages/loupe/src/aim.ts
packages/loupe/src/canvasSource.ts
packages/loupe/src/eyedropper.ts
packages/loupe/src/geometry.ts
packages/loupe/src/index.ts
packages/loupe/src/model.ts
packages/loupe/src/pbt.fixture.ts
packages/loupe/src/sampler.ts
packages/loupe/src/zoomStops.ts

<!-- done: 5 findings, files read: 11 -->
