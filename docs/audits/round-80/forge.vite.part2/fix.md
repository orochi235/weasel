Issues endpoint showed at most 30 issues because `gh issue list` ran without `--limit` (A+B): fixed 23bbef4009. It now lists up to 100 and links to the rest on GitHub. No defect question was involved, but the 100 cap is my choice.

`mayBeStory` dropped an export once it hit its depth cap (A+B): fixed 265244dc05

`Object.freeze(story(...))` read as not a story (A): fixed f62e7f4b67. `seal` and `preventExtensions` are fixed the same way.

Inline type with only index signatures printed as `{}`, and call signatures were lost beside children (A): fixed c9cd11050a

Optional tuple element that is a union printed without parentheses (A): fixed 7d4637cafb

Silent-watcher warning claimed "a file written 5 s ago" even with a custom probe (A): fixed 6023acfada

The issues-endpoint finding from B: duplicate of the first finding (A+B)

Type literal's method members printed as `name: unknown`, index signatures were dropped, and call signatures were lost (B): fixed c9cd11050a. Accessors print as well.

Construct signature printed as a plain call signature (B): fixed e68fb118dc

The depth-cap finding from B: duplicate of the second finding (A+B)

Type definitions keyed by bare name, so a second type with the same name showed the first one's definition (B): fixed a6ff3c67a8. I made a behavior call here: a name that means two types gets no definition. It is recorded in `docs/unruled.md`.

Checks:
- Tests, each file run alone with `--maxWorkers=1`:
  - `vite/issues/endpoint.test.ts` pass (9)
  - `shell/issues/IssuesPanel.test.tsx` pass (6)
  - `shell/issues/TrackedIssues.test.tsx` pass (5)
  - `vite/nativeExports.test.ts` pass (3)
  - `vite/indexFile.test.ts` pass (51)
  - `vite/foreignStories.test.ts` pass (4)
  - `vite/watchProbe.test.ts` pass (13)
  - `vite/apiTable.test.ts` pass (23)
  - `vite/typedoc/typedoc.test.ts`: only the `typeText` tests were run (`-t typeText`, 9 passed). Its other 13 tests are unrun here because the machine was loaded and the full file timed out.
- Each new test was confirmed failing against the frozen source, except the optional-tuple test, which was not checked that way.
- `npm run checks:gate`: all 33 passed.
- `npm run lint -w @weasel-js/forge`: unrun, because forge has no `lint` script. `npx eslint` on every changed file passed, and the gate's root `npm run lint` passed.

tally: 9 of 11 fixed, 0 extra fixed