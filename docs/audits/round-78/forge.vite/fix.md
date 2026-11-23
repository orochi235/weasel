watchRecovery `quietMs` of 0 or below runs a ~1 ms stat loop (A): fixed 478fe0cc6a. It now throws a `RangeError`; I recorded that call in `docs/unruled.md`.

A story file that an edit breaks keeps its old entries (A+B): fixed a4112116b6

`infer` printed without `infer` (A): fixed c681e3117f

Mapped types lose their `readonly`/`?` modifiers and `as` clause (A): fixed 77aca76ce6

`watchProbe()` beside `forge()` probes twice and warns twice (A+B): fixed c6add2fac9

A local class exported by name is indexed as a story, and a destructured local is read as a global (A+B): fixed 5f2baa5f16. That commit also covers enums.

`forgeTest` never transforms story files outside the vite root (A): fixed 4d52a8291c. forge and forgeTest now share one `isStoryFile` check.

The issues endpoint turns a `gh` answer that isn't an array into a 500 (A): fixed 87d19dedae

TypeDoc lookup by path suffix takes another package's same-named export (A): fixed e44a56d1a1. When paths tie, the export in the file's own package wins; if no export is in that package, no docs are shown. I recorded that call in `docs/unruled.md`.

Deleting a file leaves stale cached import resolutions in the component graph (B): fixed ca6517d5b6

Capture over a link-local IPv6 address builds a URL that can't be parsed (B): fixed 4ea2a34861. The page now loads over the `[::1]` loopback.

Extra (sweep): signatures dropped type-parameter constraints and defaults: fixed 5740c70368

Extra (sweep): object types dropped `readonly` on members: fixed 415f2b125b

Extra: three of my changeset titles were over the 140-character cap: shortened in bf0a166479

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: watchRecovery 6/6 pass, storyIndex 3/3 pass, typedoc/typedoc 19/19 pass, watchProbe 12/12 pass, plugin 30/30 pass, indexFile 45/45 pass, forgeTest 13/13 pass, issues/endpoint 8/8 pass, capture/endpoint 14/14 pass, componentGraph 8/8 pass. Also passing, with no changes to them: indexFile.pbt, indexStory, shellTitle, foreignStories, folderTitles and apiTable.
- `npm run checks:gate`: "checks:gate: all 33 passed". The only commit after that run changed changeset text, and `check:changesets` passed on it.
- `npm run lint -w @weasel-js/forge`: forge has no lint script (its scripts are only `build` and `test`). eslint on every changed `.ts` file: exit 0.
- `npm run check:changesets`: OK, with no warnings on forge changesets.
- Tree is clean apart from `.skulkr/`.

tally: 11 of 11 fixed, 2 extra fixed