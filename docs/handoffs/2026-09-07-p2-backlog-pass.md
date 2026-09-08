# Second pass through `docs/TODO.md` — the P2s

**State at hand-off:** `main`, working tree clean, **16 commits unpushed** and
no push approved. `git log --oneline @{u}..HEAD` lists them. The first three are
the earlier overnight pass; the rest are this one.

The task was "remove the accent ramp and anything else mentioning contrast
ratio, then work through the p2s". Eight P2 entries are closed and retired;
roughly three dozen remain. Pick the next from `docs/TODO.md` — its
"High-priority index" is a hand-maintained copy of claims further down, so fix
both or fix neither.

## Verified on the tree as it stands

`tsc --noEmit`, `npm run lint`, `npm run lint -w @weasel-js/labkit`, `npm test`
(865 files, 9479 passed, 0 failed), `npm run test:stories` (337 passed),
`npm run build`, `npm run build -w @weasel-js/labkit`, `check:bumps`,
`check:manifests`, `check:frame-loops`, `check:test-projects`,
`test:smoke:consumer`. All green.

The visual suite was not run. Two changes could move a `<canvas>` baseline —
shared layer effect passes and nullable text fill — and both were checked in a
browser by the agents that wrote them rather than against the committed
baselines.

## Decisions here that are not in the code

**The contrast entries were deleted, not fixed.** Mike asked for the accent ramp
and every contrast-ratio entry off the backlog; the measurements went with them,
and the two handoffs that cited them were corrected. One contrast line survives
in `docs/superpowers/specs/2026-08-25-labkit-visual-language-design.md` — it
records work that shipped, so it is not a backlog item. Removing it is a
one-line change if he wants it gone too.

**A multi-select layout drop places children one at a time.** One container is
chosen from the selection's union center and every member must clear
`acceptsDrop`; a grouped `commitDrop(container, children, dragged[])` was
rejected because it breaks every existing strategy to express what threading the
child list already gives them. Same-container multi-select *reorder* runs the
new path but has no test asserting what it means — `tileGrid` derives cell
occupancy from a sorted-id index rather than from poses.

**`kit:text` still reports `filled: true` under `data.fill: null`.** A text
node's silhouette is its line boxes, not its glyph ink, so reporting it unfilled
makes a word grabbable near the box edge and not near the letters.

**labkit now peers `@weasel-js/core` exactly, which is breaking for consumers** —
they install core alongside it. `package-lock.json` was hand-edited (two lines,
mirroring `packages/svg`'s peer shape) because the lock is stale on `main` at
`1.4.0-pre.0` while the manifests are at `1.4.2`, and `npm install
--package-lock-only` would have rewritten every workspace entry.

**React Aria's unstable portal key is quarantined to two modules.** The overlay
work spread `UNSTABLE_portalContainer` across five components and tripped the
containment guard; `portalHost.tsx` now owns the spelling and the guard reads a
two-entry list.

## Traps this pass hit

**A subagent will open a visible Chrome unless the prompt forbids it.** Agents
do not inherit the headless rule, and three automation browsers were left
running — one of them non-headless, on Mike's screen. Every dispatch needs an
explicit no-browser clause, and `ps -ax | grep "MacOS/Google Chrome "` is worth
a sweep before finishing. The bare `Google Chrome` with no flags is his.

**Concurrent agents in one checkout interleave in shared files.** Two of them
edited `packages/core/src/canvas/Canvas.tsx` at once, and separating the commits
meant splitting the diff by hunk and staging with `git apply --cached`. Either
give agents disjoint file sets or expect to do that.
