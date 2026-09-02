# Loupe — Agent Guide

`src/loupe/` is the `loupe` instrument capability: a magnifier a trial can turn
on, painted by whichever painter suits the instrument's content.

The magnifier itself is not here. `@weasel-js/loupe` holds the model — aim,
factor, mode, colour, picking — over a `LoupeSurface` it asks five questions.
This directory binds that model to a labkit trial and draws it.

## Files

| File | Role |
|---|---|
| `types.ts` | `LoupeCapability`, and `resolveLoupe` filling in every default |
| `useLoupe.ts` | The model over a host element, plus all of the input |
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

**The wheel has to be taken from pan/zoom by hand.** `usePanZoom` is a React
handler on the same element, so the lens listens in the capture phase and stops
propagation. See the loupe entry in `docs/TODO.md` for what replaces this.
