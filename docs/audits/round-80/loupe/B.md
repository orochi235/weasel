# Audit round 80, area `loupe`: findings

## The eyedropper samples a stationary lens's own pixels as artwork, which the loupe model refuses to do
- where: packages/loupe/src/eyedropper.ts:72 (hover), packages/loupe/src/eyedropper.ts:87 (pick)
- scenario: an eyedropper is given a `loupe` whose surface has a stationary lens (`covers(p)` true over its frame), and
  a sampler reading the presented canvas. The pointer moves over the lens: `opts.loupe.aimAt(p)` is refused (the
  model ignores aims the lens covers), but `hover` still calls `opts.sample(p)` and reports the lens's chrome or
  magnified pixels as `color`; a click there (`pick(p)`) sends that color to `onPick`. The loupe model's `pick`
  answers the same question the other way: a point that maps back under the lens returns `null`
  ("sampling there reports the lens' own chrome as artwork", model.ts:236). So the doc's promise that the loupe's
  readout is "the color that click takes" breaks exactly over the lens: the readout keeps the last aim's color while
  the eyedropper reports a different one. Expected: the eyedropper either maps the point through the lens or refuses
  it, the way `LoupeModel.pick` does.
- evidence: read
- severity: medium

## `LoupeModel.pick()` with no point, and aim sampling, never check whether the lens covers the aim
- where: packages/loupe/src/model.ts:227 (pick), packages/loupe/src/model.ts:155 (sampleColor via aimed/holdPin)
- scenario: a pinned aim on a surface with `worldAt`/`pointFor`; the camera pans so the pin now stands under a
  stationary lens (or `holdPin(c)` puts it there; `holdPin` skips the `covers` check `pinAt` makes). `pick()` with
  no argument samples `aim.now()` directly and reports the lens's own chrome to `onPick`; `holdPin`'s `aimed()` reports
  it through `onColorChange`. `pick(p)` refuses the same situation (`if (surface.covers(at)) return null`), so one
  decision is answered two ways depending on whether a point was passed. Expected: the aim-point pick refuses a
  covered point too.
- evidence: read
- severity: low

## `aimAt` on a pinned model returns before following a gone surface down
- where: packages/loupe/src/model.ts:203 (aimAt)
- scenario: a pinned loupe keeps receiving `loupe.aim` hovers; its owner takes the lens away (`surface.gone()` true).
  `aimAt` returns on `aim.mode === 'pinned'` before `refuses(p)` runs `dead()`, so the model never tears down and
  `onDispose` never fires from the hover stream, though the comment at model.ts:176 says every entry point follows a
  gone lens down. With no `subscribeFrame` and no other call, the painter's held resources stay until something else
  calls the model. Expected: check `disposed || dead()` before the pinned early return.
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

<!-- done: 3 findings, files read: 11 -->
