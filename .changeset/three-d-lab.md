---
'@weasel-js/labkit': patch
---

Adds a `3d-lab` example: a WebGL viewport driven by weasel core's dispatcher,
actions and select tool. Run it with `npm run dev:3d` from `packages/labkit`.

It exists to answer what a 3D kernel would owe core, and it answers the main
one — nothing about the dispatcher changes shape. Findings are in
`docs/superpowers/specs/2026-08-22-3d-kernel-design.md`.

Two bits of infrastructure came with it, because `examples/` reached neither
before: the lab is in the root `tsconfig.json` include list, and the `labkit`
vitest project's glob now covers `examples/` as well as `src` and `scripts`.

Dragging a solid paints a ghost. `moveAction` keeps the interim pose on its
handle and commits one op on drop, so the lab reads those poses off the
dispatcher's in-flight handles and draws them translucent over a footprint on
the ground plane, while the solid stays at its committed pose until the drop.
