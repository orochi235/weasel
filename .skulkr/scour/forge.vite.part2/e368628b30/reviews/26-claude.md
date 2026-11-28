# forge.vite.part2 findings

## A helper's parameters and inner locals are read as top-level bindings or globals, so a real story can be dropped
- where: packages/forge/src/vite/nativeExports.ts:114 (mayBeStory, Identifier and CallExpression cases; isGlobal at :70)
- scenario: `mayReturnStory` reads a function's body against the file's top-level `Scope`. A name bound by a parameter or an inner `const` is looked up in `scope.bindings` (top-level only). If the name shadows a top-level literal, the literal answers. Example: `const base = { args: {} }; const pick = (base) => base; export const Primary = pick(story({...}))`. Here `mayCallStory(pick)` reads `base` as the top-level literal and returns false, so a real story export is judged "not a story" and dropped. A parameter that shadows nothing is read as a global by `isGlobal`, because it is in neither `bindings` nor `imports`. So `const first = (list) => list.at(0); export const P = first([story({...})])` reads `list.at(0)` as "a method of a global" and returns false. Wanted: a name the function binds itself should stay unknown, which this function treats as "may be a story".
- evidence: read
- severity: low
- fix: packages/forge/src/vite/nativeExports.ts
- size: function
- cause: function-local scope not modeled; top-level bindings used inside bodies
- confidence: likely

## typedoc/index.ts keeps its own copy of packageNameOf beside packageName.ts
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: `exportIn` decides "which package is this file in" with a private walk up the tree. `packages/forge/src/vite/packageName.ts` answers the same question for `apiTable.ts` and `history.ts`. The two copies already differ: the typedoc one has no `top` bound and returns `undefined` rather than `null`, and the next fix to one will not reach the other. Wanted: a single definition, which `exportIn` calls as `packageNameOf(file) ?? undefined`.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts
- size: function
- cause: duplicated decision
- confidence: sure

## An accessor member of a ref handle loses its TypeDoc description
- where: packages/forge/src/vite/typedoc/index.ts:203 (memberDocs)
- scenario: A ref handle class or interface declares `/** The current zoom. */ get zoom(): number`. TypeDoc's JSON puts an accessor's comment on its `getSignature`/`setSignature`, not on the member reflection. `memberDocs` reads `member.comment ?? signatures[0]?.comment`, and `signatures` is empty for anything but `Kind.Method`. So the API panel shows no description, deprecation or default for that member, while a plain property gets them. Wanted: fall back to `member.getSignature?.comment ?? member.setSignature?.comment`.
- evidence: read
- severity: low
- size: line
- cause: accessor comment location not read
- confidence: likely

## fileEventsArrive never stops a watcher that reports while it is still being started
- where: packages/forge/src/vite/watchProbe.ts:71 (fileEventsArrive)
- scenario: `stop` is assigned only after `watch(dir, onEvent)` returns. A `WatchDir` that calls `onEvent` synchronously from inside the call runs `settle` while `stop` is still undefined. Examples: one that reports a pending event straight away, or a test fake. `stop?.()` then does nothing, and the watcher it returned is never closed. Wanted: if `settled` is already true when `watch` returns, call the returned stop.
- evidence: read
- severity: low
- size: line
- cause: stop handle assigned after callback may fire
- confidence: likely

## Files read
packages/forge/src/vite/moduleInfo.ts
packages/forge/src/vite/nativeExports.ts
packages/forge/src/vite/ownEntries.ts
packages/forge/src/vite/ownKeys.ts
packages/forge/src/vite/packageName.ts
packages/forge/src/vite/plugin.ts
packages/forge/src/vite/posixPath.ts
packages/forge/src/vite/propControls.ts
packages/forge/src/vite/propTypes.ts
packages/forge/src/vite/servePages.ts
packages/forge/src/vite/shellTitle.ts
packages/forge/src/vite/storyGlob.ts
packages/forge/src/vite/storyIndex.ts
packages/forge/src/vite/storybookShims.ts
packages/forge/src/vite/titleReport.ts
packages/forge/src/vite/trace.ts
packages/forge/src/vite/typeDefs.ts
packages/forge/src/vite/typedoc/index.ts
packages/forge/src/vite/typedoc/json.ts
packages/forge/src/vite/typedoc/print.ts
packages/forge/src/vite/virtualModules.ts
packages/forge/src/vite/warnOnce.ts
packages/forge/src/vite/watchProbe.ts
packages/forge/src/vite/watchRecovery.ts
packages/forge/src/vite/watchSettle.ts
packages/forge/src/vite/wrappers.ts

<!-- done: 4 findings, files read: 26 -->
