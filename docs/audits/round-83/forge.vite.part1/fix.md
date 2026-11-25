forgeTest registered a story file's tests again inside each story file that imports it (A): fixed 3060f93cff

repoOf treated GitLab, Bitbucket and other non-GitHub hosts as GitHub (A): fixed 765dbe8d6e. Known non-GitHub hosts, at their own domains or self-hosted under names like `gitlab.*`, now name no repository. Any other unknown host is still taken for GitHub Enterprise, since there is no way to tell from the URL alone.

componentOf kept only two segments of a dotted `component` (A+B): fixed f219e18da3

fileDates missed paths that git C-quotes (A+B): fixed 3f9eeaf806. Fixed by unquoting git's quoted paths, not by switching to `-z` output.

bindingsOf counted an inner scope's assignment as reassigning a top-level `let` (A): fixed 7ac93cb391

apiTable left the files of the type definitions it prints out of `sources` (B): fixed 522ae89ea9

apiTable left the component's own file, read for destructured defaults, out of `sources` (B): fixed b5f8c9f257

destructuredDefaults found no defaults for `memo(ChipImpl)` (B): fixed 8daebbd7a3. It now follows a local or imported identifier to its function.

parseFile turned on JSX only for `.jsx` and `.tsx`, and TypeScript for plain `.js` (B): fixed 8540466f1e. moduleInfo.ts made the same choice in a second copy; both now use one helper.

passThrough sent the original headers on to a redirect's new origin (B): fixed 063fcb48bb. `Authorization`, `Cookie` and `Proxy-Authorization` are dropped on a hop that changes origin.

Extra: none. The redirect fix also drops `Cookie` and `Proxy-Authorization`, beyond the `Authorization` header the reviewer named.

Checks:
- Each touched test file, run alone with `--maxWorkers=1`: pass. That is apiTable (33), capture/browser (25), componentGraph (12), forgeTest (14), history (12), indexFile (58) and issues/endpoint (11). The related moduleInfo, indexFile.pbt, history.pbt, shellTitle, foreignStories, sourceImports and freeNames tests also pass.
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: pass, "checks:gate: all 33 passed". The first run failed `check:proto-index` on history.ts; I fixed that and folded it into commit 3f9eeaf806.
- `npm run lint -w @weasel-js/forge`: not run, because forge has no `lint` script ("Missing script: lint"). I ran eslint on every changed file instead: pass. The gate's root `npm run lint` also passed.
- `npm run check:changesets`: pass, with none of my changesets warning.
- The tree is clean.

tally: 12 of 12 fixed, 0 extra fixed