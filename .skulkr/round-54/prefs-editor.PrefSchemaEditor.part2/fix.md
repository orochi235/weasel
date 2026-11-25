Mixed enum options and pair editor show as empty, so the first edit overwrites every selected node's list (A): fixed 5fcc410cf7

Tree drag moved from the preview onto the Unplaced list leaves the preview's drop drawn and its rail timer running (A): fixed a177f0aae8

Tree drag onto the Unplaced list, or one that can no longer land, never ends the preview's drop (B): duplicate of A's tree-drag finding, fixed in a177f0aae8

`useAssetChanges` returns `report`'s result from an effect, which React then calls as a cleanup (A): fixed 75ab4edb0a

`useAssetChanges` hands `onChangedAssets`'s return value to React as an effect cleanup (B): duplicate of A's `useAssetChanges` finding, fixed in 75ab4edb0a

`heirAfter` gives no heir when the removed node sits inside a folded branch, so Delete clears the selection (A): fixed c52979b8b4. The heir is now the innermost drawn row that holds the removed node.

"Add pref" with nothing selected puts a loose leaf at a root that holds pages (B): fixed cd3ae64399. I made the strict call: "Add pref" is disabled wherever the new pref would sit under that root on no page, which also covers a selected loose root leaf. The call is recorded in `docs/unruled.md`. `AssetEditor.panel.test.tsx` assumed "Add pref" was enabled with nothing selected, so it now selects a page first.

No extra defects found. A sweep of the package for the same expression-bodied effect pattern found no other case.

Checks:
- `attrRenderers.test.tsx`: pass (7)
- `useTreeDragOut.test.ts` (new): pass (2)
- `AssetEditor.changedAssets.test.tsx`: pass (2)
- `heirAfter.test.ts`: pass (5)
- `PrefSchemaEditor.test.tsx`: pass (54)
- `AssetEditor.panel.test.tsx`: pass (4)
- `npm run checks:gate`: first run failed in `check:changesets` (my five changeset titles were over 140 characters). I shortened them and folded the fixes into each commit. Rerun: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/prefs-editor`: could not run, because the package has no `lint` script ("Missing script"). Instead I ran eslint on every changed file: pass (exit 0).
- Tree is clean apart from `.skulk/`.

tally: 7 of 7 fixed, 0 extra fixed