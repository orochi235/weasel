# Gestures showcase demo — design

## Goal

A demo that showcases every gesture *form* in `src/interactions/gestures` and
makes the differences between them — particularly the drag variants — visually
obvious. The drags are the easy-to-confuse part; the demo should let you feel and
see how each one behaves and reports data.

## Decisions

- **Public-API surface.** Three drag hooks were not exported from
  `@weasel-js/core`: `useDragRadial`, `useHandleDrag`, `startThresholdDrag`.
  Showcasing "every gesture" requires them, so they are added to the public
  barrel (`src/index.ts`) as a deliberate public-surface decision — demos are
  consumers and must import from `@weasel-js/core`, never from `src/...`.
- **Layout.** One combined demo card with a single shared surface (not a grid of
  mini-canvases, not sibling demos).
- **Picker.** A segmented control (radiogroup) above the surface selects the
  active gesture; the surface binds to that one gesture and draws its overlay +
  a shared readout line below.
- **Scope.** Seven modes: `drag`, `drag-rect`, `radial`, `threshold`,
  `click vs drag`, `local-space` (handle), `drag + drop`. Non-drag grammar kinds
  (wheel, key, key-held, multitouch, pinch) live in the `@weasel-js/gestures`
  matcher layer, not these hooks, and are out of scope; `click` is included
  because it pairs naturally with drag (the click-vs-drag threshold).

## Surface & rendering

- A real `<canvas>` (520×360) is the drawing surface for the five
  coordinate-on-canvas modes (drag, rect, radial, threshold, click). Overlays are
  drawn imperatively in a `draw()` that reads per-mode overlay state from refs
  (decoupled from the controller instances, which change identity each render).
  Using a `<canvas>` keeps the visual-regression harness (`captureCanvas`, which
  screenshots the first `<canvas>`) working unchanged.
- The two DOM-attached modes render HTML elements over the surface:
  - `local-space` overlays a transparent hit-target div on the drawn rect;
    `useHandleDrag` reports coords local to *that* element, drawn as a crosshair.
  - `drag + drop` renders a draggable chip (`useDragHandle`) and two drop zones
    (`useDropZone`); only the zone whose `accepts()` matches the payload `kind`
    highlights.

## Per-mode overlay + readout

| Mode | Hook | Overlay | Readout |
|---|---|---|---|
| drag | `useDragGesture` | pointer-trace polyline + start/current dots | phase · world · client · Δ |
| drag-rect | `useDragRect` | filled dashed marquee | bounds x/y/w/h |
| radial | `useDragRadial` | ray from center + angle arc | angle° · radius · center |
| threshold | `startThresholdDrag` | dead-zone ring (color flips on engage); line appears only once engaged | threshold px · engaged? · moved px |
| click vs drag | `useDragGesture` + `thresholdReached` | dead-zone ring + line; result label | phase · moved px → result CLICK/DRAG (`wasSubThreshold`) |
| local-space | `useHandleDrag` | drawn rect + local crosshair | local (x, y) inside the rect |
| drag + drop | `useDragHandle` + `useDropZone` | chip + two zones; matching zone highlights | dropped kind/ids → zone |

A footer shows live modifier state (shift/alt/meta/ctrl), updated on both pointer
and key events.

## Registration & tests

- `demo/demos/GesturesDemo.tsx`, registered in `demo/registry.ts` (component
  import, `?raw` source import, array entry) under the **Foundations** category.
- Styles added to `demo/canvas-kit-demo.css` under a "Gestures demo" section,
  reusing existing `--ckd-*` tokens and the `.ckd-canvas` class; no inline styles
  except the `touchAction:'none'` style the `useDragHandle` hook returns.
- `tests/visual/gestures.spec.ts` mirrors `scene.spec.ts` (initial-mount canvas
  capture). The baseline PNG must be captured in CI on ubuntu-22.04 via the
  `visual-update.yml` workflow — local macOS capture is unsupported and would
  fail CI.

## Out of scope

- Non-drag grammar gestures (wheel/key/multitouch/pinch).
- `usePointerGestures` as its own mode (it is the umbrella that composes the
  action controllers, not a distinct input form to visualize).
