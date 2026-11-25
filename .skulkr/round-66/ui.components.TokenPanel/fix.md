Font weight with no value shows a blank option (B): fixed f9d80755d0

Scale track never narrows back after its steps change outside a drag (A+B): fixed 7483b81b40. While re-fitting, the track also keeps the margin past both end steps, so the end thumb is no longer pinned (B's part of this finding).

Group named in `scales` drops its base and rule controls when it has fewer than `familySize` steps (B): fixed 58846c953d. A step in such a group whose value is not a plain number with a unit still draws as a plain row; the group's other steps form the scale.

Scale track never narrows back (A): duplicate of A+B above

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/TokenPanel/TokenPanel.test.tsx`: pass (34 passed). It is the only test file I touched.
- `npm run checks:gate`: pass ("checks:gate: all 32 passed"). The first run failed `check:changesets`: three changeset titles were over 140 characters. I shortened them, folded the change into each fix's commit, and reran it to pass.
- `npm run check:changesets`: pass ("OK — 4 changeset(s)").
- `npm run lint -w @weasel-js/ui`: could not run, because the package has no `lint` script ("Missing script: \"lint\""). I ran `npx eslint packages/ui/src/components/TokenPanel/` instead, and it reported no errors.
- git printed "packfile … index unavailable" warnings during the autosquash rebase. The rebase still completed, the log reads correctly, and the tree is clean apart from `.skulkr/`.

tally: 3 of 4 fixed, 0 extra fixed