# weasel docs

Reference docs for `@weasel-js/core`. The top-level
[README](../README.md) is the elevator pitch and install guide; these files
go deeper.

Read in roughly this order:

- [concepts.md](./concepts.md) — the mental model: `<Canvas>`, adapters,
  poses, ops, gestures, selection, layers, tools.
- [hooks.md](./hooks.md) — the hook surface, plus the action table and default
  keybindings. Interactions are action descriptors reached by gesture
  bindings, not per-interaction hooks; what's left here is state primitives,
  drag primitives, and viewport helpers.
- [adapters.md](./adapters.md) — adapter shape, the structural-typing trick
  (one struct satisfies all the narrow per-hook adapters), and `arrayAdapter`
  as the default.
- [extending.md](./extending.md) — custom layers, custom gesture behaviors,
  non-rect poses via `PoseDescriptor<TPose>`.
- [scene-serialization.md](./scene-serialization.md) — `scene.toJSON()` and
  `sceneFromJSON()`: snapshot + restore a scene, the JSON shape, the function
  registry for `clipFromPose`, and loading static `*.scene.json` files.

For working code, the `apps/site/` directory has runnable consumers
(`TransformDemo`, `CompoundPathsDemo`, `InsertDemo`, …); run them
with `npm run dev:kit` from the repo root.

`docs/specs/`, `docs/plans/`, and `docs/TODO.md` are internal — design
notes, in-flight work, and historical decisions. They are not part of the
user-facing reference.
