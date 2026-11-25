## A native story file that imports forge as a namespace is indexed as CSF
- where: packages/forge/src/vite/indexFile.ts:94 (scan), packages/forge/src/vite/indexFile.ts:142 (indexProgram `native`), packages/forge/src/vite/ast.ts:73 (calleeOf)
- scenario: `import * as forge from '@weasel-js/forge'; export default forge.meta({ title: 'X' }); export const helper = 3; export const A = forge.story({ viewport: { width: 400, height: 300 } });`. `scan` records a wrapper only for an `ImportSpecifier` named `meta`/`story`, and `calleeOf` returns undefined for a member callee, so `native` is false: `helper` is indexed as a story (the `mayBeStory` filter is skipped), and `A`'s `viewport` is dropped (read only when `native`). `foreignCallees` also skips the namespace import, so the wrapper resolver cannot recover it. Should be recognized as a native meta, the way the runtime brand would be.
- evidence: read (inference that the runtime loader accepts the namespace form; it reads the brand, not the import shape)
- severity: medium

## Component reach counts a shadowing local or parameter as a use of a same-named component
- where: packages/forge/src/vite/moduleInfo.ts:104 (namesIn), packages/forge/src/vite/componentReach.ts:46 (localsOf)
- scenario: one file declares components `Button` and `Toolbar`, and `Toolbar` is `function Toolbar({ Button }) { return <Button/> }` or has `const Button = styled.button\`…\`` inside. `namesIn` adds every `Identifier`, binding positions included (parameters, inner declarators, catch params, labels), with no scope, so `refs.get('Toolbar')` holds `Button`; `localsOf` then finds `file#Button` in `byKey` and the graph says Toolbar uses Button, and Button is usedBy Toolbar, though Toolbar never touches the top-level Button. Should count only free references.
- evidence: read
- severity: low

## moduleInfo drops `export enum`, `export * as ns from` and destructured `export const`, which ast.bindingsOf reads
- where: packages/forge/src/vite/moduleInfo.ts:36 (declareStatement), packages/forge/src/vite/moduleInfo.ts:66 (ExportNamedDeclaration loop)
- scenario: a barrel `export * as Icons from './icons'`, or `export const { meta, story } = kit`: `declareStatement` handles only function/class/identifier variables and the specifier loop skips `ExportNamespaceSpecifier`, so `exports` has no `Icons`/`meta`/`story`. `trace.declaring` and `bindings.declaring` then fall through to `stars` and answer null: a story's component re-exported that way gets `source: null` in the dependency graph, and a forge `meta` re-exported that way is not recognized as a wrapper. `ast.bindingsOf` records destructured locals and enums for the same files, so the two readers disagree on what a module declares.
- evidence: read
- severity: low

## A duplicate story id within one file is reported as two files and told to retitle one
- where: packages/forge/src/vite/titleReport.ts:7 (sharedIds), packages/forge/src/vite/titleReport.ts:16 (warnShared)
- scenario: one file exports `Primary` and `primary` (or `Big_Button` and `BigButton`), which `storyId` sanitizes to one id. `sharedIds` pushes the file once per entry, so the warning reads "story id x--primary is declared by a.stories.tsx, a.stories.tsx; … or retitle one file", and retitling cannot fix it. The second story disappears from the workshop. Should dedupe the files and, for one file, say to rename an export.
- evidence: read
- severity: low

## watchRecovery's `read` map keeps an entry for every load whose transform never runs
- where: packages/forge/src/vite/watchRecovery.ts:126 (load handler), packages/forge/src/vite/watchRecovery.ts:136 (transform handler)
- scenario: the pre `load` hook records `read.set(id, mtime)` for every client module, before any other plugin's `load`. When a later `load` throws (a syntax error in a plugin-loaded file, a missing file), the transform hooks never run for that id, so the entry is never deleted. Each failed load of a new id (query variants included) adds one that lives as long as the server. The map is also read by the transform of any environment, so a non-client transform of the same id consumes the client's stamp first. Should be set and consumed in one place, or cleared on failure.
- evidence: read
- severity: low

## Files read
packages/forge/src/vite/apiTable.ts
packages/forge/src/vite/ast.ts
packages/forge/src/vite/autoTitle.ts
packages/forge/src/vite/bindings.ts
packages/forge/src/vite/build.ts
packages/forge/src/vite/capture/browser.ts
packages/forge/src/vite/capture/cache.ts
packages/forge/src/vite/capture/endpoint.ts
packages/forge/src/vite/capture/entries.ts
packages/forge/src/vite/capture/payload.ts
packages/forge/src/vite/componentGraph.ts
packages/forge/src/vite/componentOf.ts
packages/forge/src/vite/componentReach.ts
packages/forge/src/vite/depsFeed.ts
packages/forge/src/vite/entries.ts
packages/forge/src/vite/folderTitles.ts
packages/forge/src/vite/foreignStories.ts
packages/forge/src/vite/forgeTest.ts
packages/forge/src/vite/history.ts
packages/forge/src/vite/html.ts
packages/forge/src/vite/index.ts
packages/forge/src/vite/indexFile.ts
packages/forge/src/vite/indexStory.ts
packages/forge/src/vite/isolateReport.ts
packages/forge/src/vite/issues/answer.ts
packages/forge/src/vite/issues/endpoint.ts
packages/forge/src/vite/moduleInfo.ts
packages/forge/src/vite/nativeExports.ts
packages/forge/src/vite/ownEntries.ts
packages/forge/src/vite/ownKeys.ts
packages/forge/src/vite/plugin.ts
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

<!-- done: 5 findings, files read: 50 -->
