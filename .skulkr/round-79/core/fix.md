usePublishPointer leaves a gone view's pointer in the store on teardown (A): fixed 2941bbcb4d

usePublishPointer leaves the store holding a pointer over an unmounted view (B): duplicate of the A finding above (fixed 2941bbcb4d)

createDragPanContribution's plain-drag pan refuses a modified drag, unlike the middle-drag pan and the hand tool (A): fixed 34d1b073ca

makeMatchMedia's list snapshots `matches` at creation, so it goes stale after `fire()` (A): fixed 15f8eeab73. This helper is only used by tests and is not published, so it has no changeset.

extensionParts silently drops every extension part when `AnchorState.getNode` is missing (A): fixed 88a6765c2d. This was a behavior nobody had decided, so I made the strict call. The type now requires `getNode` whenever `extensions` is given, and at run time a state without it warns once and offers no parts. There is no override. The call is recorded in `docs/unruled.md`.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/core/src/input/usePublishPointer.test.tsx`: pass (10/10)
- `npx vitest run --maxWorkers=1 packages/core/src/tools/builtin/hand/createDragPanContribution.test.tsx`: pass (10/10)
- `npx vitest run --maxWorkers=1 packages/core/src/testing/matchMedia.test.ts`: pass (1/1)
- `npx vitest run --maxWorkers=1 packages/core/src/core/viewport/useCanvasSize.test.ts`: pass (8/8)
- `npx vitest run --maxWorkers=1 packages/core/src/core/device/useDeviceProfile.test.tsx`: pass (7/7)
- `npx vitest run --maxWorkers=1 packages/core/src/affordances/pathAnchors.test.ts`: pass (5/5)
- `npx vitest run --maxWorkers=1 packages/core/src/canvas/affordanceAt.extensionParts.test.ts`: pass (2/2)
- `npm run checks:gate`: pass (exit 0)
- `npm run check:changesets`: pass (OK, no warnings on the new changesets)
- `npm run lint -w @weasel-js/core`: not run, because `@weasel-js/core` has no `lint` script. Instead, `npx eslint` on every changed file: pass

tally: 5 of 5 fixed, 0 extra fixed