Fixed 3811cbf6d9 and the rest are below. The shas changed when I folded follow-ups into their commits, so these are the final ones:

- Parameter default treated as shadowed by the body's `var` (A): fixed 3811cbf6d9 — defaults are now read in a scope that holds only the parameters.
- `componentOf`'s `assigned` ignores spreads (A): fixed (`git log --oneline -1 -- .changeset/forge-api-meta-spread.md`) — it now follows a later spread to the `component` that spread assigns, the same way `ast.prop` does. It also reads a computed literal key.
- `module()` stores a graph built for the old root after `reset()` (A): fixed — it builds again when the generation changed while it was building.
- `componentReach` decides "outside the home directory" by a string prefix (A): fixed — it now checks for an absolute path, or a first path segment of `..`.
- ast `lookup` lets an earlier key win over a later computed key (A): fixed 93862912fc — a computed literal or expression-free template key now reads as a plain key. A computed key it can't read is taken to set nothing, the same rule already documented for unreadable spreads. I did not make it stop the lookup.
- Capture page's protocol comes from `server.https`, which middleware mode doesn't set (A): fixed — the protocol is now read from each request's socket (`encrypted`).
- `repoOf` drops a URL remote's port (A): fixed — an HTTP(S) port is kept unless it is the default, and an SSH or git port is dropped. An `http` remote also keeps `http` in its page URL.
- `freeNames` counts intrinsic and namespaced JSX tags as references (B): fixed 930f476888 — lowercase, dashed and namespaced tag names are no longer references. A member-tag root such as `ui` in `<ui.Panel>` still is.
- Graph and API table disagree on a dotted `component` off a named import (B): fixed — `Tabs.Panel` now keys to the top-level `Panel` that `Tabs`'s file declares or imports. When that file has none, it resolves to null (no source) instead of `Tabs`.
- History cache ignores release tags added after HEAD was read (B): fixed — the cache key is now `git rev-parse HEAD --tags`.

Shas for the rest, newest first: 4218cda8c5 history tags, 650ecacfec remote port, 742254dd4b capture protocol, 1ded85e28f deps.js reset, a587877e1d helper directory check, faa822569b named-import member, 7fdd8e7473 meta spread.

Each fix has its own changeset and a test that failed before the fix.

Checks:
- vitest, run one file at a time with `--maxWorkers=1`: freeNames 4 passed, indexFile 56 passed, apiTable 30 passed, componentGraph 11 passed, depsFeed 2 passed, capture/endpoint 19 passed, issues/endpoint 10 passed, history 11 passed, history.pbt 2 passed, bindings 1 passed.
- `npm run checks:gate`: "checks:gate: all 33 passed". The first run failed one TS6133 (an unused parameter in `componentOf.ts`); I fixed that into its commit and the rerun passed.
- `npm run lint -w @weasel-js/forge`: not run. forge has no `lint` script ("Missing script: lint"). I ran eslint on every changed `.ts` file instead: pass.
- `npm run check:changesets`: OK, none of the new changesets warns.
- Tree is clean, and nothing under `.skulkr/` is committed.

tally: 10 of 10 fixed, 0 extra fixed