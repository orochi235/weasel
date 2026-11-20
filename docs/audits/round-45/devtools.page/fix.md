set-overlays only takes debug features (A+B): fixed 2d74df0ad6

A root removed while its canvas stays mounted keeps the panel's override (A+B): fixed 26d3bee4d4

The page accepts `yo` and requests from any frame (A+B): fixed 69e384b534. A message whose `source` is a different window is ignored. A null `source` still passes, because jsdom sets none; every real sender (another frame, or the content script) has a non-null one.

An emptied override still forces the overlay on (A): fixed 5e190df3f7. This also changes core: `withOverride` now leaves an overlay that is off, off, when the override turns nothing on.

The root keeps the trace and coords rings it first saw while its getters read the current dep (A): fixed d63dbc54d8. The root holds a ring that follows the canvas's current one: it moves watches, subscribers and cursors over, and rebinds on a dep-registry change. The coords ring is stable once the inspection dep has made it, so only reads rebind it.

`dimension` is decided once, from the first root node, so an empty 3D canvas shows as 2d (A+B): fixed e02f06e9a1. A canvas with a `camera3d` dep is 3d. A session's notices send `root-added` again when a root's label or dimension changes, and `client.ts` keeps a re-announced root in its place in the list.

`connect` keeps listening after `bye` (A): fixed fb5b8064b7

`serialize` writes Error, RegExp, DataView, DOM nodes and other built-ins as `{}` (A+B): fixed dc7db17a08. Each now gets `$class`, and errors, regexps and buffers also get their own fields. Maps and sets are recognized by their internal slot, so an object whose `toStringTag` only claims `Map` no longer throws.

The history ring is not reset when the scene is swapped (B): fixed 351a65b62d. Each scene gets a fresh ring behind the same follower.

Extra defects found while fixing: none. There were no unruled calls, so `docs/unruled.md` is unchanged.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `packages/devtools/src/page/attach.test.ts`: pass (5)
  - `packages/devtools/src/page/session.test.ts`: pass (14)
  - `packages/devtools/src/page/hook.test.ts`: pass (4)
  - `packages/devtools/src/page/serialize.test.ts`: pass (13)
  - `packages/devtools/src/page/notices.test.ts`: pass (2)
  - `packages/devtools/src/client.test.ts`: pass (21)
  - `packages/core/src/debug/override.test.ts`: pass (3)
- `npm run checks:gate`: pass, "checks:gate: all 32 passed". The first run failed on typecheck, check:changesets and check:proto-index; I fixed those and folded the fixes into their commits.
- `npm run lint -w @weasel-js/devtools` and `npm run lint -w @weasel-js/core`: fail, because neither package has a `lint` script ("Missing script"). Instead I ran `npx eslint` on every changed file: pass. Root `npm run lint` (in the gate): pass. `npm run check:size`: pass.
- Unrun: `packages/devtools/src/page/canvas.browser.test.tsx` (not touched, browser-only).
- The tree is clean.