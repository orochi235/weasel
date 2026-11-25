Inherited props from a skipped workspace package were named by file basename, not package (A): fixed 6d856e6253

Capture guard missed redirects from allowlisted origins (A): fixed d521de5c34. Playwright's own source shows that a redirected request skips the route handler, whether the first response was continued or fulfilled as a 3xx. So allowlisted requests are now always fetched from Node, on http and https alike. Each redirect hop has its origin checked, with at most 5 hops. Redirects from the server's own origin are still continued without a check, on purpose: that server can already proxy anything for the page. This is noted in `guard`'s doc comment.

In middleware mode, `hmrSocketOf` named the page's port and not vite's 24678 (A): fixed 3e0878c05b. Checked against vite 8.3.8's `createClientConfigValueReplacer`. The same fix also reads `server.ws`, which vite 8 uses in place of the deprecated `server.hmr.*` options. Four endpoint tests that run under middleware mode now expect 24678.

`reset()` did not stop a running rebuild, which then pushed the old root's graph (A): fixed 767e320b54

A later getter or method of the same key did not override an earlier property in `prop` (A): fixed 7504f7c91c

`git name-rev` command line could exceed the Windows limit (A): fixed 54991c1780. Commits are now deduplicated and named 500 per call.

`refOf` listed every DOM member for a ref holding `HTMLDivElement & {…}` (B): fixed d1d0cb64a7

`autoTitle` kept a `.` segment for a file outside the root that no glob matches (B): fixed bf8739f2a4. Such a file is now titled by its path with `.` and `..` segments dropped, e.g. `x/Foo`.

Extra: history.ts and apiTable.ts each had their own `packageOf`. They now share one, `packageName.ts`, folded in as part of 6d856e6253, not counted as an extra defect.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: apiTable pass (28), autoTitle pass (27), depsFeed pass (1, new file), history pass (10), indexFile pass (55), capture/browser pass (24), capture/endpoint pass (18). Each new test was also seen failing against the unfixed source.
- `npm run checks:gate`: pass, all 33. It ran before I shortened four changeset titles; `check:changesets` passed again after that edit.
- `npm run check:changesets`: pass. None of my changesets has a warning.
- `npm run lint -w @weasel-js/forge`: forge has no `lint` script. The root `npm run lint` passed inside the gate.

tally: 8 of 8 fixed, 0 extra fixed