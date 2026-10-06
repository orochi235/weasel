# Loupe — Agent Guide

`src/loupe/` is `@weasel-js/labkit/loupe`: `<TrialLoupe>`, a magnifier the
instrument mounts in its own content, painted by whichever painter suits it.
Its own bundle entry; nothing in the main bundle imports it, so a lab that
mounts no lens never loads it.

The magnifier itself is not here. `@weasel-js/loupe` holds the model — aim,
factor, mode, color, picking — over a `LoupeSurface` it asks five questions.
This directory binds that model to a labkit trial and draws it.

## Files

| File | Role |
|---|---|
| `types.ts` | `LoupeOptions`, and `resolveLoupe` filling in every default |
| `useLoupe.ts` | The model over a host element, and pointer aiming |
| `loupeActions.ts` | `loupe.peek` and `loupe.magnify`, as `Action` descriptors |
| `LoupeGestures.tsx` | Registers those, and mounts a dispatcher on the host when no camera has one there |
| `TrialLoupe.tsx` | Finds its host and the trial's switch, picks the painter, mounts the lens |
| `LoupeBubble.tsx` | The circular clip, positioned on the aim |
| `CanvasLoupe.tsx` | Painter for a `<CanvasStack>` |
| `canvasLens.ts` | That painter's geometry and drawing, with no React in it |
| `DomLoupe.tsx` | Painter for DOM content |
| `SourceLoupe.tsx` | Painter for any canvas named by `source` |
| `sourceLens.ts` | That painter's source resolution, box measurement and drawing |
| `useHostSize.ts` | The host's measured box, for the DOM stage |

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

## Traps

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
`.lk-loupe-host` — `<LoupeGestures>` mounts a dispatcher of its own.

**Aiming is a plain listener because a hover is not a gesture.**
`GESTURE_DESCRIPTORS` names no continuous-motion gesture, so `pointermove` /
`pointerleave` stay hand-attached in `useLoupe`. Everything else routes.

**`<LoupeGestures>` mounts outside the visibility gate.** Hold-to-peek is what
raises a lens that is down; gate its registration on `loupe.visible` and the
peek key stops working entirely.
