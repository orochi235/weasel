## TypeDoc's docs never reach a class component's props: `propsTypeOf` finds nothing on a class reflection
- where: packages/forge/src/vite/typedoc/index.ts:113 (propsTypeOf), used by readTypedoc's `component`
- scenario: `exportIn` accepts `Kind.Class` exports, but `propsTypeOf` reads only `signatures[0].parameters[0].type ?? type`. A TypeDoc class reflection has neither (its constructor is a child and its props sit in `extendedTypes: [Component<P>]`), so `collect` gets `undefined` and the component reads as having no props and no ref members. Every prop row of a `class Foo extends React.Component<FooProps>` keeps only the live description; TypeDoc's `@see`/`{@link}`, deprecations and inheritedFrom never show, although the component's href does.
- evidence: read
- severity: low
- size: function
- cause: class reflections not looked through to `extendedTypes`
- confidence: likely

## Two copies of "the nearest package.json's name", answering differently
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: packages/forge/src/vite/packageName.ts already exports `packageNameOf(file, top)`. The typedoc copy is a second definition of the same lookup with no `top` bound and a different return convention (`undefined` vs `null`), so a fix to one (bounding, caching, the prefix check below) does not reach the other.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: line
- cause: duplicated helper
- confidence: sure

## `packageNameOf`'s `top` bound is a string prefix, not a path prefix
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: with `top = '/repo/pkg'` and a file at `/repo/pkg-other/src/x.ts` (reachable from history.ts's `resolve(top, path)` when `path` climbs with `..`), `'/repo/pkg-other/src'.startsWith('/repo/pkg')` is true, so the walk reads `/repo/pkg-other/package.json` and returns that package's name although it lies outside `top`. It should stop at the first directory not at or under `top`.
- evidence: read
- severity: low
- size: line
- cause: startsWith without a separator boundary
- confidence: sure

## A type-only default export is recorded as a value export
- where: packages/forge/src/vite/moduleInfo.ts:96 (moduleInfo, ExportDefaultDeclaration)
- scenario: `export default interface Props {}` (a `TSInterfaceDeclaration`) is neither a named function/class nor an Identifier, so it falls to `declare(DEFAULT_LOCAL, decl)` and `exports.set('default', …)`. The trace then reports `file#<default local>` as the value `default` resolves to, where a value import of `default` from that module has nothing to bind; the named-export and import paths skip type-only declarations, this one does not.
- evidence: read
- severity: low
- size: line
- cause: missing type-declaration skip on default export
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
