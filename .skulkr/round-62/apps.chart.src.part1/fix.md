[r33-1] Adds picker reads a non-actor head as Participant (carried): not a defect (no longer applies). Commit e96f89bf7c fixed it. `headKind` in `apps/chart/src/SequencePanel.tsx` now returns null for any outline other than actor or rect, so the picker shows no value for such a head and choosing Participant applies. The test "shows no figure for a head the Adds picker does not name, so choosing Participant applies" in `apps/chart/src/SequencePanel.test.tsx` covers it with a cylinder head.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 apps/chart/src/SequencePanel.test.tsx`: pass (Tests 14 passed (14))
- `npm run checks:gate` and `npm run lint`: not run. I made no commits and changed no files, so there was nothing new for them to check. The tree is clean.

tally: 0 of 1 fixed, 0 extra fixed