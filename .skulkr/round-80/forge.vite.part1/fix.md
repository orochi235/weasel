- Component picked differently by the props table and the graph (A, and B's `assigned` finding overlaps it): fixed 6438f99868 for `component: Tabs.Panel`. The index now records `Tabs.Panel` as the component name, and the graph follows a namespace import to the `Panel` export, so it names the same component as the API table. The other half, a wrapper declared in the story file, is not a defect: its props are what the story's args drive, `apiTable.test.ts` asserts it ("reads the title's import, not a wrapper…"), and the graph only records imported declarations.
- `let`/`var` read as constants (A): fixed 8c0d6da3e4. A top-level `let` or `var` that the file assigns to anywhere is now a binding whose value nothing reads.
- Capture size check ignores rounding (A): fixed 540f866f6b
- Origin check rejects a page on a default port (A): fixed 14f8135f27
- `freeNames` skips method decorators (A+B): fixed eef20aaeb7, parameter decorators included
- `folderTitleReport` passes silently on backslash paths (A): fixed 55a626f955. It now uses one `posixRelative` helper, and the copies in `autoTitle`, `storyGlob` and `componentGraph` were folded into it. No changeset, since the report only feeds a repo script.
- Empty meta `title` kept instead of the auto-title (B): fixed b65de2ce9f. The `indexFile.pbt` oracle now hands the loader the indexed title, as `indexBundle` does at runtime.
- HMR socket guard closes vite's own socket when HMR is on another port or host (B): fixed 83c1f341e6. The endpoint works out where vite's client connects from `server.hmr` (`hmrSocketOf`) and lets that socket through.
- `import.meta` / `new.target` counted as references to locals (B): fixed b7f718a945
- `freeNames` skips class method decorators (B): duplicate of A's method-decorator finding
- Inherited prop counts merge same-named types from two packages (B): fixed 34112dfb87. Each package gets its own row, labeled `DomProps (@types/react)` only when two packages share the name.
- Destructured default under a string-literal key dropped (B): fixed 11a585797f. Numeric keys are read too.
- `assigned` misses a quoted key, `<Meta>`, or `!` (B): fixed b53b725fcb. It also takes the last `component` property, as the object evaluates.

No extra defects.

Checks:
- Each touched test file run with `npx vitest run --maxWorkers=1`: freeNames, posixPath, folderTitles, autoTitle, componentGraph, capture/payload, capture/browser, capture/endpoint, indexFile, indexFile.pbt and apiTable all pass. plugin, shellTitle, nativeExports, foreignStories, propTypes and propControls also pass, 65/65 in one run.
- `npm run checks:gate`: "checks:gate: all 33 passed". The first run failed typecheck (`findLast`) and check:proto-index (`DEFAULT_PORTS[...]`); both were fixed into their commits.
- `npm run lint -w @weasel-js/forge`: forge has no `lint` script. eslint on every changed forge file passes with no output.
- The tree is clean.

tally: 13 of 13 fixed, 0 extra fixed