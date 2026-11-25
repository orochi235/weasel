# Audit round 73 — theme.engine (blind reviewer)

## emitCss gives a non-default theme's inherited tokens its own default at an axis value only it declares, where tokenAt (bake, THEMES, the runtime) gives the root's default
- where: packages/theme/src/engine/emit/css.ts:144 (defaultsBlock), with the `differs` filter at css.ts:179 and `Resolved.token` at css.ts:76
- scenario: root `d` has `mode` {dark, light}, default `dark`, and a token `T` `{ by: mode, dark: A, light: B }`. Theme `x` extends `d`, adds a mode value `sepia` and sets the default to `light`, and does not touch `T`. At `[data-wzl-theme='x'][data-wzl-mode='sepia']`, `tokenAt` (chainTokens.ts `localAxisChoices`) reads the root at the root's own default, so baked/THEMES/runtime give `A`. `differs` compares that with `defResolved.token(T, {mode: sepia})`, which also falls to dark (`A`), so `T` is not redeclared and x's sepia block has no `--wzl-T`. The only matching rule is x's `:where([data-wzl-theme='x'])` defaults block, written at x's default selection (`light`), so the stylesheet shows `B`. The two paths disagree on the same token at the same selection: CSS shows `B` while `THEMES.x.selections['mode=sepia']` and `resolveTheme` show `A`.
- evidence: read (traced through css.ts, chainTokens.ts and axes.ts `fullAxisChoice`; not run)
- severity: low

## A pin over a rule that failed at this selection stays in `failed`, so an untyped pin there is never reported
- where: packages/theme/src/engine/derive.ts:108 (applyPins), with references.ts:83 (inferTypes)
- scenario: a semantic `foo` fails at some selection (for example its `by` lacks that value, or the rule is malformed there), so `foo` is added to `failed`. A pin `foo: '#fff'` with no `type` still applies at that selection: `prior` is undefined, `pinToken` gives `type: 'unknown'`, and the token is written. But `foo` is never taken out of `failed`, and the closing loop of `inferTypes` skips any name in `failed`. So no `untyped-pin` issue is raised for a token that is in the output untyped. At selections where the rule works, the pin takes the rule's type. The same happens for a pinned step of a ramp that failed (`failEntry`). The rule's own failure is still reported, but the untyped token reaches the editor and the bake with type `unknown` and nothing says so.
- evidence: read
- severity: low

## generateTokens accepts two definitions with the same name and emits both under one theme attribute
- where: packages/theme/src/engine/emit/tokens.ts:18 (generateTokens)
- scenario: two files in themes/ both declare `"name": "ocean"` and extend the root. `byName` keeps only the second, so `lookup('ocean')` and every `extends: "ocean"` resolve to it. Both are still baked and passed to `emitCss`, which writes two sets of `[data-wzl-theme='ocean']` blocks that conflict. `emitThemes` writes a duplicate `"ocean"` key (the last one wins), and `THEME_SOURCES`/`BAKED_THEMES` collapse to one entry through `Object.fromEntries`. Nothing in the problems list says so. It should be refused as a problem, as a missing token or a derive issue is.
- evidence: read (no name check in packages/theme/scripts either, searched)
- severity: low

## Files read
packages/theme/src/engine/axisIssues.ts
packages/theme/src/engine/bake.ts
packages/theme/src/engine/color/generate.ts
packages/theme/src/engine/color/hueNames.ts
packages/theme/src/engine/color/hueSearch.ts
packages/theme/src/engine/color/oklch.ts
packages/theme/src/engine/color/paletteStats.ts
packages/theme/src/engine/color/placement.ts
packages/theme/src/engine/definition.fixture.ts
packages/theme/src/engine/deps.ts
packages/theme/src/engine/derive.ts
packages/theme/src/engine/emit/css.ts
packages/theme/src/engine/emit/dtcg.ts
packages/theme/src/engine/emit/e.tokens.css
packages/theme/src/engine/emit/manifest.ts
packages/theme/src/engine/emit/themes.ts
packages/theme/src/engine/emit/tokens.ts
packages/theme/src/engine/entries.ts
packages/theme/src/engine/merge.ts
packages/theme/src/engine/pinValues.ts
packages/theme/src/engine/ramps.ts
packages/theme/src/engine/references.ts
packages/theme/src/engine/ruleShape.ts
packages/theme/src/engine/safeNames.ts
packages/theme/src/engine/scales.ts
packages/theme/src/engine/semantics.ts
packages/theme/src/engine/steps.ts
packages/theme/src/engine/tokenSink.ts
packages/theme/src/engine/types.ts

<!-- done: 3 findings, files read: 29 -->
