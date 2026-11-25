## Destructured defaults are lost for a component exported as `export default memo(...)` / `forwardRef(...)`
- where: packages/forge/src/vite/apiTable.ts:186 (destructuredDefaults), also componentOf at :78
- scenario: `Button.tsx` has `export default forwardRef(function Button({ size = 'md' }, ref) {…})`, and the story imports it as `import Button from './Button'`. Because the default export is an expression and not an identifier, TS gives the module's `default` symbol (not an alias) the `ExportAssignment` as its declaration, and componentOf.ts passes that declaration on. The walk in `destructuredDefaults` handles variable declarations, calls, parens/as/satisfies and identifiers. It has no `ExportAssignment` branch, so it breaks at once and returns no defaults, and the API table shows no default for `size`. For the same declaration, `getNameOfDeclaration` returns undefined, so `component` (used to search TypeDoc's output) is also missing. componentOf.ts's own `objectOf` does follow `ExportAssignment.expression`, so the two readers disagree on the same construct. Expected: step into `declaration.expression` and keep walking to the function.
- evidence: read
- severity: medium

## The dependency graph and the API table pick different components when the meta's `component` comes from a dependency
- where: packages/forge/src/vite/bindings.ts:100 (componentOf), compared with packages/forge/src/vite/componentOf.ts:27 (componentOf)
- scenario: a meta has `component: Trigger`, with `Trigger` imported from a node_modules package; its title is `ui/Select` and the file also imports `Select` from './Select'. In the graph, `resolveFrom` returns null for anything under node_modules, so the `componentName` lookup yields no key and the graph falls back to the title stand-in `Select` (source `./Select`). The TS reader in componentOf.ts falls back only when the meta's component is declared in the story file itself. Here it is not, so the API table documents the dependency's `Trigger`. The page then shows the props of one component next to the source, history and uses of another. componentOf.ts's comment says its fallback works "as it does in the dependency graph". It doesn't in this case.
- evidence: read
- severity: low

## `unquoted` mangles non-BMP characters in a C-quoted git path
- where: packages/forge/src/vite/history.ts:27 (unquoted)
- scenario: git C-quotes a path that contains a `"`, a backslash or a tab. With `core.quotepath=off`, it leaves an emoji (astral character) in such a path as raw UTF-8. `unquoted` walks the string one UTF-16 code unit at a time and calls `Buffer.from(ch, 'utf8')` on each surrogate half separately. Each lone surrogate encodes as EF BF BD (U+FFFD). The decoded name no longer equals the followed path, so the component gets no history or dates. Expected: iterate by code point (`for…of`, or `codePointAt`).
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
packages/forge/src/vite/freeNames.ts
packages/forge/src/vite/history.ts
packages/forge/src/vite/html.ts
packages/forge/src/vite/index.ts
packages/forge/src/vite/indexFile.ts
packages/forge/src/vite/indexStory.ts
packages/forge/src/vite/isolateReport.ts
packages/forge/src/vite/issues/answer.ts
packages/forge/src/vite/issues/endpoint.ts

<!-- done: 3 findings, files read: 27 -->
