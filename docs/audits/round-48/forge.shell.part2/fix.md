- Issues panel is blank on a component's index page (A): fixed ce4aa32e45
- Each open story of a file loads and prepares the whole file again and replaces its siblings' loaded stories (A): fixed de22ae517c (changeset title shortened in 5e5f36380b)
- Issues section is empty for a trial showing an index page (B): duplicate of the first A finding (index page / Issues panel)
- Focusing a second trial of the routed story writes the first trial's URL params over its knobs (B): fixed deab0913e8
- Story hosts table keeps a ref for every trial id it has ever seen (B): fixed 3cd41496b8. The ref for a trial is now dropped when its host detaches. Each ref reads the host map live, so a ref someone still holds keeps giving the right answer. No changeset, since a consumer can't see the change.
- mountWorkshop silently replaces the caller's `changes` and `revision` (B): fixed d4e12d3adb (changeset title shortened in 5e5f36380b). It now uses the caller's `changes`, and counts the caller's `revision` together with its own, which `revise()` bumps.
- Two folders at the same path in the sidebar open and close together (B): fixed edd73fb54c. In the Components view, a folder's fold is now stored by library plus path, the same way its row id is built. A reveal opens the folders actually above the target and scrolls to the right row. The split that brought StoryTree back under the function size cap is in 25dc1f64bf.

No extra defects found. Nothing went into `docs/unruled.md`.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: issuesSection.test.tsx pass (2), routeKnobs.test.tsx pass (10), storyHosts.test.ts pass (3), mountWorkshop.test.tsx pass (3), tree/StoryTree.test.tsx pass (42), tree/buildComponents.test.ts pass (20), tree/buildComponents.pbt.test.ts pass (4), storyLoads.test.tsx pass (2). Also run after the changes: useStoryRegistry.test.tsx pass (8), useStoryRegistry.document.test.tsx pass (13), storyInstrument.test.tsx pass (38), Workshop.test.tsx pass (16), followEdits.test.ts pass (2), storyMarks.test.tsx pass (12), tree/buildTree.test.ts pass (11)
- No `*.browser.test.*` file was touched, so none are left unrun.
- `npm run check:changesets`: pass ("OK — 2235 changeset(s)")
- `npm run checks:gate`: pass ("all 32 passed"). The first run failed on `check:size` (StoryTree.tsx's longest function was 126 lines); 25dc1f64bf fixed that.
- `npm run lint -w @weasel-js/forge`: fail, because forge has no `lint` script ("Missing script"). Root `npm run lint` passed inside the gate, and eslint on every changed forge file passed.
- Working tree is clean.

tally: 6 of 7 fixed, 0 extra fixed