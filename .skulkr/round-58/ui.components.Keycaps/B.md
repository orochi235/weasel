I couldn't save `.skulkr/out/findings.md` because writing there needs a permission that wasn't granted, so the whole document is below.

# Audit round 58 — ui.components.Keycaps

## keyLegendsFromFormatted drops or swallows the plus key in a `+`-joined legend (`Ctrl++`, `Ctrl+Shift++`)
- where: packages/ui/src/components/Keycaps/keyLegendsFromFormatted.ts:11 (keyLegendsFromFormatted)
- scenario: `formatShortcut({ key: '+', mod: true }, { platform: 'windows' })` writes `Ctrl++`. `'Ctrl++'.split('+')` is `['Ctrl','','']`, and after dropping the empties it is `['Ctrl']`, length 1. The function then falls through to the glyph path and returns one key labeled `Ctrl++`. With two modifiers, `Ctrl+Shift++` becomes `['Ctrl','Shift']` and the `+` key disappears. Both `ShortcutKeys legend={formatShortcut(...)}` and the search tokenizer in `ShortcutSheet/sheetRows.ts:25` get this wrong. The expected results are `['Ctrl','+']` and `['Ctrl','Shift','+']`. `keyLegendsFromChord` already handles this with `split(/\+(?=.)/)`, and the tests only cover `+` and `⌘+`.
- evidence: read (formatShortcut.ts:63-72; keyLegendFromKey passes a single non-letter character through unchanged)
- severity: medium

## keyLegendsFromChord treats Ctrl and Meta as the key and drops the real key after them
- where: packages/ui/src/components/Keycaps/keyLegendsFromChord.ts:5,15-17
- scenario: `MODS` lists only `mod`, `shift` and `alt`, though `keyLegendsFromMods` also accepts `ctrl` and `meta`. InlineMarkdown (`InlineMarkdown.tsx:34`) sends the chord `Ctrl+Z` here, `Ctrl` is taken as the key, the result is a single `Ctrl` chip, and `Z` is dropped without any sign. In general, every part after the first non-modifier is discarded.
- evidence: read
- severity: low

## keyLegendsFromChord orders modifiers one way when there is a key and another way when there is none
- where: packages/ui/src/components/Keycaps/keyLegendsFromChord.ts:16-17
- scenario: With no key, modifiers keep the order they were written in, duplicates included: `Shift+Mod` gives `[⇧, ⌘]` and `Mod+Mod` gives two `⌘`. With a key they are put in a fixed order and deduplicated: `Shift+Mod+Z` gives `[⌘, ⇧, Z]`.
- evidence: read
- severity: low

## useHeldKeys releases every non-modifier when Meta comes up, on every platform
- where: packages/ui/src/components/Keycaps/useHeldKeys.ts:27 (up)
- scenario: This is a workaround for macOS, but nothing checks the platform. On Windows or Linux, hold W, then tap Win/Super: W leaves `held` while it is still down. Its repeat keydowns are ignored (line 16), so it stays dark in `KeyDiagram` until it is pressed again.
- evidence: read
- severity: low

## KeyDiagram reserves caption room for marks on keys it does not draw
- where: packages/ui/src/components/Keycaps/KeyDiagram.tsx:76 (`captioned`)
- scenario: The check looks at every entry in `marks`. Suppose the marks table covers the whole keyboard, `keys` is WASD, and only `ShiftLeft` (not drawn) has a caption. `data-captioned` is still set, every row gets 0.6u taller, and the gaps under the keys are empty.
- evidence: read (KeyDiagram.module.css)
- severity: low

## KeyDiagram ignores a `keys` entry's `label` and `width` when a layout is given
- where: packages/ui/src/components/Keycaps/KeyDiagram.tsx:72
- scenario: Without a layout, `{ code: 'KeyQ', label: 'Jump' }` prints "Jump". With a layout, `keys` is reduced to a set of codes and the key prints `Q`. The same prop gives different output depending on whether `layout` is set.
- evidence: read
- severity: low

## keyGlyph upper-cases whole key names, unlike keyLegendFromKey
- where: packages/ui/src/components/Keycaps/keyGlyph.ts:20
- scenario: `keyGlyph('Home')` returns `HOME` and `keyGlyph('PageUp')` returns `PAGEUP`, while `keyLegendFromKey` gives `Home` and `PgUp`. These are two exported answers to the same question, and keyGlyph also keeps its own copy of the macOS column of `NAMED_KEY`.
- evidence: read
- severity: low

## Legend fitting measures a symbol's font character, but the key draws an icon at 1.25× the legend size
- where: packages/ui/src/components/Keycaps/legendMeasure.ts:58-66; Keycap.tsx:90-98
- scenario: For a symbol in `LEGEND_ICONS` (`⊞`, `▤`, `␣`, the arrows), the key draws an icon `1.25 × --key-legend-size` wide, but the fit measures the hidden character. A fixed board key can report scale 1 while its icon is bigger than its room, and that wrong width also feeds the bank's shared scale.
- evidence: read (the overflow is an inference; I didn't render it)
- severity: low

## KeyBank story's key-width control has no effect below about 1.45 key heights
- where: packages/ui/src/components/Keycaps/KeyBank.stories.tsx:58-62; Keycaps.stories.module.css `.key`
- scenario: Every NAV legend is `data-kind='wide'`. The rule `.key[data-kind='wide']` (specificity 0,2,0) sets `min-width: 32px; padding: 0 8px`, which beats the story's `.key { min-width: 0; padding: 0 2px }` (0,1,0). At the default `keyWidth: 1` (22px) the keys render at 32px with 8px padding, so the slider does nothing below about 1.45, and the story never shows legends being fitted into narrow keys.
- evidence: read (tokens.css)
- severity: low

## KeyCap story helper relabels Caps Lock (⇪) as Meta
- where: packages/ui/src/components/Keycaps/keycapLegends.story.ts:6
- scenario: `'⇪': 'meta'` makes `relabel('⇪', 'macos')` return `⌘`, and on Windows `⊞` or `Win`, so the Caps Lock key shows up as Command or the Windows key.
- evidence: read
- severity: low

## KeyCap Gallery labels ⎋ as `wide`, though inferKeycapKind makes it `square`
- where: packages/ui/src/components/Keycaps/Keycap.stories.tsx:156
- scenario: On macOS, `⎋` is a single grapheme and not in `WIDE_GLYPHS`, so the chip renders square next to a cell that says "wide".
- evidence: read
- severity: low

## KeySequence story describes `joins: 'key'` as one separator, which the code does not do
- where: packages/ui/src/components/Keycaps/KeySequence.stories.tsx:49-50
- scenario: The description says "once, between the last modifier and the first non-modifier". `sepBefore` (`Keycaps.tsx:62-64`) puts a separator before every non-modifier, so `⌘ K L` renders as `⌘ + K + L`.
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
packages/ui/src/components/Keycaps/legendMeasure.ts
packages/ui/src/components/Keycaps/useHeldKeys.ts
packages/ui/src/components/Keycaps/useLegendFit.ts
packages/ui/src/components/Keycaps/variantIcons.ts

<!-- done: 12 findings, files read: 27 -->