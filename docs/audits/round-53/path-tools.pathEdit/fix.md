No-op anchor drag commits an undo step (A): fixed 7a3bde467b

Symmetry check's fixed 1e-3 tolerance fails on paths far from the origin (A): fixed 7c81b716d5

Marquee that sweeps no anchor leaves the selected mark selected (A, and B's first half): fixed 4aae022749

Canceled marquee doesn't give back the mark it cleared (A, and B's second half): fixed e10fde97a7

insertPathAnchor selects an anchor after a refused insert (A+B): fixed cc2d37eb5c

setAnchorField stays enabled where its run does nothing (A+B): fixed 2d37b079be. My own call, recorded in `docs/unruled.md`: asked with no params, it still answers for the anchor selection alone.

Shift-press that deselects the anchor still runs a snap session (A): fixed 038cd89a5a

cutPathAtAnchor enabled for clicks that cut nothing (B): fixed 8aa9e18abd

Anchor drag and segment bend handle an unfinishable frame differently (B, first half): fixed 3f67cc6c11. The bend now drops a frame no extension can finish, as the anchor drag does.

Anchor drag runs `finishEdit` twice on its commit (B, second half): fixed 2925b75e9e. The drag now commits the frame it made, not the already-finished one.

Extra: `commitAnchorEdit` returned true for an edit the extensions refused, so delete, cut, join, and bridge cleared the selection over an unchanged path (sweep): fixed cc2d37eb5c, in the same commit as the insertPathAnchor fix.

Extra: `editAnchors.pathSnap.test.ts` asserted a commit for a drag that snaps back onto its press point, which is the no-op the 2026-11-10 ruling forbids (sweep): fixed 7a3bde467b. It now expects no commit.

Note: core's `setPath` had a private polygon equality. It moved to geom as an exported `samePolygon`, and both core and the drag now use it. That comes with a minor geom changeset.

Checks:
- Each touched test file, one at a time with `--maxWorkers=1`: pass.
  - editAnchors.commit 3/3
  - editAnchors.pathSnap 6/6
  - symmetry 2/2
  - bendSegment 5/5
  - insertPathAnchor 2/2
  - anchorFields 4/4
  - anchorEditing 26/26
  - setPath 9/9
- Neighboring drag tests also pass: editAnchors.extensions, handleLocks, live, quantize, symmetry, editAnchors.test, anchorJoin, and anchorHandles.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed typecheck, typecheck:packages, and check:changesets. I fixed those and folded the fixes into their commits.
- `npm run lint -w` for geom, core, and path-tools: fail with "Missing script: "lint"", because none of the three packages has a lint script. I ran `npx eslint` on every changed .ts/.tsx file instead: pass, exit 0.
- `npm run check:changesets`: "OK — 2548 changeset(s)".
- Tree clean.

tally: 12 of 12 fixed, 1 extra fixed