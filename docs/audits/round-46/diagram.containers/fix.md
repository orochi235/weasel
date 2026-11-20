Header double-click tests a world point against the stored, parent-local box (A+B): fixed 5fc6e39881

Releasing a lane draws its members under the pool's fill (A): fixed 8e6f126696

`diagramCanDropInto`'s plain-group branch admits marks, sequence parts and anchor/mark traits (A): fixed f3d0b900cd

`diagramDropParentAt` puts stencils into locked or hidden containers and never asks `canDropInto` (A): fixed 331f5a2439. Each candidate now goes through core's `childVerdict`. When no `canDropInto` is given it defaults to `diagramCanDropInto`, because diagram containers are marks and core's own default refuses marks. The host's `canReparent` is still not asked about an insert: with no ids, the verdict is true before `canReparent` comes up. Core's insert path behaves the same way.

Adding a lane at an index colors it by child order, not stack order (A): fixed 0c69b71de7. `themeWrites` now ranks lanes by their midpoint, as `laneStackLayout` does. `addLane` also recolors the lanes after the new one, since they move down a place.

Lane affordances and the resize drag ignore a pool's rotation (A): fixed 61aa1e110e

`containerBuild` hard-codes the rigid composition while `addLane` uses the scene's (A): fixed 2c83c00f4b. For pools, the layout pass rewrites lane poses and hid the bug. It showed in `stencilInsertOps`, which had the same hard-coding and is fixed in the same commit. Both now take a `composition` option, and `useStencilInsert` passes the scene's.

Growing a lane past the lanes after it reorders them on commit (B): fixed 196e7f18fa

`diagramDropParentAt` composes poses through envelopes, which define no frame (B): fixed d3549dd5ab. The walk also stopped at any node whose own box missed the point. That pruned envelopes and plain groups, whose boxes need not cover their children, so it now prunes only at regions.

A lane can move into a pool stacking along the other axis (B): fixed 5deadb7f28. I made the strict call to refuse it rather than rewrite the lane's header and layout, and recorded it in `docs/unruled.md`.

Extra defects:

Region header and body hit-tests ignore rotation in `regionHeaderAt` and `diagramDropParentAt` (sweep): fixed 4fa8963c87

ac156e9227 is housekeeping, not a fix: it shortens the changeset titles that `check:changesets` rejected for running over 140 characters, and fixes a test cast that failed typecheck.

Checks:
- `npx vitest run --maxWorkers=1`, one at a time: `canDropInto.test.ts` pass (12), `containerActions.test.ts` pass (14), `containerTheme.test.ts` pass (3), `containerTitle.test.ts` pass (2), `containers.scene.test.ts` pass (15), `stencil.test.ts` pass (16). Also run and passing: `containerActions.pbt.test.ts`, `regions.marks.test.ts`, `containerLayout.test.ts`, `stencilTool.test.ts`, `diagramTools.test.tsx`, and theme's `themeWrites`, `theme.scene`, `themeEdit` and `themeEdit.scene` tests.
- Each new test failed against the code before its fix.
- `npm run checks:gate`: first run failed (typecheck and `check:changesets`, fixed above); rerun: "checks:gate: all 32 passed".
- `npm run check:changesets`: pass.
- `npm run typecheck:packages -- diagram`: pass.
- `npm run lint -w @weasel-js/diagram`: not run, because `@weasel-js/diagram` has no `lint` script ("Missing script"). Instead, `npx eslint` on every changed `.ts` file: pass.
- No `*.browser.test.*` file touched.
- Tree clean apart from `.skulk/`.