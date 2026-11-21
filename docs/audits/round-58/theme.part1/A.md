# Audit round 58 — theme.part1

## axisScheme recurses forever when an axis's default is not one of its values
- where: packages/theme/src/axes.ts:81 (axisScheme)
- scenario: an axis `{ default: 'dark', values: { light: {} } }` reaches `applyTheme`. `fullAxisChoice` picks the unvalidated default `'dark'`, and `axisScheme(axes, 'mode', 'dark')` finds no `dark` value, so it calls itself with `def.default`, which is `'dark'` again, until the stack overflows (RangeError). It should return undefined, or the scheme for "no value", when the default is missing too. `fromDtcg` builds exactly this axis from an ordinary document: `extends: null` with only a `light` mode and no `defaultMode` gives a mode default of `'dark'` (fromDtcg.ts:102). A `com.weasel.axes` axis whose string default names no value (checked only by `typeof`, fromDtcg.ts:39) does the same, and so does `defaultMode: 'foo'`.
- evidence: read
- severity: high

## fromDtcg accepts an axis named `theme` or `variant`, which defineTheme and bake refuse
- where: packages/theme/src/fromDtcg.ts:38 (readAxesExtension), :108-109 (fromDtcg)
- scenario: a document whose `$extensions["com.weasel.axes"].axes` declares `theme: { default: 'a', values: { a: {} } }` loads without complaint. `applyTheme` then stamps `data-wzl-theme="weasel-doc"` and, in the same loop, overwrites it with `data-wzl-theme="a"` (applyTheme.ts:125-126). The selector it holds asks for both values of `data-wzl-theme`, so no element ever matches it and the theme never applies. `defineTheme` (theme.ts:68) and the engine (engine/axisIssues.ts) reject such a name through `axisNameProblem`, so the same question gets two answers. fromDtcg should run `axisNameProblem` on each axis it reads.
- evidence: read
- severity: medium

## blendTheme snaps a length between a bare `0` and a px value instead of mixing it
- where: packages/theme/src/blendTheme.ts:24 (blendNumbers)
- scenario: a token is `0` at `density=compact` and `8px` at `roomy`, and `applyTheme` is called with `weights: { density: { compact: 1, roomy: 1 } }`. `readCssNumber('0')` gives unit `''` and `'8px'` gives `'px'`, so `blendNumbers` gives up and the token snaps to the heaviest selection's value. It should come out as `4px`, because a bare 0 is a length. `parseBoxShadow` in the same package accepts a unitless 0 as a px length (boxShadow.ts:80), so the package answers "is `0` a length" two ways, and theme authors write bare `0` routinely.
- evidence: read
- severity: low

## The generated color list cache grows without bound
- where: packages/theme/src/colorListItems.ts:46 (generated, generatedColors)
- scenario: a chart whose series count or gates come from the user (a count slider, a gates editor) reads `colorAt({ generate: { count, gates } }, i)` for each new pair. Every distinct `count` and `gates` adds a module-level Map entry that is never evicted, so the Map grows for the life of the page. It should be capped (an LRU of a few entries) or kept per caller.
- evidence: read
- severity: low

## fromDtcg passes a non-string `$description` through, and emitCss then throws on it
- where: packages/theme/src/dtcg/flatten.ts:53 (flattenTokens)
- scenario: a DTCG token with `"$description": 5` (or an object) becomes `RawToken.description = 5`, a value its declared type `string | undefined` does not allow. `emitCss` then calls `token.description.replaceAll(...)` (engine/emit/css.ts:191), which throws a TypeError. `fromDtcg` checks every other field it reads (name, axes, ramps, tints) and refuses bad input with a message, so it should either drop a non-string description or refuse it the same way.
- evidence: read
- severity: low

## A DTCG alpha above 1 or below 0 is accepted and becomes an invalid color-mix()
- where: packages/theme/src/dtcg/flatten.ts:52 (flattenTokens); packages/theme/src/dtcg/color.ts:21 (mixAlpha)
- scenario: `"$extensions": { "com.weasel.alpha": 1.5 }` on a token that references an `oklch()` or named color is read with only a `typeof` check. `withAlpha` then calls `mixAlpha`, which writes `color-mix(in srgb, <c> 150%, transparent)`. Percentages above 100% are invalid in `color-mix()`, so the property becomes guaranteed-invalid in the browser, while the same alpha on a hex color clamps silently in `rgba()`. The field is documented as 0–1 (types.ts:26), so it should be refused or clamped on read.
- evidence: read
- severity: low

## fontStack writes a family name holding an apostrophe as a broken string
- where: packages/theme/src/dtcg/value.ts:11 (fontStack)
- scenario: a `fontFamily` token `["Joe's Hand", "serif"]` serializes to `'Joe's Hand', serif`. The quote closes after `Joe`, and `s Hand', serif` leaves a string open. `applyTheme` then drops the whole declaration with a warning (declarable), and emitted CSS carries the broken value. The quote inside the name should be escaped (`\'`), or the name wrapped in double quotes.
- evidence: read
- severity: low

## Files read
packages/theme/src/appearance.ts
packages/theme/src/applyTheme.ts
packages/theme/src/axes.ts
packages/theme/src/blendTheme.ts
packages/theme/src/boxShadow.ts
packages/theme/src/capText.module.css
packages/theme/src/chainTokens.ts
packages/theme/src/colorList.ts
packages/theme/src/colorListItems.ts
packages/theme/src/colorMode.ts
packages/theme/src/colorSource.ts
packages/theme/src/cssNumber.ts
packages/theme/src/currentColor.ts
packages/theme/src/definition.ts
packages/theme/src/dtcg/axesExtension.ts
packages/theme/src/dtcg/color.ts
packages/theme/src/dtcg/flatten.ts
packages/theme/src/dtcg/resolve.ts
packages/theme/src/dtcg/types.ts
packages/theme/src/dtcg/value.ts
packages/theme/src/engine.ts
packages/theme/src/faces.css
packages/theme/src/fonts.css
packages/theme/src/fromDtcg.ts
packages/theme/src/generated/tokens.css
packages/theme/src/hooks.ts

<!-- done: 7 findings, files read: 26 -->
