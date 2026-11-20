Held routes go stale after undo, redo, replay, `loadState` or an untracked write (A+B): fixed b34f6924a4

Drag follower ignores ends with a derived pose, though the commit pass counts them (A+B): fixed 69163c43b4 and 8b0d0f0dd6-follow-up below. The pass and the follower now share one test, `reroutedBy`. It follows a derived end's `dependsOn` to the nodes that move; the pass used to count every derived end as moved.

Drag follower keeps hops on a connector an earlier follower rerouted, such as avoid routing (B): fixed cc8052e2dd

Follower overwrites the pose the frame or an earlier follower previewed with the stored pose (B): fixed 884ef66a59

Hidden connectors, and connectors on hidden layers, still make the connectors above them hop (B): fixed 7733ab706f

A collinear vertex in a route suppresses crossings within `r` of it (A): fixed c3785af2ba. `edgeHops` and `withHops` both work on the route with straight-through vertices dropped.

Rounding can make a hop at the clearance limit fail to draw (B): fixed 612ad567a2. `withHops` allows 0.01 of slack.

Extra defects found while fixing:

- `createSpecHops` also made edges hop over hidden edge specs (sweep): fixed 8cd35da9bf
- `dependsOn: 'children'` (a container that fits its children, A's example) would have thrown in `reroutedBy` (sweep, caught by typecheck): fixed in the commit after 8cd35da9bf ("follow a children-derived end to its children…")
- Six changeset titles were over 140 characters: fixed in the last commit, "shorten the titles of six line-jump changesets"

Checks:

- `npx vitest run --maxWorkers=1`, one file at a time:
  - `hops.scene.test.ts`: pass (18)
  - `crossings.test.ts`: pass (9)
  - `draw.test.ts`: pass (10)
  - `specHops.test.ts`: pass (5)
  - `hopsAction.test.ts`: pass (1)
- `hops.browser.test.tsx`: unrun (browser test), and not touched.
- `npm run checks:gate`: pass (exit 0). The first run failed on typecheck (`dependsOn: 'children'`) and changeset title length; both were fixed and the rerun passed.
- `npm run check:changesets`: pass
- `npm run check:size`: pass
- `npm run lint -w @weasel-js/diagram`: not run, because the package has no `lint` script ("Missing script: lint"). I ran `npx eslint` on every changed `.ts` file instead: pass (exit 0).
- The tree is clean, and `.skulk/` is untouched.