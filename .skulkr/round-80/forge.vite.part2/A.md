# Findings: forge.vite.part2 (round 80)

## The issues endpoint shows at most 30 issues, silently: `gh issue list` runs without `--limit`
- where: packages/forge/src/vite/issues/endpoint.ts:100 (serveIssues → answer)
- scenario: a component labeled `forge:<name>` with 31+ open issues. `gh issue list` defaults to `--limit 30`, so the answer lists the 30 newest and nothing marks the list as cut off. The panel reads it as the whole set and the rest never appear. It should pass an explicit `--limit` (and say when it hits it) or page through.
- evidence: read
- severity: medium

## `mayBeStory` drops an export at its depth limit, against its own rule that what cannot be read stays in
- where: packages/forge/src/vite/nativeExports.ts:105 (mayBeStory)
- scenario: an export reached through a long chain of top-level consts, casts and helper functions that return `story(...)`. Each identifier, cast, call and return adds depth, so 16 steps come quickly. Past 16 the function returns `false`, which means "not a story", and the loader leaves the export out. The doc comment says what cannot be read stays in, and `isLiteralValue` at its own limit answers "not a literal", so it errs the other way. The limit should answer `true` (or answer only cycles `false`).
- evidence: read
- severity: low

## A global's identity method around a story, such as `Object.freeze(story(...))`, reads as not a story
- where: packages/forge/src/vite/nativeExports.ts:122 (mayBeStory, CallExpression with a MemberExpression callee)
- scenario: `export const Primary = Object.freeze(story({...}))`. The callee's object `Object` is a global, so `!isGlobal(...)` is false and the export is answered "not a story". `Object.freeze` hands back its argument, so this is a story the loader now drops. Only `Object.assign` is special-cased. `Object.freeze`/`Object.seal` (and similar pass-through globals) should be decided by their argument, as `Object.assign` is.
- evidence: read
- severity: low

## `reflectionText` prints an inline type that has only index signatures as `{}`
- where: packages/forge/src/vite/typedoc/print.ts:89 (reflectionText)
- scenario: a method overload takes `opts: { [key: string]: number }`. TypeDoc writes this as a reflection with `indexSignatures` and no `children`, so the overload text shows `(opts: {}) => …`. A declaration with both call signatures and children also loses its call signatures. The overloads shown in the API panel misstate the type.
- evidence: read
- severity: low

## An optional tuple element of a union type prints without parentheses
- where: packages/forge/src/vite/typedoc/print.ts:28 (typeText, case 'optional')
- scenario: the type `[a: string, b?: number | null]` in unnamed form, `[string, (number | null)?]`, prints as `[string, number | null?]`, which is not the same type and is not valid TS. The `optional` case should go through `grouped(type.elementType, ['union', 'intersection', 'function', 'conditional'])`, as `array` does with `POSTFIX`.
- evidence: read
- severity: low

## The silent-watcher warning always says "a file written 5 s ago", even with a custom probe
- where: packages/forge/src/vite/watchProbe.ts:84 (UNREPORTED / warnWhenWatchIsSilent)
- scenario: `watchProbe({ probe })` with a custom `probe` that answers false (it may write no file, or wait some other time). The logged warning still claims a file was written `${WAIT_MS / 1000}` = 5 s ago and not reported, which is not what was checked.
- evidence: read
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

<!-- done: 6 findings, files read: 25 -->
