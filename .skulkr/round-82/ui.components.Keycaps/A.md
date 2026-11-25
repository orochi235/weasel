# Audit round 82 — ui.components.Keycaps

## `--key-diagram-unit` resizes the board's pitch but not the keys, so keys overlap or float apart
- where: packages/ui/src/components/Keycaps/KeyDiagram.module.css:3 (.diagram), with Keycaps.module.css:2 (.key sets its own --key-h)
- scenario: a consumer sets `--key-diagram-unit: 40px` on a `KeyDiagram` with a layout, as the stylesheet's header comment says to. `--u`, `--pitch` and `--pitch-y` grow, so each slot is placed 43px apart and is 40px wide per unit, but each `kbd` still takes `height: var(--key-h)` and `font-size: var(--key-font-size)` from `.key`, which pins `--key-h: var(--wzl-control-h-xs)` and `--key-font-size: var(--wzl-font-size-sm)` on the key itself. Nothing in KeyDiagram.module.css overrides either (`.slot > kbd.cap` sets only weight and transition). Keys stay at the control height with a large vertical gap between rows. With a unit smaller than the control height, rows overlap. Only the caption (sized from `--u`) follows the unit. Expected: the whole diagram scales, key height and legend size included.
- evidence: read
- severity: medium

## `keyLegendsFromChord` draws the same modifier twice when `Mod` and its platform's key are both named
- where: packages/ui/src/components/Keycaps/keyLegendsFromChord.ts:15 (keyLegendsFromChord)
- scenario: `keyLegendsFromChord('Mod+Ctrl+F', { platform: 'windows' })` (macOS's ⌃⌘F written cross-platform) maps `mod` → `Ctrl` and `ctrl` → `Ctrl`, so it returns `Ctrl`, `Ctrl`, `F`. `'Mod+Meta+K'` on macOS returns `⌘`, `⌘`, `K` the same way. The modifiers are deduplicated by name (`named` set), not by the key they resolve to. Expected: one `Ctrl` key, since that is the one physical key the chord holds.
- evidence: read (MOD_BY_PLATFORM in packages/gestures/src/ui/keyLegendsFromMods.ts:56-85; keyLegendsFromMods maps each name without collapsing)
- severity: low

## An empty chord gives one blank key instead of no keys
- where: packages/ui/src/components/Keycaps/keyLegendsFromChord.ts:13 (keyLegendsFromChord)
- scenario: `keyLegendsFromChord('')` (or `'  '`): `''.split(...)` is `['']`, and `''` is not a modifier, so `keyLegendFromKey('')` is pushed and the result is a one-key list. `KeySequence` then draws an empty keycap instead of its em-dash placeholder for empty input. `keyLegendsFromFormatted('')` returns `[]` for the same input, so the two parsers disagree on it.
- evidence: read
- severity: low

## The icon legend's size multiple is set in two places
- where: packages/ui/src/components/Keycaps/Keycaps.module.css:118 (.legendIcon), packages/ui/src/components/Keycaps/legendIcons.ts:17 (LEGEND_ICON_SCALE)
- scenario: `fitForm` measures an icon legend as `size * LEGEND_ICON_SCALE`, while `.legendIcon` draws it at a hard-coded `* 1.25`. Changing either one alone means a banked key fits an icon at a size it isn't drawn at, which leaves the icon overflowing its key or shrunk more than needed. The comment links them, but no single definition feeds both (for example a custom property set from the constant, or the CSS reading a `--key-legend-icon-scale`).
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Keycaps/KeyBank.stories.tsx
packages/ui/src/components/Keycaps/KeyBank.tsx
packages/ui/src/components/Keycaps/KeyDiagram.module.css
packages/ui/src/components/Keycaps/KeyDiagram.stories.tsx
packages/ui/src/components/Keycaps/KeyDiagram.tsx
packages/ui/src/components/Keycaps/KeySequence.stories.tsx
packages/ui/src/components/Keycaps/KeyboardLayout.stories.tsx
packages/ui/src/components/Keycaps/Keycap.stories.tsx
packages/ui/src/components/Keycaps/Keycap.tsx
packages/ui/src/components/Keycaps/Keycaps.module.css
packages/ui/src/components/Keycaps/Keycaps.stories.module.css
packages/ui/src/components/Keycaps/Keycaps.tsx
packages/ui/src/components/Keycaps/ShortcutKeys.stories.tsx
packages/ui/src/components/Keycaps/ShortcutKeys.tsx
packages/ui/src/components/Keycaps/index.ts
packages/ui/src/components/Keycaps/keyBankContext.ts
packages/ui/src/components/Keycaps/keyGlyph.ts
packages/ui/src/components/Keycaps/keyLegendsFromChord.ts
packages/ui/src/components/Keycaps/keyLegendsFromFormatted.ts
packages/ui/src/components/Keycaps/keyboardLayout.ts
packages/ui/src/components/Keycaps/keycapFonts.story.ts
packages/ui/src/components/Keycaps/keycapLegends.story.ts
packages/ui/src/components/Keycaps/legendFit.ts
packages/ui/src/components/Keycaps/legendIcons.ts
packages/ui/src/components/Keycaps/legendMeasure.ts
packages/ui/src/components/Keycaps/useHeldKeys.ts
packages/ui/src/components/Keycaps/useLegendFit.ts
packages/ui/src/components/Keycaps/variantIcons.ts

<!-- done: 4 findings, files read: 28 -->
