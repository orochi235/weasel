- Bake drops the group's own stated fields and data (A): fixed 26151294f0. A locked group still refuses to bake, as it already did: core's lock guard throws when its children are moved out, so it can never come out unlocked.
- Guide lines vanish when the center is far off screen (A): fixed a5608309c5
- latticePoints' ±512 index clamp drops in-extent points (A): fixed 0a3185dc9b
- controller.subscribe misses Undo, Redo and outside edits (A+B): fixed d5d216dafa
- Bake drops a copied node's copiesFromPose (A): fixed 72bb935b3d
- Writes and canceled drags normalize the stored spec and drop unknown fields (A): fixed adea65239b
- A negative-size wallpaper extent is outlined by the guide but holds no lattice points (A): fixed 62c0502517
- Center read as shown but written through the document reading, so a group in a scrolled container moves (B): fixed 060e36ec02
- Duplicate of the controller.subscribe finding above (B): duplicate of A "controller.subscribe misses Undo, Redo and outside edits", fixed d5d216dafa
- Wallpaper guide dots more lattice points than the capped copies draw (B): fixed 56707a5404. It adds a new export, `wallpaperLattice`, which has its own `minor` changeset.

Extra: 0a7ffea544 shortens my own changeset titles to fit the 140-character limit. It is not a defect fix.

Checks:
- Every symmetry test file, one at a time with `npx vitest run --maxWorkers=1 <file>`: all pass (bake.pbt 3, bake 2, controller.long.pbt 1, controller.pbt 6, controller 30, group.shrunk 4, guide 15, handleDrag.shrunk 3, handleDrag 6, kinds.edges.pbt 3, kinds.pbt 6, kinds 24, wallpaper.pbt 5, wallpaper.shrunk 1, wallpaper 34). No browser test files were touched.
- `npm run checks:gate`: first run failed 1 of 32 (`check:changesets`: titles over 140 characters). After the fix: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/symmetry`: the package has no `lint` script, so npm errored. Ran `npx eslint packages/symmetry/src` instead: pass, 0 problems.
- `npm run check:size`: pass. `npm run typecheck:packages -- symmetry`: "1/1 symmetry ok".
- The tree is clean apart from `.skulk/`.

tally: 10 of 10 fixed, 0 extra fixed