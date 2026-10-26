# Lenses as views: aims and markers in core, `@weasel-js/lens` on top

**Status: Arc 1 built 2026-10-21 (core aims, held side, markers; kernel3d aims): see
`packages/core/src/domains/viewports/README.md`. Arcs 2–3 unbuilt.** Delete this doc once they land,
keeping anything durable in the packages' own READMEs.

**For** whoever plans and builds arcs 2–3. **Answers:** what a lens is in weasel; what moves out of
labkit and forge into a new `@weasel-js/lens` package; and how the loupe, a parked lens, a
picture-in-picture view and the minimap are rebuilt on core's aims and markers.

## Why

weasel has four things that each show part of something, somewhere else:

| Today | Where | What it is built from |
|---|---|---|
| The hud loupe (`createLoupe`) | `packages/hud/src/loupe` | `SceneCanvasApi.addView` plus a viewport layer, camera derived from the pointer |
| Parked lenses (forge's workshop) | `packages/labkit/src/loupe/lens`, `packages/forge/src/shell/loupe` | a scene of body, reticle and leader nodes painted into labkit's surface `top` buffer, showing DOM through sources |
| Picture-in-picture | core's `<CanvasView>` | a viewport node with its own camera, optionally nested (`parent`) with a derived camera |
| The minimap | `packages/minimap` | a view through a fit camera, an indicator layer, and `minimapPanAction` |

Each answers the same questions — what it looks at, where it shows it, and how the two are linked on
screen — in its own way, so nothing one learns (multiple instances, undo, split/compare, a draggable
indicator) reaches the others. The goal is one model they all stand on, and the parked lens as a tool
any weasel app can use, not only forge.

## Terms

| Term | Meaning |
|---|---|
| **camera** | A transform from world to screen and nothing else. 2D: `View`. 3D: kernel3d's `Camera3d`. |
| **frame** | The rect a viewport paints into, in its host's screen px. |
| **viewport** | A camera plus a frame. The root canvas view, a `<CanvasView>`, a viewport layer. |
| **aim** | What a viewport shows, read in its world: the same information as the camera, given the frame. In 2D, the world rect `viewportWorldRect(view, frameSize)` returns. |
| **held side** | Whether a viewport holds its camera (and derives its aim) or holds its aim (and derives its camera). Panning a PiP and moving a lens's reticle are the same edit seen from the two sides. |
| **marker** | View A's aim drawn inside view B's frame. A lens's reticle is the lens's aim drawn in its host; a minimap's indicator is the root view's aim drawn in the minimap. |
| **lens** | A tool: a viewport whose frame and aim are objects a user places, moves, resizes and undoes, with markers back to where it aims. |

## Decisions (2026-10-21)

- Lenses are their own package, `@weasel-js/lens`, beside `@weasel-js/loupe` rather than inside it.
  A loupe is one kind of lens; `@weasel-js/loupe` stays the React-free, core-free magnifier model it
  is today.
- Aims, held side and markers are part of core's viewport model, so the root view and `<CanvasView>`
  take part. The default viewport is not a lens *instance* — it is not a placed object — but it has an
  aim and can be either end of a marker.
- Designed against all four uses from the start: hud loupe, parked lens, PiP, minimap.
- Forge keeps what is about stories: the Live and Pixels sources, comparisons over globals and args
  (`conditions.ts`), the compare menu's choices, the capture server.
- Over a canvas, a parked lens's body stays put on screen while the document zooms and pans, and keeps
  showing the same patch of the document. Its factor is relative to what the user sees: a 4× lens
  shows its patch 4× larger than the page around the reticle shows it, at any host zoom.
- Lenses are not part of the document. They are a viewing tool, like the camera: not saved with the
  file, and undone in a history of their own that answers while a lens has focus, as in forge today.
  Keeping some lens state with a document may come later; nothing here should make it harder.
- A Loupes manager asset, and assets that can be a toolbar or a panel, are a later, separate design
  (arc 4), built on the lens API this one produces.

## Goals

- The parked lens usable in a plain `<SceneCanvas>` app (draw, chart) and in labkit, with a canvas
  source that paints through a viewport.
- Minimap, PiP and the hud loupe rebuilt as assemblies of the model, losing nothing they do today.

## Non-goals

- The Loupes asset, toolbar/panel/menu switching, and moving draw's loupe UI onto lenses (arc 4).
- New lens features from the forge loupe spec's unbuilt half (Glass action, more readouts, Revision
  and Reference sources).
- labkit's `TrialLoupe` and its painters: they stay in labkit. They may adopt the model's types; they
  are not rebuilt here.

## Anti-goals

- A second way to say what a view looks at. A view's aim is derived from its camera or its camera from
  its aim — never both stored. The same goes for a lens: its reticle node's pose *is* its aim, and the
  viewport reads it; nothing copies it.
- A 2D-only core type. Core's aim contract may not require `{x, y, width, height}`; a 3D host must be
  able to give its views aims and draw markers between them.
- Consumer-facing `@internal` imports to wire any assembly together. If an assembly needs a hook, it is
  public surface designed as such.
- Forge vocabulary in `@weasel-js/lens`: no story, trial, globals or capture-server concepts.

## Arc 2 — `@weasel-js/lens`

**Depends on** core, react, react-dom, geom, routing. Nothing imports labkit or forge.

**Moves in from labkit** (`packages/labkit/src/loupe/lens/*`), all of which already depend only on
core, routing, geom, react and `@weasel-js/loupe` types:

