## watchRecovery replays a change whose file event is still on its way, so one save is pushed twice and logged as missed
- where: packages/forge/src/vite/watchRecovery.ts:107 (sweep) and :146 (weaselWatchRecovery middleware)
- scenario: forge's own `config` hook gives every non-macOS server `awaitWriteFinish` (watchSettle.ts), so chokidar holds a `change` back until the file has been still for 50 ms. A save landing within that window before a sweep tick (watcher quiet ≥ `quietMs`), or a request for the module arriving in it (a reload right after saving), sees `mtime !== stamp` and calls `recover`: it logs "changed with no file event" and emits `change`. Then the real event arrives and vite and forge's `watchSources` handle the same edit a second time (second HMR update, second reindex). Neither path checks whether an event could still be pending; should leave a change younger than the watcher's settle delay to the watcher.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/watchRecovery.ts
- size: function
- cause: no grace period for in-flight events
- confidence: likely

## Two `packageNameOf` lookups answer the same question differently
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: typedoc/index.ts defines its own private `packageNameOf(dir)` (returns undefined, no upper bound, no `existsSync`), while packageName.ts exports `packageNameOf(file, top)` (returns null, bounded by `top`) used by apiTable.ts and history.ts. Same decision, two implementations that already differ in signature (dir vs file) and bound; a fix to one (e.g. stopping at the repo) won't reach the other.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: line
- cause: duplicated helper
- confidence: sure

## A class component's props never get TypeDoc's docs
- where: packages/forge/src/vite/typedoc/index.ts:117 (propsTypeOf)
- scenario: `exportIn` accepts `Kind.Class` exports, but `propsTypeOf` reads only `signatures[0].parameters[0].type ?? type`; a TypeDoc class reflection has neither (its props are in `extendedTypes`, `Component<Props>`). So for `class Panel extends React.Component<PanelProps>` `collect` gets undefined, `props` is empty, and every prop row keeps only the live reader's text: no `{@link}`-resolved descriptions, deprecations or inheritedFrom, though the class is matched (its `href` is applied).
- evidence: read
- severity: low
- size: function
- cause: class reflection shape not handled
- confidence: likely

## A default-exported interface prints as `default interface …`
- where: packages/forge/src/vite/typeDefs.ts:69 (addTypeDef)
- scenario: the printed declaration is stripped by `/^(export\s+)?(declare\s+)?/`. For `export default interface Options { … }` (found in its own file's scope, or through an aliased default import) the printed text starts `export default interface`, and the strip leaves `default interface Options { … }` as the API panel's type definition.
- evidence: read
- severity: low
- size: line
- cause: regex misses `default` modifier
- confidence: likely

## fileEventsArrive leaks the watcher when the watch reports during its own start
- where: packages/forge/src/vite/watchProbe.ts:74 (fileEventsArrive)
- scenario: `stop = watch(dir, () => settle(...))`: if the `WatchDir` calls `onEvent` before returning (a custom `watch` option replaying a queued event, or one wrapping a synchronous emitter), `settle` runs while `stop` is still undefined, so `stop?.()` does nothing and the directory is removed; then `stop` is assigned and never called, leaving the watcher open on a deleted directory.
- evidence: read
- severity: low
- size: line
- cause: stop handle assigned after first possible callback
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

<!-- done: 5 findings, files read: 26 -->
