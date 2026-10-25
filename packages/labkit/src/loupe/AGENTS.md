# Loupe — Agent Guide

`src/loupe/` is `@weasel-js/labkit/loupe`: `<TrialLoupe>`, a magnifier the
instrument mounts in its own content, painted by whichever painter suits it,
and `<LensOverlay>`, lenses a host parks over a whole lab ("Lenses" below).
Its own bundle entry; nothing in the main bundle imports it, so a lab that
mounts no lens never loads it.

The magnifier itself is not here. `@weasel-js/loupe` holds the model — aim,
factor, mode, color, picking — over a `LoupeSurface` it asks five questions.
This directory binds that model to a labkit trial and draws it.

## Files

| File | Role |
|---|---|
| `types.ts` | `LoupeOptions`, and `resolveLoupe` filling in every default |
| `useLoupe.ts` | The model over a host element, and the input its actions drive |
| `loupeActions.ts` | `loupe.aim`, `loupe.leave`, `loupe.peek` and `loupe.magnify`, as `Action` descriptors |
| `LoupeGestures.tsx` | Registers those, and mounts a dispatcher on the host when no camera has one there |
| `TrialLoupe.tsx` | Finds its host and the trial's switch, picks the painter, mounts the lens |
| `LoupeBubble.tsx` | The circle or square clip, positioned on the lens's center |
| `CanvasLoupe.tsx` | Painter for a `<CanvasStack>` |
| `canvasLens.ts` | That painter's geometry and drawing, with no React in it |
| `DomLoupe.tsx` | Painter for DOM content |
| `SourceLoupe.tsx` | Painter for any canvas named by `source` |
| `sourceLens.ts` | That painter's source resolution, box measurement and drawing |
| `useHostSize.ts` | The host's measured box, for the DOM stage |
| `lens/` | Lenses as scene objects, their sources, actions and rim zoom ("Lenses" below) |

## Lenses

`lens/` is a second kind of loupe: lenses as objects a host parks, moves and
aims, many at once (at most `MAX_LENSES`, 8). The host owns the `LensScene`
(`createLensScene`), so it decides whether lenses outlive the overlay, and
passes a `LensAttachment` saying what they are attached to;
`VIEWPORT_ATTACHMENT` keeps them still in lab-body px.

A lens is three nodes on the scene's `lenses` layer: the **body** (the bubble,
whose data carries the lens's `LensSettings`), the **reticle** (the spot it
shows) and the **leader**, a line whose path derives from the other two and
which is drawn and never picked. Moving, resizing, selecting and undoing are
core's `pick`/`move`/`transform`/`edit` features on `<LensOverlay>`'s own
`SceneCanvas`, with an undo history of its own that answers only while its input
element has focus.

The reticle's pose is the patch the body shows: the body's box divided by the
factor (`patchAt`), drawn in the body's shape. So it is never resized directly
and takes no handles. A new factor resizes it in `setLensOps`, and a resized
body resizes it in the same undo entry through `reticleFollower`, a core
transform follower. A body takes handles at its corners only, and a corner
drag can make a round body an ellipse, so its view is clipped to an ellipse
inside the rim (`--lk-lens-rim-in`, half of `RIM_PX`).

The reticle's aim is `pinned`, `follow` or `glass`. Glass is the reticle's pose
derived from the body (`GLASS_POSE_KEY`), so `setAimOps` switches to it by
setting the reticle's `dependsOn` and leaves it with a transform to where the
derived pose put it. The ops are built and tested; no action aims a lens at
Glass yet.

`<LensOverlay>` paints into the surface's `top` buffer (`useSurfaceCanvas('top')`,
`src/surface/AGENTS.md`), a layer no other tenant shares, so a lens redraw never
clears annotation marks. The layer and its input element take no pointer input;
each body, reticle and split seam has a `.lk-lens-hit` box that does, so a press
that misses every lens falls through to the trials. Every hit test under the
layer goes through `probeUnderLens(el, kind, fn)`, which marks the layer for one
synchronous call: `'beneath'` stands the hit boxes down, so a point lands on
what lies under the lenses, and `'interior'` stands each lens interior up, so a
point lands on what a source attached there. A wheel over a hit box is handed on
by `useWheelPassThrough`, which finds what is beneath that way and dispatches a
copy of the wheel on it. A browser scrolls nothing for an untrusted copy, so when
nothing cancels it the hook scrolls the nearest scroller that can move
(`scrollByWheel`); a host's readouts find their element in a lens's copy
with `'interior'`. `renderReadouts` is handed `LensReadoutProps`, the slot props
plus the lens's interior element, so a host never queries the overlay's DOM.

Each body carries its zoom (`lens/LensZoom.tsx`), a `Slider` across the bottom of the rim through 6 o'clock,
with a stop at every factor the zoom keys step through (`FACTOR_STOPS`). Its track follows the body: an arc on a
round body, `ellipseShape` from `@weasel-js/geom` on a stretched one, a straight slider on a square
(`zoomTrackOf`). It writes through `setLensOps` as the keys do, inside a `scene.batch` keyed per drag, so a drag is
one undo entry. It sits in the interior, above the hit boxes as the chrome does, and only its band and thumb take
presses.

The canvas overrides `delete`: deleting any node of a lens deletes all three
(`lensClosure`). Core's delete cascades only down from a deleted body, so a
lone selected reticle would otherwise be deleted and strand its body.

