# A loupe any lab can turn on

For whoever implements this. You know weasel and labkit; you were not in the
conversation that produced it. It answers: what a built-in labkit loupe is, why
the one in `@weasel-js/hud` cannot be dropped in as it stands, and what to build.

**State:** branch `ui/labkit-loupe`, worktree `.claude/worktrees/loupe`, cut from
`main`. Nothing implemented yet — this document is the whole of it.

## The decision

Split the loupe into a **model** and a **painter**. The model is the loupe;
a painter is how it gets drawn on one kind of surface. `@weasel-js/hud` today
fuses the two.

Alternatives, both declined: wiring hud's loupe as-is (works only for
instruments whose content is a core canvas, which excludes labkit's own layer
stack and every DOM instrument), and routing labkit trial input through the
dispatcher first (the right foundation, but it puts the loupe behind an arc —
see "The input half" below for what to reuse when that lands).

## Why hud's loupe does not drop in

`createLoupe` is a WebGL widget living inside a core canvas. It emits
`DrawCommand[]` from `@weasel-js/core/renderer`
(`packages/hud/src/loupe/createLoupe.ts:5,94`), and `attachHud` registers a
`RenderLayer` against a `CanvasExtensionApi` (`packages/hud/src/attach.ts:2,26`).
Both halves of that are absent in a lab: labkit's only canvas context is 2D
(`packages/labkit/src/canvas/useLayerScheduler.ts:69`), and an instrument is free
to render no canvas at all. brick-icons' panes — the motivating consumer — are
SVG markup, an `<img>`, and a react-three-fiber canvas.

What is *not* divergent is the model. Aim, factor, `'vector' | 'pixel'`, the
freeze-while-the-pointer-is-over-the-window rule, and pick are all statements
about a magnifier, not about GL. Keep hud's vocabulary; it is good and it is
already public (`LoupeOptions`, `LoupeHandle`, `LoupeMode`,
`packages/hud/src/index.ts:23`).

## What to build

**1. The model, surface-free.** Lift the state machine out of `createLoupe`:
aim, factor with clamps, mode, freeze rule, `pick()`, `onColorChange`. It should
name no GL type. Where it lives is a real question — `@weasel-js/hud` keeps the
loupe in one package, a new home avoids labkit depending on hud for a model that
has nothing to do with HUD windows. Decide when you see how much comes out.

**2. Three painters.**

- *GL* — the existing one, unchanged, for instruments whose content is a core
  canvas. It already works; do not rewrite it.
- *2D canvas* — redraw labkit's layer stack at a zoomed view into an offscreen
  canvas. This is `useLayerScheduler` with a different `View`, so it is sharp
  rather than pixel-doubled, and `imageSmoothingEnabled = false` over a
  `drawImage` of the presented canvas is the pixel mode.
- *DOM* — re-render a subtree at a composed camera inside a circular clip.
  brick-icons proved this shape: the bubble is `pointer-events: none` so pan,
  wheel and any overlay underneath keep working, the inner stage is offset by
  `diameter/2 - cursor` so the aimed point lands at the centre, and the lens
  camera is the pane's own camera composed with the factor through the same
  fixed-point zoom the wheel uses. See `lab/src/panes/loupe.ts` in
  `~/src/brick-icons` — 55 lines of pure geometry, worth reading before writing
  this painter.

**3. The capability.** labkit's rule is that declaring a capability is what
provides the chrome (`packages/labkit/src/instrument/types.ts:112`), and
`builtinContributions` derives the toolbar/viewport items from it
(`packages/labkit/src/chrome/builtins.tsx:28-203`). So:

```ts
instrument: { loupe: true }             // canvas content — painter chosen for it
instrument: { loupe: { render } }       // DOM content — re-render at a camera
```

contributing one toolbar item with id `loupe`, dropped by
`suppress={['loupe']}` like any other built-in. The `render` form is what a DOM
instrument hands over: given a camera, draw me again.

**4. A demo** under `apps/site/demos/`, since `LoupeDemo.tsx` covers only the GL
path today.

## The input half

The gesture grammar already has every gesture this needs: `keyHeld` with a free
key arg, `wheel` with a direction arg, `click` with a target
(`packages/gestures/src/grammar/gestures.ts:11-24`). brick-icons hand-rolled all
three — a 19-line `useAltHeld` subscribed from two places, and an Alt+wheel
handler that has to run ahead of pan-zoom by hand — because labkit trials do not
route input through the dispatcher.

Do not fix that here. Give the loupe hold-to-peek and wheel-to-zoom with plain
listeners for now, keep them in one place, and leave a pointer to this section
so that when trial input does go through the dispatcher they become the
bindings they should have been.

## Traps

**jsdom cannot see magnification.** Every assertion available there is about
state — aim moved, factor clamped, mode switched, the freeze rule held. That the
lens shows the right region is a screenshot, not a test.

**A canvas the loupe re-draws must not read back an empty framebuffer.** The GL
path already documents this (`apps/site/demos/LoupeDemo.tsx:10-13`): a
transparent framebuffer reads back transparent, which is why that demo sets both
a canvas `backgroundFill` and a loupe background.

**Do not re-derive the camera.** brick-icons wrote its own `zoomAt` and its own
`readView` because labkit exports neither `usePanZoom` nor a two-way transform
(`as2DView` exists; the inverse does not). If the DOM painter needs camera
composition, export it rather than writing a third copy.
