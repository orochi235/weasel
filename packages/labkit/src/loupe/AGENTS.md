# Loupe — Agent Guide

`src/loupe/` is the `loupe` instrument capability: a magnifier a trial can turn
on, painted by whichever painter suits the instrument's content.

The magnifier itself is not here. `@weasel-js/loupe` holds the model — aim,
factor, mode, color, picking — over a `LoupeSurface` it asks five questions.
This directory binds that model to a labkit trial and draws it.

## Files

| File | Role |
|---|---|
| `types.ts` | `LoupeCapability`, and `resolveLoupe` filling in every default |
| `useLoupe.ts` | The model over a host element, and pointer aiming |
| `loupeActions.ts` | `loupe.peek` and `loupe.magnify`, as `Action` descriptors |
| `LoupeGestures.tsx` | Registers those and mounts the dispatcher on the host |
| `TrialLoupe.tsx` | Picks the painter and mounts the lens |
| `LoupeBubble.tsx` | The circular clip, positioned on the aim |
| `CanvasLoupe.tsx` | Painter for a `<CanvasStack>` |
| `canvasLens.ts` | That painter's geometry and drawing, with no React in it |
| `DomLoupe.tsx` | Painter for DOM content |
| `useHostSize.ts` | The host's measured box, for the DOM stage |

## Which painter

`LoupeCapability.render` decides. Absent, the lens re-runs the instrument's own
canvas layers through `lensCamera` — sharp at any factor, and `mode: 'pixel'`
enlarges the presented pixels with smoothing off instead. Present, the
instrument is handed a camera and draws itself again; a DOM loupe is always
`vector`, since DOM has no framebuffer to enlarge.

The canvas painter needs the stack's own pixels and layers, which is why
`TrialLoupe` mounts *inside* `<CanvasStack>` for a drawing instrument and reads
`CanvasStackContext`'s `surface`. A DOM instrument gets a
`.lk-trial__loupe-host` wrapper from `Trial` and the lens tracks that.

## Traps

**jsdom cannot see magnification.** Everything assertable there is state — aim
moved, factor clamped, mode switched, the lens raised and put away. That the
lens shows the right region is a screenshot.

**Do not dispose the model when React unmounts.** `dispose` is one-way, and
StrictMode mounts / unmounts / mounts every effect — so disposing in the
cleanup leaves a magnifier that draws but silently ignores every aim. It owns
no resources; unmounting only reports the lens gone.

**The wheel is taken from pan/zoom by declining it, not by capturing it.**
`loupe.magnify`'s `enabled` returns a disabled reason while the lens is down, so
the dispatcher leaves the event unhandled and `usePanZoom` — a React handler on
the same element — sees it as usual. While the lens is up the action fires, the
dispatcher stops propagation, and React's root listener never runs.

**Aiming is a plain listener because a hover is not a gesture.**
`GESTURE_DESCRIPTORS` names no continuous-motion gesture, so `pointermove` /
`pointerleave` stay hand-attached in `useLoupe`. Everything else routes.

**`<LoupeGestures>` mounts outside the visibility gate.** Hold-to-peek is what
raises a lens that is down; gate its registration on `loupe.visible` and the
peek key stops working entirely.
