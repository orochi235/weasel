# Audit round 80 — forge.vite.part2

## The issues endpoint lists at most 30 issues: `gh issue list` runs without `--limit`
- where: packages/forge/src/vite/issues/endpoint.ts:104 (serveIssues → answer)
- scenario: a component labeled `forge:<name>` with 31 or more open issues → `gh issue list` without `-L` returns gh's default of 30, and the answer reports those 30 as "the open issues labeled `forge:<name>`" with nothing saying the list was cut. It should pass a `--limit` big enough to hold them all, or say in the answer that the list is truncated.
- evidence: read (the args array has no `--limit`/`-L`; gh's documented default is 30)
- severity: medium

## A type literal's method members print as `name: unknown`
- where: packages/forge/src/vite/typedoc/print.ts:82 (reflectionText)
- scenario: an overload whose parameter is `{ onChange(value: string): void; [key: string]: unknown }` → TypeDoc writes `onChange` as a Method child carrying `signatures` and no `type`, so the member prints as `onChange: unknown`. TypeDoc writes the index signature under `indexSignatures`, which `TdReflection` never reads, so it is dropped. A declaration with both call signatures and children (a callable object with properties) prints only its properties, and the call signature is lost. The overload text shown in the API panel is then not the type as written.
- evidence: read
- severity: low

## A construct signature prints as a plain call signature
- where: packages/forge/src/vite/typedoc/print.ts:78 (reflectionText / signatureText)
- scenario: a parameter typed `new (x: number) => Foo` (TypeDoc kind ConstructorSignature, 16384, stored under `signatures`) → `isSignature` is true and `signatureText` prints `(x: number) => Foo` with no `new`, so the printed overload describes a different type.
- evidence: read
- severity: low

## `mayBeStory` drops an export once the depth cap trips, against its own "what cannot be read stays in"
- where: packages/forge/src/vite/nativeExports.ts:107 (mayBeStory)
- scenario: a story export reached through more than 16 steps of aliases, casts, parentheses and helper calls that return helper calls (`export const A = wrapA()`, where `wrapA` returns `wrapB()` and so on down to `story(...)`) → `depth > 16` returns false, so the loader treats it as not a story and leaves it out. Every other expression it cannot decide returns true (`if (!node) return true`, unknown imports `?? true`). The cap should return true, since a cycle needs no false to terminate: the recursion is bounded by the depth either way.
- evidence: read
- severity: low

## Type definitions are keyed by bare name, so two different types sharing a name show the first one's definition
- where: packages/forge/src/vite/typeDefs.ts:29 and :42 (addTypeDefs / addTypeDef)
- scenario: a component whose props mention `Size` from `./layout` and whose ref handle mentions a different `Size` from `./icon` → the first `Size` is stored in `into`, the second name is deleted from `names` (or `into.has(name)` returns early), and the panel shows layout's `Size` definition for icon's `Size` as well. It should be keyed by declaration, or skip the second one rather than misattribute it.
- evidence: read (inference about which callers hand one map both readings)
- severity: low

## Files read
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

<!-- done: 5 findings, files read: 25 -->
