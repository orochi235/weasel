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
