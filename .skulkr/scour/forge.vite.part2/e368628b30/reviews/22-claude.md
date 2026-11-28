## packageNameOf finds no package on Windows when `top` comes from git, since `top` is written with `/` and `dirname` with `\`
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: history.ts:128 calls `packageNameOf(resolve(top, path), top)` with `top` from `git rev-parse --show-toplevel`, which prints `C:/repo` on Windows. `resolve` gives `C:\repo\packages\x\src\a.ts`, so `dirname(file).startsWith('C:/repo')` is false on the first test, the loop never runs, and every file is filed under package `null`; per-package release tags (`<name>@[0-9]*`) are never searched. It should compare normalized paths (or a `relative` that does not climb).
- evidence: read
- severity: low
- fix: packages/forge/src/vite/packageName.ts
- size: line
- cause: string prefix test across mixed separators
- confidence: likely

## typedoc/index.ts keeps its own copy of packageNameOf beside packageName.ts
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: two definitions answer "which package is this file in": `packageName.ts` (returns null, bounded by `top`, checks `existsSync`) and the private one here (returns undefined, unbounded). A fix to one (e.g. the separator bug above) does not reach the other; the decision is answered two ways in two places.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: function
- cause: duplicated lookup
- confidence: sure

## A class component found in TypeDoc's JSON yields no props: propsTypeOf reads only signatures or `type`
- where: packages/forge/src/vite/typedoc/index.ts:117 (propsTypeOf), :87 (exportIn)
- scenario: `exportIn` accepts `Kind.Class` exports, but a class reflection has no `signatures` and no `type` (its props are the type argument of `extendedTypes`, `Component<P>`). `propsTypeOf` returns undefined, `collect` adds nothing, and the class component's props and ref members never receive TypeDoc's descriptions, deprecations or `inheritedFrom`, while its page href does. It should read `extendedTypes[0].typeArguments[0]` for a class.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts
- size: function
- cause: class reflections not handled
- confidence: likely

## A prop declared as a method signature gets no TypeDoc docs: entryDocs reads `prop.comment`, which TypeDoc puts on the signature
- where: packages/forge/src/vite/typedoc/index.ts:62 (readTypedoc.component)
- scenario: `interface Props { /** Called with {@link Item}. @deprecated use onPick */ onSelect(id: string): void }` — TypeDoc writes the comment on `signatures[0].comment`. `entryDocs(prop, prop.comment, linker)` passes undefined, so the row loses the resolved `{@link}`, the `@deprecated` and the `@default`. `memberDocs` already falls back to `signatures[0]?.comment` for ref members; props answer the same question differently.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts
- size: line
- cause: missing signature-comment fallback for props
- confidence: likely

## typeText prints a template literal type's text unescaped
- where: packages/forge/src/vite/typedoc/print.ts:38 (typeText, 'templateLiteral')
- scenario: a type `` `a\`b${string}` `` or one whose text holds `${` is printed with the raw backtick / `${`, producing a signature that is not valid TypeScript and misreads in the panel. Head and tail texts should escape `` ` ``, `\` and `${`.
- evidence: read
- severity: low
- fix:
- size: line
- cause: no escaping of template text
- confidence: likely

## addTypeDef leaves `default` in the printed text of an `export default interface`
- where: packages/forge/src/vite/typeDefs.ts:68 (addTypeDef)
- scenario: `export default interface Props { … }` prints as `export default interface Props {…}`; the regex `^(export\s+)?(declare\s+)?` strips only `export `, so the definition shown reads `default interface Props {…}`.
- evidence: read
- severity: low
- fix:
- size: line
- cause: regex omits `default`
- confidence: likely

## addTypeDef prints only the first declaration of a merged interface
- where: packages/forge/src/vite/typeDefs.ts:53 (addTypeDef)
- scenario: an interface declared twice (declaration merging, e.g. a module augmentation in the project) has two `InterfaceDeclaration`s; `find` takes the first and prints it alone, so the definition shown lacks the merged members and `files` omits the second file (an edit there is not watched).
- evidence: read
- severity: low
- fix:
- size: function
- cause: single declaration assumed
- confidence: likely

## watchRecovery's transform hook takes a pending read regardless of environment
- where: packages/forge/src/vite/watchRecovery.ts:156 (transform handler)
- scenario: `load` records a pending read only for the `client` environment, but `transform` calls `read.take(id)` in every environment. When an SSR (or other dev) environment transforms the same id between the client's load and transform, it consumes the client's entry and stamps its own module graph's module; the client module is never stamped and a missed edit to that file is not recovered. The transform should check `this.environment.name === 'client'` before `take`.
- evidence: read
- severity: low
- fix:
- size: line
- cause: environment check only in load
- confidence: likely

## A story added under a glob outside the vite root is never indexed while the server runs
- where: packages/forge/src/vite/plugin.ts:70 (watchSources)
- scenario: with `stories: ['../shared/**/*.stories.tsx']`, `globSync` finds the existing files and `watcher.add` watches exactly those files. vite's watcher covers only the root, so a new `../shared/b.stories.tsx` never fires `add`, and the workshop does not show it until restart. The glob's base directories should be added to the watcher, not only the files found.
- evidence: read
- severity: low
- fix:
- size: function
- cause: watching found files, not the globbed directories
- confidence: likely

## moduleInfo records a numeric destructured key as a number
- where: packages/forge/src/vite/moduleInfo.ts:50 (moduleInfo, picked)
- scenario: `const { 0: first } = ns` has a `NumericLiteral` key; it is cast to `StringLiteral` and `nameOf` returns `node.value`, the number 0, stored as `imported`. `trace.declaring` then looks up `mod.exports.get(0)`, which never matches the string key `'0'`. Rare; the cast hides it.
- evidence: read
- severity: low
- fix:
- size: line
- cause: unchecked cast of key type
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

<!-- done: 10 findings, files read: 26 -->
