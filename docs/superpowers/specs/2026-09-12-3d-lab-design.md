# The 3D lab

A labkit lab that renders a 3D viewport with bespoke WebGL and drives it through
weasel core's existing dispatcher, actions and deps. For a weasel maintainer
working on `docs/superpowers/specs/2026-08-22-3d-kernel-design.md`, which parks
Phase 2 — a 3D kernel package — behind questions nobody can answer from the 2D
code alone.

It answers three of them:

- **What replaces the world point when a pointer is a ray?** The hypothesis is
  nothing: the point stays two numbers and changes meaning.
- **Does the action pipeline reuse, or does the kernel want its own dispatcher?**
- **Does selection chrome transfer?**

The lab is the instrument, not the product. What ships past it is a log of every
place a 2D assumption forced a cast, a stub or a reinterpretation, folded back
into the kernel doc.

## What it does

Orbit and dolly a camera over a handful of solids. Click one to select it. Drag
it along a plane. Undo. Drag on empty space to marquee-select. Drag with the box
tool to create a solid.

## Where it lives

`packages/labkit/examples/3d-lab/`, beside `minimal`, `drag-lab`, `weasel-lab`,
`schema-lab` and `annotate-lab`, with a `dev:3d` script in labkit's
`package.json`. The shell is `index.html`, `main.tsx`, `ThreeDLab.tsx`,
`SolidInstrument.tsx` and `styles.less`; the rest is the modules below.

The lab is added to the root `tsconfig.json` include list and to the `labkit`
vitest project's glob. Neither reached `examples/` before — only `schema-lab` is
typechecked, and no example had ever carried a test.

## The surface

`<Lab>` already mounts the shared buffer, sizes it per frame and publishes it,
so the lab takes `useSurfaceCanvas()` and calls `getContext('webgl2', {
preserveDrawingBuffer: true })` on it. A host owning the surface above `<Lab>` is
supported and unnecessary here.

The consequence to know: that buffer is `z-index: 1`, above the instrument's own
DOM. Right for annotation marks, and the reason an opaque 3D tile has to paint
its own chrome — see below.

The instrument attaches `useSurfaceTile('viewport')` to its pane and registers a
painter under the same scoped id. Tile ids are trial-scoped — `useTileId` returns
`` `${trial}/${id}` `` — so the painter and the rect lookup must both go through
it.

Three traps the surface's own `AGENTS.md` names, all of which bite a first GL
tenant: `preserveDrawingBuffer` is the consumer's job and partial redraw without
it turns tiles black; gutters lie outside every scissor, so the whole surface is
cleared when the tile set changes; and a tile that moves without resizing is
already handled by `Workspace`.

## The renderer

WebGL2, one program, flat shading, depth test on, one draw call per solid,
geometry generated in code. No batching, no atlas, no instancing — none of it is
what the lab measures, and all of it would obscure what it does.

`renderer3d.ts` exposes `createRenderer3d(gl)` returning `{ draw(meshes, camera,
deviceRect), dispose() }`. It knows nothing about weasel: it takes a list of
`{ geometry, pose, color, selected }` and a camera, and draws.

## The scene is weasel's

`Scene<SolidData, string, Pose3>`, where:

```ts
type Vec3 = readonly [number, number, number];
type Pose3 = { position: Vec3; rotation: Quat; scale: Vec3 };
type SolidData = { kind: 'box' | 'sphere'; color: string };
```

The kernel doc claims `Scene` is fully dimension-neutral. Nothing has tested
that; this is the test. A failure here is the most interesting result the lab
can produce, because it would move the boundary the whole doc rests on.

## The interaction spine

`useGestureDispatcher` requires three options — `canvasRef`, `actions`,
`toolsById` — and `canvasRef` is typed `HTMLElement`, so the 3D pane's own div
serves. The provider stack is `<WeaselProvider isolate>`: one registry and one
dispatcher per trial, so a second trial cannot displace the first.

**`clientToWorld` is where 2D-ness enters the pipeline, and the lab's central
claim is that it is the only place.** `<SceneCanvas>` passes a function that
inverts the view transform, which is what makes `ctx.world` a world position. The
lab passes identity, so `ctx.world` carries the client point, and every dep below
rebuilds the ray from the camera in its own closure, subtracting the pane's origin
itself.

