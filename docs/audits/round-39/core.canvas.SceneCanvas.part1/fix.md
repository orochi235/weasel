All five distinct findings are fixed, one commit each, and the tree is clean. The two reviewers' `isAtom` findings were the same defect, so it is counted once. No behavior call came up that needed ruling on, so `docs/unruled.md` is unchanged.

- **`isAtom` called node-kind and tool-action presets bundles (A+B)**: fixed 43034110cb. Every `FeaturePreset` key is now classed in a record, so a new role fails to compile until someone classes it. A also said `toolActions` are missing from `PresetDescription.actions`. That is not a defect: the field is documented as the preset's own registration-order actions, and with `atom` now true the bundle editor no longer breaks such a preset apart.
- **Polygon or star insert preview collapsed under a flipped view and kept its regular shape under a stretched one (A)**: fixed d41599fcf4. Every preview outline, box, line and pencil included, is now built in world and mapped by the view's affine.
- **Preset components were keyed by index, so toggling a preset remounted the ones after it (A)**: fixed d64e624a93. Each component keeps one key for as long as it lives.
- **A preset component mounted after the children published its deps over theirs (A)**: fixed d64e624a93, in the same commit as the key fix because both change `PresetComponents.tsx`. It adds new routing API, so it gets a `minor` changeset:
  - `DepRegistry.register(name, source, { rank })`
  - `rankedDepRegistry`
  - `<DepRank>`
  
  The canvas ranks its presets' components at 1, over its own deps at 0, and its children at 2. One side effect: the children's deps now also sit over the dispatcher's own `ruleCtx`, `keymaps` and `dispatchTrace`, which used to win over the children by registering last.
- **A refining preset's `includes` were placed after it (A)**: fixed ff6cf061cf. Placing a preset now places its includes first.
- **A frame hook added to a phase already subscribed waited for an unrelated redraw (A)**: fixed 44132ee52b. A separate effect requests a frame whenever a hook the surface hasn't run yet appears.

No extra defects found while fixing.

**Checks**
- `npx vitest run --maxWorkers=1`, each file on its own: pass
  - `packages/editing/src/integration/core/canvas/SceneCanvas/describePresets.test.ts` (13/13)
  - `packages/core/src/canvas/SceneCanvas/insertPreviewCommands.test.ts` (5/5, new file)
  - `packages/core/src/canvas/SceneCanvas.frameHooks.test.tsx` (11/11)
  - `packages/editing/src/integration/core/canvas/SceneCanvas/features.test.ts` (35/35)
  - `packages/core/src/canvas/SceneCanvas/PresetComponents.test.tsx` (2/2, new file)
  - `packages/routing/src/interactions/actions/depNode.test.ts` (12/12)
- Extra local sanity runs: pass
  - `packages/routing/src/interactions` and `packages/core/src/canvas` (409 files, 2557 tests)
  - `packages/editing/src` and `packages/text-tools/src` (392 files, 3068 tests passed, 1 skipped)
- `npm run typecheck:packages -- core routing editing`: pass (core ok, editing ok, routing ok)
- eslint on every changed `.ts`/`.tsx`: pass
- `npm run check:size`: pass ("no file or function grew past its cap")
- `npm run check:changesets`: pass ("OK — 1830 changeset(s)")
- No `*.browser.test.*` files were touched, so none are unrun.