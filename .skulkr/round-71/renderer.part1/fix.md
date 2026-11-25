Composite pass leaves the color matrix's alpha unclamped (A+B): fixed bd57563711. The WGSL composite had the same mistake and is fixed in the same commit.

`cullDrawCommands` copies a partly culled `retain` group, so its surface is redrawn every frame (A): fixed 89ed3f7042 (changeset title shortened in 834d1b4f2a).

bake.ts module doc says the bake is straight alpha and the shader premultiplies (A+B): fixed 868d3b4b3d. The WGSL mesh shader's "straight-RGBA" doc is fixed in the same commit. No changeset, because only comments changed.

Overlapping mesh patches overwrite each other's texels instead of compositing (A): fixed 358ef09354. Each patch is now drawn into its own layer and composited source-over onto the earlier ones. Texels on a patch's outline still replace what is under them, so two translucent patches that share an edge leave no doubled seam.

A lost WebGL context that never comes back keeps the images it last drew pinned (A): fixed 89246cfc94 (changeset title shortened in 834d1b4f2a).

`Effect.uniforms` and `registerEffect` docs leave out `u_windowOrigin` (B): fixed 57017f95ea. Docs only, so no changeset.

With both `gl` and `canvas` given, the renderer sizes and watches `canvas` while drawing to `gl`'s own canvas (B): fixed cf2df88891. This needed a strict call: the constructor now throws when `canvas` is a different real canvas from `gl.canvas`. A test double's stand-in `gl.canvas` is not checked, because about 54 test files pair a recorder `gl` with an unrelated canvas. The call is recorded in `docs/unruled.md` under "Audit round seventy-one (2026-11-22): renderer, part one".

No extra defects.

Checks:
- `npx vitest run --maxWorkers=1 packages/renderer/src/cullDrawCommands.test.ts`: pass (24 passed)
- `npx vitest run --maxWorkers=1 packages/renderer/src/meshPaint/bake.test.ts`: pass (13 passed)
- `npx vitest run --maxWorkers=1 packages/renderer/src/WeaselRenderer.test.ts`: pass (23 passed)
- `npx vitest run --maxWorkers=1 packages/renderer/src/effects/effectPrelude.test.ts`: pass (1 passed)
- meshPaint bakeCache, handles, meshStops and surface tests: pass
- `npm run check:changesets`: pass ("OK — 455 changeset(s)")
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/renderer`: did not run, because the package has no `lint` script ("Missing script: \"lint\""). The root `npm run lint` inside the gate passed.

tally: 7 of 7 fixed, 0 extra fixed