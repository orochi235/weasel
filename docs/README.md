# weasel docs

Reference docs for `@weasel-js/core`. The top-level
[README](../README.md) is the elevator pitch and install guide; these files
go deeper.

Read in roughly this order:

- [concepts.md](./concepts.md) — the mental model: `<Canvas>`, adapters,
  poses, ops, gestures, selection, layers, tools.
- [hooks.md](./hooks.md) — the hook surface (state primitives, drag
  primitives, and viewport helpers), plus the action table and default
  keybindings. Interactions are action descriptors reached by gesture
  bindings, not per-interaction hooks.
- [adapters.md](./adapters.md) — the adapter a scene is read and written
  through: where it comes from, the contract in slices, and writing one by
  hand.
- [extending.md](./extending.md) — custom layers, custom gesture behaviors,
  non-rect poses via `PoseDescriptor<TPose>`.
- [taxonomy.md](./taxonomy.md) — what gesture, action, interaction, binding,
  group, and selection each mean, and the precedence rules a binding wins by.
- [dispatcher.md](./dispatcher.md) — diagrams of input routing: the dispatch
  pipeline, which binding wins, and how input scopes and yokes answer.
- [snapping.md](./snapping.md) — snap sources, how the resolver ranks them,
  and writing a source or an action that snaps.
- [path-operations.md](./path-operations.md) — every operation that changes a
  path's shape, by the gesture that drives it.
- [devtools.md](./devtools.md) — the hook a page publishes its canvases on,
  the panel protocol, and the devtools panel and extension.
- [conventions.md](./conventions.md) — API naming and design rules, tokens,
  and the appearance props.
- [icons.md](./icons.md) — icon names (`core:undo`), where each glyph is
  drawn, the registry, and the build plugin that ships only the glyphs a
  build names.
- [editing-sessions.md](./editing-sessions.md) — what a scene's document owns
  and what each editing session over it owns: selection, previews, scroll, and
  whose selection an undo restores.
- [scene-serialization.md](./scene-serialization.md) — `scene.toJSON()` and
  `sceneFromJSON()`: snapshot + restore a scene, the JSON shape, the function
  registry for `clipFromPose`, and loading static `*.scene.json` files.

[releasing.md](./releasing.md) is the maintainer runbook — the changeset flow,
OIDC trusted publishing, and how to publish by hand when CI can't.

For working code, the `apps/site/` directory has runnable consumers
(`TransformDemo`, `CompoundPathsDemo`, `InsertDemo`, …); run them
with `npm run dev:kit` from the repo root (port 33451, or 33421 when that is taken; every dev server's
port is in `scripts/dev-ports.json`).

`docs/specs/` and `docs/TODO.md` are internal: design notes and open work.
