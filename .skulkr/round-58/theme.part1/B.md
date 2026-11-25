I couldn't save the findings file: writes to `.skulkr/out/findings.md` were refused after the first one, so the file on disk only has the first four findings. Here is the whole document:

# Audit round 58 — theme.part1

## axisScheme recurses forever when an axis default names no value of the axis
- where: packages/theme/src/axes.ts:81 (axisScheme)
- scenario: `applyTheme(el, defineTheme({ name: 't', axes: { density: { default: 'cozy', values: { compact: {} } } } }))`. The same happens with a `fromDtcg` doc whose `com.weasel.axes` axis (or `defaultMode`) names a default that isn't one of its values; neither constructor checks this. `fullAxisChoice` selects `density: 'cozy'` because the default is a string. `axisScheme` finds `cozy` missing and calls itself with `def.default`, which is `cozy` again, so `applyTheme` throws a RangeError (stack overflow). unruled.md (2026-11-11) rules only on a default that isn't a string.
- evidence: read
- severity: medium

## axisScheme throws on an axis with no `values`, which fullAxisChoice deliberately tolerates
- where: packages/theme/src/axes.ts:81 (axisScheme)
- scenario: an axis loaded as `{ default: 'x' }` with no `values`. `fullAxisChoice` and `enumerateAxisChoices` both guard `def.values ?? {}`, and `fullAxisChoice` still selects the default. `applyTheme` then calls `axisScheme`, where `Object.hasOwn(undefined, 'x')` throws a TypeError.
- evidence: read
- severity: low

## fromDtcg accepts axis names defineTheme rejects (`theme`, `variant`, `__proto__`)
- where: packages/theme/src/fromDtcg.ts:38 (readAxesExtension)
- scenario: a DTCG doc whose `com.weasel.axes` declares an axis named `theme`. `defineTheme` and `derive` reject that name (ruled 2026-11-11), but `fromDtcg` loads it silently. `applyTheme` sets `data-wzl-theme` to the theme name, then overwrites it with the axis value (applyTheme.ts:125–126). The selector `[data-wzl-theme='<name>'][data-wzl-theme='a']` can then never match, so no token applies. The ruling exempts a Theme built by hand, not the package's own loader.
- evidence: read
- severity: medium

## Axis names are never checked as attribute or CSS identifiers, so applyTheme throws or its rule silently drops
- where: packages/theme/src/axes.ts:35 (axisNameProblem); used at packages/theme/src/applyTheme.ts:117,126
- scenario: an axis named `'my axis'` passes `axisNameProblem`, and then `setAttribute('data-wzl-my axis', …)` throws InvalidCharacterError. An axis named `a.b` gets its attribute but builds an invalid selector, `[data-wzl-a.b='x']`. The sheet drops that whole rule with no warning, and the subtree gets none of the theme's tokens. `wzlAttr` escapes the value, never the attribute name.
- evidence: read
- severity: low

## generatedColors caches every count/gates combination forever
- where: packages/theme/src/colorListItems.ts:46 (generated, generatedColors)
- scenario: a slider driving `{ generate: { count, gates } }` gives each step a new key. Every palette stays in the module-level `Map` with no cap or eviction, so it grows for the life of the page.
- evidence: read
- severity: low

## colorCount reports the requested `count`, not the colors colorAt actually wraps over
- where: packages/theme/src/colorListItems.ts:106 (colorCount)
- scenario: `{ generate: { count: 2.5 } }`. `generate` uses `Array.from({ length })`, which truncates, so `colorAt` wraps over 2 colors while `colorCount` answers 2.5. With a negative count, `colorAt` throws "empty color list" and `colorCount` answers -3.
- evidence: read
- severity: low

## blendTheme cannot blend a unitless 0 with a length, so a `0` ↔ `4px` token jumps
- where: packages/theme/src/blendTheme.ts:24 (blendNumbers)
- scenario: a radius that is `0` in one mode and `4px` in the other. The units read as `''` and `'px'`, so the unit check fails, and `parseColor` fails too. `heaviest` then picks one end, and a transition driven by `applyTheme(…, { weights })` snaps at the halfway weight instead of easing. A bare 0 is a valid length; `parseBoxShadow` accepts it.
- evidence: read
- severity: low

## withAlpha and mixAlpha disagree on an alpha outside 0–1, which flattenTokens never checks
- where: packages/theme/src/dtcg/flatten.ts:52; packages/theme/src/dtcg/color.ts:16,21
- scenario: a token with `com.weasel.alpha: 1.5` loads, since any number is accepted. Over a hex target it becomes `rgba(…, 1.5)`, which CSS clamps to opaque. Over a named or `var()` target it becomes `color-mix(… 150%, transparent)`, which is invalid at computed-value time. Negative alphas split the same way.
- evidence: read
- severity: low

## fontStack writes a family holding a quote as broken CSS
- where: packages/theme/src/dtcg/value.ts:11 (fontStack)
- scenario: `["Marck's Script Pro", "serif"]` becomes `'Marck's Script Pro', serif`, and the string is left unterminated. `declarable` then drops the whole font declaration. A family with no space that isn't a valid identifier, such as `"3Dumb"`, is left unquoted, which is also invalid.
- evidence: read
- severity: low

## parseBoxShadow reads a calc() length as part of the color instead of throwing
- where: packages/theme/src/boxShadow.ts:79 (parseBoxShadow)
- scenario: `'0 calc(1px * 2) 4px rgba(0,0,0,.5)'` gives `{ x: 0, y: 4, color: 'calc(1px * 2) rgba(0,0,0,.5)' }`, a silently wrong shadow, where the doc says lengths must be px or a bare 0. Separately, `2PX` throws even though CSS units are case-insensitive.
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
packages/theme/src/hooks.ts
packages/theme/src/generated/manifest.ts (first 60 lines, generated)
packages/theme/src/generated/themes.ts (skimmed, generated)
packages/theme/src/generated/tokens.css (selectors and computed values, generated)

<!-- done: 10 findings, files read: 28 -->