linkAnchor reach accepts Infinity (A+B): fixed 9b84f727b6
linkTargetAt's segment tolerance grows past `reachPx` under a non-uniform view scale (A): fixed fcf029b327. Anchors are now measured in screen px too, so both tests read `reachPx` the same way.
handleSnapSource throws when `angleStep` is NaN or ±Infinity (A): fixed a63fab08c4
`@weasel-js/path-tools/groups` omits the `constraints` group (A): fixed fd3fea1970
addExtremeAnchors replaces the anchor selection even when the commit is refused (B): fixed 157af9a924
girth.drag's reach accepts Infinity (B): fixed 2e804f9a6b

Extra:
groups omits `nudgeAnchors` (anchorNudge) and `text` (createOutlines), the same gap as `constraints` (sweep): fixed fd3fea1970. These went in the same commit as the `constraints` fix, with a new `groups.test.ts` that requires every preset action's group to be named by path-tools' or editing's groups.
Not fixed, outside this area: `sand.ts` `reachOf`/tolerance takes Infinity through a `typeof === 'number' && > 0` check, the same mistake as the reach findings (packages/path-tools/src/sand/sand.ts:56,61).

Checks:
- `npx vitest run --maxWorkers=1`: constraintLinks.test.tsx 13 passed; linkAnchor.test.ts 2 passed; addExtremes.test.ts 5 passed; useGirthTool.test.tsx 21 passed; groups.test.ts 1 passed; handleSnap.test.ts 10 passed; anchorEditing.test.ts 26 passed. No browser tests touched.
- `npm run checks:gate`: "checks:gate: all 33 passed". It first failed on three changeset titles longer than 140 characters; I shortened them and folded the fix into each changeset's own commit.
- `npm run check:changesets`: "OK — 142 changeset(s)."
- `npm run lint -w @weasel-js/path-tools`: fail, `Missing script: "lint"` (the package has no lint script). `npx eslint` on every changed file: exit 0.
- Tree clean apart from `.skulkr/`.

tally: 7 of 7 fixed, 1 extra fixed