What a lens shows is a `LensSource` (`lens/lensSource.ts`), one per kind —
`live`, `pixels`, and the reserved `revision` and `reference`. A source says
whether it `produces` DOM or pixels; `attach` gives it the lens interior to
render into and a handle that takes each new `LensSourceRequest` (reticle in
client px, factor, interior size, the comparison or null, DPR); `status()` is
`true` or the bare reason it cannot answer, which the slot prefixes as
"Pixels unavailable: …". A pixels source also answers `capture()`, which
Difference (always two Pixels captures, whatever the lens's source) and the
pixel grid read. A lens whose source is unavailable falls back to the first
one that is (`resolveSource`) and says why on its chrome.

The lens actions (`lens/lensActionDefs.ts`) live in one keymap,
`createLoupeKeymap`, opened by the leader `LOUPE_LEADER`, Alt+L matched by
`code: 'KeyL'` because Alt changes the produced character on macOS. Inside it
the keys are plain (`LENS_KEYS`), each binding's `opts.id` is its action id so
`bindingOverrides` can rebind it, and Escape closes it (`docs/taxonomy.md`,
"Keymap and leader"). The host supplies a `LensActionApi` and mounts
`<LensActions>`; `loupe.seam` alone registers on the lens canvas, since a drag
on the seam reaches that dispatcher and not the lab's.

## How it reads the trial

Only through context, the way `<TrialOverview>` does. `CanvasStackContext`'s
`surface` gives the canvas painter the stack's layers, pixels and `worldSpec`;
`CameraContext` gives a lens in a `<Stage>` its element and camera. Outside
both, it tracks `hostRef`, or failing that wraps its `children` in a
`.lk-loupe-host` box of its own.

The toolbar toggle is `LoupeSwitchContext` (`src/trial/loupeSwitch.ts`, main
bundle). A lens with no `enabled` prop calls `mount` and follows `on`; the
trial offers its Loupe toggle while any lens is mounted. `enabled` opts a lens
out of the switch entirely. Because the lens mounts after the trial's first
render, `loupe` is in `TRANSIENT_BUILTINS`, so suppressing it before then is
not a typo.

## Which painter

`render` decides. Absent, the lens re-runs the stack's canvas layers through
`lensCamera` — sharp at any factor, and `mode: 'pixel'` enlarges the presented
pixels with smoothing off instead. Present, it is handed a camera and draws the
content again; a DOM loupe is always `vector`, since DOM has no framebuffer to
enlarge. The canvas painter needs the stack's own pixels, which is why a
drawing instrument mounts the lens in its `render`, inside `<CanvasStack>`.

`source` names a canvas labkit need not own, and wins over the stack: the lens
enlarges that canvas's pixels (`SourceLoupe`), or, beside `render`, only
samples its color. The capture rule for WebGL lives with `createCanvasSource`
in `@weasel-js/loupe`.

## Where the lens goes

By default a lens is a `diameter` box centered on the aim. `place` lets the
host put it elsewhere per aim — a box of any size at `center`, showing what is
around `shows` at its own `factor` — and `placeBand` (from `@weasel-js/loupe`)
is the stock fit of a region shown whole. `useLoupe` resolves the result into
`loupe.lens`; the bubble is drawn at `lens.center` and the painters are aimed at
`lens.shows`, which are different points once a lens is moved to stay on the
host. `onColorChange` still reports the aim.

`hollow` runs no painter and leaves the bubble's inside clear, for a host that
draws the magnified view itself; `onLens` tells it the box, on each change in
value and with `null` once a lens that was up goes away.

## Traps

**A placed lens must reach the model, not only the painters.** `pick` maps a
point inside the lens back to the page through `LoupeSurface.lens()`; the rect
it returns carries `shows` and `factor`, and a lens drawn somewhere the model
does not know about picks colors from the wrong place with every test of the
drawing still green.

**jsdom cannot see magnification.** Everything assertable there is state — aim
moved, factor clamped, mode switched, the lens raised and put away. That the
lens shows the right region is a screenshot, or a pixel read in a browser test
(`SourceLoupe.browser.test.tsx`).

**Retain a source by its resolved identity, not the prop.** An inline
`source={() => ref.current}` is a new function every render, and every aim
re-renders. Keyed on the prop, the lens released and re-took the source on each
aim, and each first reader marks a captured frame stale.

**Do not dispose the model when React unmounts.** `dispose` is one-way, and
StrictMode mounts / unmounts / mounts every effect — so disposing in the
cleanup leaves a magnifier that draws but silently ignores every aim. It owns
no resources; unmounting only reports the lens gone.

**The wheel is taken from the camera by rank, and handed back by declining.**
In a trial the loupe's actions join the camera's dispatcher (`CameraInput`).
`loupe.magnify` sits in the hotkey tier, so while the lens is up it outranks
the camera's wheel zoom; while it is down its `enabled` returns a disabled
reason and the dispatcher falls through to the zoom. Outside a camera — the DOM
`.lk-loupe-host` — `<LoupeGestures>` mounts a dispatcher of its own, in an
input scope of its own so two loupes never stack `loupe.peek` on one id.

**The peek key goes to the loupe under the pointer.** Its binding carries
`over: true`, so it is live on whichever host the pointer is over when the key
goes down, not on the canvas last pressed in. A key held before the pointer
enters raises nothing.

**The aim is a hover that a held button does not stand down.** `loupe.aim`
binds `{ kind: 'hover', held: 'optional' }`, so the lens follows a drag as it
follows a plain move, and `loupe.leave` binds `hover(leave)`. The loupe's own
dispatcher turns on the `hover` channel and leaves `pointer` off, so it never
opens a gesture on a press or captures the pointer away from the content.

**The model ignores aims while the lens is down.** So a lens that comes up
under a still pointer — the peek key, or the lens turned on — has had no aim
since the last time it was up. `useLoupe` keeps the pointer's last spot over the
host and aims there as the lens rises; without it the lens opens at 0,0.

**`<LoupeGestures>` mounts outside the visibility gate.** Hold-to-peek is what
raises a lens that is down; gate its registration on `loupe.visible` and the
peek key stops working entirely.