Identity rather than pane-relative for a reason: the dispatcher calls
`classifyTarget` with a raw client point on the pointer paths and a
`clientToWorld`-transformed one on the click path. Transforming here puts those two
in different spaces, and the press then classifies as empty canvas while the click
behind it picks a solid — which is exactly how `clearSelection` came to wipe every
selection the moment it was made.

If that holds, `InvocationCtx` needs no point type parameter: two numbers are
enough in both kernels, and only their meaning differs. If it does not, the lab
records exactly where it broke.

Two coordinate bugs in the same neighborhood, both recorded in `docs/TODO.md`
rather than fixed here: `buildInvocationCtx` (`dispatcher.ts:611-627`) fills
`ctx.screen` and `ctx.world` from the same event coordinates, and `classifyTarget`
is called in two different spaces depending on the path. The lab is unaffected by
the first and works around the second.

## Deps

Each is mounted against core's real action first. When the action fights, the
fight goes in the log and the lab supplies its own.

| dep | what the lab supplies |
|---|---|
| `nodeAtPoint` | screen point → ray → nearest solid by `t` |
| `areaSelect` | screen rect against each solid's projected box |
| `snap` | identity |
| `insert` | screen rect → ray through its center → ground plane → a box sized by the rect |
| `scene`, `selection`, `applyOps`, `history`, `poseComposition` | expected to need nothing 3D-specific |
| `poseDescriptor` | `getBounds` as the screen-projected AABB; `remapBounds` and `fromBounds` throw |
| `camera3d` (new, lab-local) | orbit camera; `view` cannot hold one |

`poseDescriptor` is the interesting half-fit. Its whole interface is expressed in
`Bounds`, so a pose can be any shape but the interchange currency is a 2D rect.
Read as a *screen-projected* AABB that is meaningful — it is what chrome needs —
and `getBounds`/`intersectsRect` work. Going the other way does not: a screen
rect does not determine a 3D pose without a depth choice, so `remapBounds` and
`fromBounds` throw rather than guess, and every action requiring them is recorded
as not transferring.

`geometryProjection` is the other outright fight: `transform(node, m: Mat3)`
cannot hold a 3D transform.

## Tools

`useSelectTool` transfers. Its 2D AABB default lives in `pickEvery`/`pickBest`,
which are already props, so overriding them with ray picks is the supported seam
rather than a workaround.

`useHandTool` does not: it routes to `viewport.dragPan`, which requires the 2D
`view` dep. The lab defines `orbit` and `dolly` instead. The kernel doc predicted
viewport tools would be the exception; this is the lab confirming it, and it is
expected to be the only one.

## Undo

Not labkit's `undo?` capability: it `structuredClone`s the whole instrument state
per snapshot, and GL handles do not survive that. The scene brings its own
`History`, which is registered as the `history` dep so the kit's `undo`/`redo`
actions drive it through the dispatcher — the same path a 2D consumer uses.

## Selection chrome

Drawn in GL, as screen-space line loops over the tile. Not by preference: the
shared buffer paints above the instrument, so an outline in the pane's DOM would
sit behind the viewport that covers it.

That answers the kernel doc's open question at the math level only — the geometry
of screen-space chrome transfers, and the outline tracks the camera through an
orbit. Whether the overlay *code* ports is a separate question this lab does not
touch.

## Testing

No WebGL in the vitest suite — the surface's `AGENTS.md` is explicit, and jsdom
measures every element as zero. So:

- The math is unit-tested directly: ray/AABB intersection, unprojection, orbit
  camera matrices, screen-AABB projection, ground-plane intersection.
- The dispatcher wiring follows `packages/core/src/tools/integration.test.tsx`:
  providers, `useGestureDispatcher`, synthesized pointer events, assert the
  action ran.
- The GL output is proofed by screenshot.

These files run under the `labkit` vitest project, whose include glob had to be
widened to reach `examples/` — nothing had ever put a test there, so
`check:test-projects` would have failed on the first one.

## Non-goals

- A kernel package. This lab produces the evidence for one; it is not a
  prototype of one, and nothing in it is meant to be promoted as-is.
- Any change to `@weasel-js/core`. Where core fights, that is the finding. A
  change made to accommodate the lab would destroy the measurement.
- Renderer quality. Lighting, shadows, materials, antialiasing and batching are
  all out.
- three.js. The build-vs-adopt question stays open; writing the picking math by
  hand is how the lab learns what a kernel would owe.
