## TypeDoc prop docs take the first declaration seen, so a prop redeclared after `Omit<Base, 'x'>` shows Base's comment
- where: packages/forge/src/vite/typedoc/index.ts:141 (collect)
- scenario: `type Props = Omit<ButtonProps, 'onClick'> & { /** Fires with the row id. */ onClick(id: string): void }`. The intersection's first part is `Omit`, a reference outside the project, so `collect` walks its type arguments into `ButtonProps` and stores `ButtonProps.onClick` under `onClick`; the later reflection's own `onClick` is skipped by `!props.has(child.name)`. The API panel shows ButtonProps' description, deprecation, default and `inheritedFrom` for a prop the component redeclared. `Omit`/`Pick`'s key argument is ignored, so omitted keys are collected too, and first-wins lets them shadow the real declaration.
- evidence: read
- severity: medium
- fix: packages/forge/src/vite/typedoc/index.ts
- size: function
- cause: first-wins merge, Omit keys ignored
- confidence: likely

## `packageNameOf` is written twice, answering "which package owns this file" two ways
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: typedoc/index.ts keeps a private `packageNameOf(dir)` returning `undefined`, while packageName.ts exports `packageNameOf(file, top)` returning `null` and bounded by `top`, used by apiTable.ts and history.ts. The two walk and fail differently (one existsSync then parse, one parse-or-skip; one stops at `top`), so a fix to one, such as the prefix bug below, will not reach TypeDoc's lookup of which module a component belongs to.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: line
- cause: duplicated helper
- confidence: sure

## `packageNameOf` bounds the climb with a bare string prefix, so a sibling directory sharing `top`'s prefix counts as inside it
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: `top = '/work/repo'` and `file = '/work/repo-old/pkg/a.ts'` (a `../repo-old/...` path from history.ts's `resolve(top, path)`). `dir.startsWith(top)` holds for `/work/repo-old/pkg` and `/work/repo-old`, so manifests outside `top` are read and their name returned. It should require `dir === top` or `dir.startsWith(top + sep)`.
- evidence: read
- severity: low
- size: line
- cause: prefix check without separator
- confidence: likely

## Story files added outside the vite root are never indexed, because only the files that already exist are watched
- where: packages/forge/src/vite/plugin.ts:73 (watchSources)
- scenario: `stories: ['../../packages/*/src/**/*.stories.tsx']` from `apps/workshop`. `server.watcher.add([...files])` adds the story files present at startup, and chokidar reports only those paths. A new `Foo.stories.tsx` created in that tree outside the root never fires `add`, so `stories.update` never runs and the story stays out of the index until the server restarts. Watching the globs' base directories, or the globs themselves, would report new files.
- evidence: read
- severity: low
- size: function
- cause: watches files, not globs
- confidence: likely

## `watchRecovery`'s URL-to-file map is never pruned
- where: packages/forge/src/vite/watchRecovery.ts:165 (transform handler)
- scenario: every module served adds `fileOfUrl.set(url, file)`. An `unlink` deletes the file's `stamps` entry but not its URLs, so a long dev session spent renaming or generating files grows the map without bound, and a stale URL still maps to a deleted file (`missed` then returns false, so it does no harm beyond the leak).
- evidence: read
- severity: low
- size: line
- cause: unlink skips fileOfUrl
- confidence: sure

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

<!-- done: 5 findings, files read: 26 -->
