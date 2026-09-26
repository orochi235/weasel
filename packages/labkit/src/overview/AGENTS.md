# Overview — Agent Guide

`src/overview/` is `@weasel-js/labkit/overview`: `<TrialOverview>`, a trial's
whole content in a floating panel. Its own bundle entry; nothing in the main
bundle imports it.

| File | Role |
|---|---|
| `TrialOverview.tsx` | The panel: content, chrome canvas, and its own dispatcher |
| `OverviewMarks.tsx` | Every annotation target's marks, read-only, as SVG |

## How it reads the trial

Only through `CameraContext`, which `<CanvasStack>` and `<Stage>` set: the
camera as a weasel `ViewApi` over frame-local coordinates, the frame, the
camera's element, a stage's content rect. A canvas instrument's layers come
from `CanvasStackContext`, marks from `AnnotationsContext`. So it works
anywhere inside a camera — `stage.overlay`, or a canvas instrument's `render`.

Input is core's `minimap.center` / `minimap.pan` on a dispatcher of its own,
with the camera as `rootView`; the pointer store is the trial's, shared.

## Traps

**It sits inside the stage's element.** Every event that bubbles out of the box
reaches the stage's dispatcher, the loupe's aim and the stage's pointer
publisher. The box stops them; drop that and a drag in the overview also pans
the stage, and the pointer flips between `'overview'` and `'stage'` each move.

**Marks are placed by measuring.** A target's rect on the overview is its
element's rect against the camera's element, through the camera — never the
target's content size, which is the mark's world and not where it is drawn.
jsdom measures zero; a test mocks `getBoundingClientRect`, and the picture is a
screenshot.

**Never render the instrument's own `render` in it.** Its effects — a pane
ref, an annotation target — would run twice. `render` is a separate, lighter
copy the instrument supplies.