- the lens scene and its ops (`lensScene`, `lensTypes`), shapes, hit boxes, `reticleFollower`;
- compare (seam, split, swap), Difference, the pixel grid, `probeUnderLens`;
- the source/slot contract (`lensSource`, `LensSlot`, `LensChrome`, `GridCanvas`);
- the actions and keymap (`lensActionDefs`, `LOUPE_LEADER`), `useWheelPassThrough`;
- `LensOverlay` and `LensActions`, after the two changes below;
- `LoupeShape`, inlined; `LoupePoint`/`LoupeRect` replaced by geom's point and rect types.

**Moves in from forge:** `tokenChain.ts` with the DOM helpers it uses from `frame/cssVarUse`, and the
generic half of `readouts.tsx` (`contrastAt`, `ContrastReadout`, the message constants), made generic
over the comparison type. Forge's `trialAt`, `copyIn` and `revealVar` stay in forge and reach the
readouts through the source: a DOM source answers *where to read* for a request (an element and a
client point, or why not), which is what forge's `liveAim` computes today.

**The two couplings to cut.**

- `LensOverlay` paints into labkit's surface `top` buffer and portals into its container. It takes a
  host **lens layer** instead: a container element, a canvas to paint into, and a per-frame size and
  paint callback (exactly what `useLensTile` uses today). labkit provides one over its surface;
  `@weasel-js/lens` provides one for a `<SceneCanvas>`. This also closes the filed P2 that a nested Lab
  with no `top` buffer paints no lenses, since such a Lab can be handed another layer.
- `LensActions` installs its keymap through labkit's `useLabAmbient`. It takes the contribution sink
  as a prop or context instead, and labkit passes its ambient one.

**Open where forge hard-coded.** `LensSourceKind` (`'live' | 'pixels' | 'revision' | 'reference'`)
and `LensReadout` become keys a host registers, with the lens package naming none of forge's. The
"opposite" comparison stays injected (`opposite: () => C`), as now.

**A canvas source.** A lens over a `<SceneCanvas>` paints through a viewport: its frame is an aim-held
`<CanvasView aim>` whose aim is the reticle node's pose. The body still carries settings and the chrome
strip; its pose is the frame.

**Two spaces in one lens scene.** Because the body is screen-fixed and the reticle document-fixed over
a canvas, the lens scene holds nodes in two spaces: bodies in the host's screen px, reticles in the
aimed view's world. Each node's space is part of the lens scene's model, so drawing, hit boxes, the
leader path, `patchAt` (whose factor now also divides out the host's zoom) and `reticleFollower` each
convert through the attachment rather than assuming one camera. labkit's DOM lenses are the case where
both spaces are the lab body's px.

**The reticle stays a lens-scene node** (designer's call, 2026-10-21). The lens scene already draws,
picks, selects and undoes it, and forge's DOM lenses aim at no core viewport, so a core marker could
not be their reticle. A parked lens therefore draws its reticle and leader itself, for every source;
core's `ViewMarker` serves views with no placed object of their own — the minimap's indicator and a PiP's
optional outline. One drawing path per use: the lens's reticle is never also declared as a core marker.

**labkit and forge afterward.** labkit re-exports or thinly wraps what it exposed from
`@weasel-js/labkit/loupe` so forge's imports keep working through the move, then forge imports from
`@weasel-js/lens` directly. Forge keeps `ForgeLoupe`, Live, Pixels, conditions, the compare menu and
capture.

**Done when** forge's workshop lenses behave as they do now on `@weasel-js/lens` (its existing lens
tests, moved, pass), and a site demo puts parked lenses over a plain `<SceneCanvas>` with the canvas
source.

## Arc 3 — the assemblies

Each is rebuilt on core's aims and markers and on `@weasel-js/lens`, keeping its public API unless the
arc's plan names a change.

| Assembly | Frame | Aim | Held | Marker |
|---|---|---|---|---|
| hud loupe | follows the pointer | a patch around the pointer | aim | none |
| parked lens | placed body | the reticle's pose (pinned, follow, glass) | aim | its own reticle node, not a `ViewMarker` |
| PiP | the `<CanvasView>` rect | its camera | camera | optional: its aim in the root view |
| minimap | its rect | everything, fitted | aim (fit) | the root view's aim inside it, draggable |

- **Minimap:** the indicator layer and `minimapPanAction` give way to an interactive `ViewMarker`
  (or a contribution's `markers`) of the root view's aim; `computeFitView` becomes the minimap's aim.
  `<MinimapCanvas>` on a second canvas element keeps working, drawing the main view's aim from an
  `AimSource` fed the main camera through props and the `rootView` dep. Having no view registry, it grabs
  its marker through `grabViewMarker` and binds the drag with `createViewMarkerContribution`.
- **hud loupe:** `createLoupe` already builds its picture with `addView` and a viewport layer; its
  pointer-derived camera becomes an aim-held view whose aim follows the pointer.
- **PiP:** `<CanvasView>` is already the PiP; it gains the optional marker, nothing else.

**Done when** the minimap, PiP and hud loupe demos and tests pass on the model, and the minimap package
no longer has an indicator layer or pan action of its own.

## Constraints

- Core imports nothing from `@weasel-js/lens`, `@weasel-js/loupe` or kernel3d.
- `@weasel-js/loupe` keeps its dependencies (geom, registry) and gains none.
- Every changeset is `patch`; say in its prose what breaks.
- `npm run check:size` (400 lines a file, 120 a function) holds; `LensOverlay.tsx` is near it now.
- Tools follow the action family that owns them; the lens keymap and its `delete`/`loupe.seam`
  overrides move with the lens scene. A package that ships tools ships the `ToolSet`s and the hook
  building them.

## Left to the builder

- How the `<SceneCanvas>` lens layer gets a canvas and a container — over the surface's overlay
  machinery or a view of its own.
- CSS class prefix for the moved styles, and how the package ships its stylesheet.
- Whether labkit keeps compatibility re-exports past arc 2, given forge is the only consumer.
- The order of the arc-3 assemblies.
