# weaselchart (`apps/chart`) — design

**Unbuilt as of 2026-10-19.** Covers the first arc only; the second arc is listed at the end.

For whoever plans and builds the first arc. It says what weaselchart is, which engine surface it
adds to `@weasel-js/diagram`, and what the app and the shared editor shell look like.

## Intent

weaselchart is a sibling app to weaseldraw (`apps/draw`): a Visio-style diagram editor. It has
two jobs beyond being an editor:

- **A testing ground for the diagram engine.** Every editing ability it needs is built as engine
  surface in `@weasel-js/diagram`, not in the app. The app proves it works in a real editor.
- **The source of labkit's diagram editing.** labkit wants labs whose subject is a node graph,
  effect-pipeline authoring, and use cases not yet named. labkit cannot import an app, so
  everything it will need lives in packages.

weasel is an engine (see `CLAUDE.md`, "Scope"). Design each ability general and composable, not
the minimum this app needs.

## Decisions (2026-10-19)

- **The app is `apps/chart`**, matching `apps/draw`.
- **Two document models, one set of editing actions.**
  - *Chart mode*: the scene is the document, as in draw. Shapes and connectors are scene nodes;
    edits are ops; undo is scene history.
  - *Pipeline mode*: the document is an `EffectPipeline` (`@weasel-js/diagram/effect`), edited
    through `DiagramView`. This exercises the data-backed path labkit will use.
  - Each editing ability is written once, as a scene action. Today `DiagramView` reports moves
    through `useSceneSync` (`sceneSync.ts`) and connects through the connect action's `commit`
    hook, which draws nothing and leaves the host to add the edge to its data.
- **Every editing action has a swappable commit, the way connect does today.** Its default commit
  writes scene ops, which chart mode uses. A data-backed host replaces it with a callback and
  updates its own data, which flows back into the scene through `reconcileSpecs`. Edits are never
  read back out of the scene, so `fromData` is never reversed and a data-backed edit never lands in
  scene history. This is the same seam the `insert` dep gives a consumer for minting nodes.
- **Edges and wires get an optional stable `id`.** `DataEdge` and `EffectWire` gain `id?`;
  without one, `edgeIdOf`'s derived id still applies. A reconnect or label edit on an edge with an
  `id` is an update to that edge, not a remove plus an add.
- **A stage placed from the palette is a copy of its stage type**, with its own ports and params,
  plus a `type` tag recording where it came from. There is no live link: the pipeline stays
  self-describing, and `EffectChart` renders it with no stage-type registry.
- **Only the `nodeGraph` look is editable in the first arc.** `compact` draws no ports; `rack`
  and `lanes` place stages themselves, so a drag there has to mean reordering. All three stay
  view-only.
- **Shared editor shell in `apps/shared/editor/`**, private, but laid out as a package so it can
  be promoted to a published `@weasel-js/editor` later without restructuring: its own
  `package.json` (`"private": true`), `src/`, a barrel `src/index.ts`, relative imports inside it
  (published-source rule), and no import from either app. Pieces move out of `apps/draw` as chart
  first needs them, and draw imports the shared copy in the same change — never two copies.

## What already exists

In `packages/diagram`:

| Ability | Where |
|---|---|
| Participant trait on any scene node; ports default to the node's bounds | `trait.ts`, `ports.ts` |
| Edges as scene leaves whose path derives from both ends (`EDGE_DERIVE_PATH`) | `edge.ts`, `edgeTrait.ts` |
| Dynamic glue: an end with no `port` picks the port facing the other end | `resolveEnd` in `edge.ts` |
| Port affordance, connect action, `canConnect` filter | `portAffordance.ts`, `portLayer.ts`, `connect.ts`, `contribution.ts` |
| Routers: straight, orthogonal, bezier | `edge.ts` |
| Flowchart bodies: outline plus text rows as ordinary text nodes | `body.ts`, `outline.ts` |
| Edge labels deriving their pose from the edge | `label.ts`, `labelTrait.ts` |
| Groups, layouts (layered, tree, force, chain), ELK | `group.ts`, `layout.ts`, `diagram-elk` |
| Data → scene with two-way sync (`onMove`, `onConnect`) | `fromData.ts`, `sceneSync.ts`, `DiagramView.tsx` |
| Effect pipeline model, checker, looks, read-only `EffectChart` | `effect/` |

In draw, the glue chart will share: `persistence.ts`, `sessionStore.ts`, `useSessionPersistence`,
`docPersistence.ts`, `fileCommands.ts`, `fileIO.ts`, `surfaces/`, `prefs.ts`,
`PreferencesModal.tsx`, `appCommands/`, `usePageFit.ts`, `pageLayers.ts`, and parts of
`Editor.tsx` / `Workspace.tsx`. The visible chrome is already `@weasel-js/ui` (`MenuBar`,
`Sidebar`, `ToolPalette`, `CommandPalette`, `Toast`, `ContextMenu`).

## First arc

### Chart mode

1. **Stencil palette.** A sidebar of flowchart shapes (the `Outline` set: rect, diamond, stadium,
   parallelogram, trapezoid, hexagon, plus ellipse, which joins `Outline` as a named member —
   my call). Dragging one onto the page inserts a body
   through the `insert` dep, the way `useRectTool` inserts; clicking a stencil arms a tool that
   inserts on drag. A stencil is data (outline, default size, default rows), so a consumer can
   supply its own set.
