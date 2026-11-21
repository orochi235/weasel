I couldn't write `.skulkr/out/findings.md` because permission was denied, so the whole findings document is below.

# Audit round 59: ui.components.SwatchStrip

## Matching the current swatch compares any color not written as hex by its exact spelling
- where: packages/ui/src/components/SwatchStrip/SwatchStrip.tsx:63 (`same`), used by `currentIn` at :103
- scenario: An app's fill is a CSS named or functional color, such as `value="Red"` or `value="rgb(255, 0, 0)"`. Both are valid, since `SwatchGridOption.value` accepts any CSS color. The Basic palette's `#ff0000ff` swatch, or a recent entry spelled `red`, should then show as current. It doesn't: `normalizeRecentColor` only rewrites strings starting with `#`, and returns every other color trimmed but otherwise unchanged. So `same('Red', 'red')` and `same('rgb(255, 0, 0)', '#ff0000ff')` are both false, and no swatch is marked current. The comment at :102 says the match is "on the color, not its spelling", but that only holds between hex spellings. Expected: the same color marks its swatch however it is written. At minimum named colors should match regardless of case; ideally every color is resolved through paint's color parser.
- evidence: read (`normalizeRecentColor` in packages/ui/src/components/RecentColors/recentColors.ts:42; `toHex8` in packages/paint/src/hexAlpha.ts:12 returns input not starting with `#` unchanged)
- severity: low

## Files read
packages/ui/src/components/SwatchStrip/SwatchStrip.module.css
packages/ui/src/components/SwatchStrip/SwatchStrip.stories.tsx
packages/ui/src/components/SwatchStrip/SwatchStrip.tsx
packages/ui/src/components/SwatchStrip/index.ts
packages/ui/src/components/SwatchStrip/lab/SwatchArc.stories.module.css
packages/ui/src/components/SwatchStrip/lab/SwatchArc.stories.tsx
packages/ui/src/components/SwatchStrip/lab/SwatchArcView.tsx
packages/ui/src/components/SwatchStrip/lab/swatchArcConfig.ts
packages/ui/src/components/SwatchStrip/lab/useRingReading.ts
packages/ui/src/components/SwatchStrip/palettes.ts

<!-- done: 1 findings, files read: 10 -->