2. **Connector tool.** Drag from shape to shape to draw an orthogonal connector. Releasing over a
   shape's body gives dynamic glue (no `port`); releasing on a port gives static glue (`port`
   set). The existing connect action starts only from a port; this extends it to start and land
   on a whole participant.
3. **Reconnect.** A selected connector shows a handle at each end. Dragging one onto another
   shape or port rewrites that end with one op; dropping on empty canvas cancels.
4. **Text.** Double-click a shape to edit its label row with core's text editing. Double-click a
   connector to create its `DIAGRAM_LABEL` node if it has none, then edit it.
5. **Delete.** Deleting a shape deletes every connector attached to it, and their labels, as one
   history entry. Core already does this: edges and labels carry `dependsOn`, and the delete
   action removes `scene.removalClosure` in one batch (read in the code, not yet run). The first
   arc adds a test that pins it, and in data-backed mode, reports the removed edges.
6. **Save and load** through the shared editor shell, with chart's own document schema.

### Pipeline mode

7. **Editable pipeline.** A view over an `EffectPipeline` that reports edits back as pipeline
   edits: add a stage, remove a stage (with its wires), add a wire, remove a wire, move a stage,
   set a param. It lives in `@weasel-js/diagram/effect`, beside `EffectChart`, built on
   `DiagramView`'s extended sync.
   - A **palette of stage types**: a stage type is a template (title, kind, ports, params).
   - **Typed connects**: `canConnect` comes from the ports' value types, so a wire between
     mismatched types never commits. `checkPipeline` problems still draw as they do now.
   - **Param editing** in a property panel for the selected stage.

Chart switches modes with a menu command; each mode has its own document.

## Engine surface the first arc adds

All in `@weasel-js/diagram` (`.` or `./effect`) unless noted. Names are the builder's.

- A stencil type and an insert path for diagram bodies.
- Connect that starts and lands on a participant as well as a port.
- A reconnect action and its end handles.
- Creating an edge label from an edge.
- A swappable commit on each of those actions, and `DiagramView` props that take them, reporting
  in `DiagramData` terms (separate callbacks or one edit callback — builder's call).
- `id?` on `DataEdge` and `EffectWire`.
- In `effect/`: a stage-type model, a typed param model, positions for stages, and the editable
  pipeline view over the `nodeGraph` look.

## Calls left to the builder, and calls I made

These are mine, made while writing this; Mike has not ruled on them.

- **Stage positions live beside the pipeline, not in it.** `EffectPipeline` says nothing about how
  it is drawn, so a moved stage's place goes in a sidecar layout keyed by stage id, which the
  editable view takes and reports. Layout runs only for stages with no stored place.
- **Params become typed.** `EffectStage.params` is display strings today. Param editing needs a
  value and a kind (number with range, enum, boolean, string). Extend the model so the existing
  display form still works; the panel renders from the kind through the params family
  (`PropertyPanel`), not a hand-rolled form.
- **Pipeline-mode undo** is the app's: chart holds the pipeline value in `@weasel-js/history` or
  an equivalent stack. The engine reports edits and keeps no history of a model it does not own.
- **Connect onto a whole participant** (dynamic glue in the connector tool) extends the existing
  connect action's target set rather than adding a second connect action, so one resolver still
  answers preview and commit.
- **Dev port** `chart: 33455` in `scripts/dev-ports.json`; scripts `dev:chart`, `build:chart`,
  `test:chart` mirror draw's; the build lands at `dist-chart` and deploys to `/weasel/chart/`
  through `pages.yml` and the build check in `ci.yml`, the way draw does.
- **Tests**: `apps/chart` and `apps/shared/editor` join the `draw` vitest project's `include`
  (which already covers `apps/shared/**`). Anything that needs layout or real pointer behavior is
  a `*.browser.test.tsx`.
- Which draw glue moves first, and how `Editor`/`Workspace` split into shared and app halves, is
  the builder's, subject to the one-copy rule above.

## Constraints

- Tools are declarative shells; actions own gestures and commits (`CLAUDE.md`, "Reference
  implementations"). No tool runs its own gesture and calls `applyBatch`.
- Kit types stay generic over `TPose`. Nothing here bakes in `{x, y}` without saying so: kernel3d
  hosts 3D scenes on the same dispatcher.
- The app imports only public package surface. No `@internal` shortcuts.
- `npm run check:size` limits: 400-line files, 120-line functions.
- Changesets are `patch`.
- Work happens in a worktree and merges on a green `npm run test:fleet` plus `npm run test:gate`.
- Update `docs/TODO.md` when the arc merges, and delete this spec's built half.

## Non-goals for the first arc

- Running a pipeline. Pipeline mode edits the model; `EffectRun` overlays stay as `EffectChart`
  draws them, fed by whoever has a runtime.
- Visio file import/export.

## Second arc (not designed)

Connectors that route around shapes while editing; containers and swimlanes; multiple pages
(`core/pages`); themes; waypoint editing on connectors; editing under the `rack` and `lanes`
looks, where dragging a stage reorders it.
