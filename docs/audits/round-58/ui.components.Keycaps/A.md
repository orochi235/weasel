<!-- done: 9 findings, files read: 27 -->

I couldn't write `.skulkr/out/findings.md` because permission was refused, so the whole document follows.

# Audit round 58: ui.components.Keycaps

## keyLegendsFromFormatted drops or garbles the `+` key in a `+`-joined legend
- where: packages/ui/src/components/Keycaps/keyLegendsFromFormatted.ts:11 (keyLegendsFromFormatted)
- scenario: off macOS, `formatShortcut` joins the spelled-out keys with `+` (packages/gestures/src/ui/formatShortcut.ts:71). A shortcut on the plus key therefore comes out as `Ctrl++` or `Ctrl+Shift++`.
  - `split('+').filter(p => p !== '')` turns `Ctrl+Shift++` into `['Ctrl','Shift']`. `<ShortcutKeys legend="Ctrl+Shift++">` then draws two modifier caps and no key.
  - `Ctrl++` filters down to `['Ctrl']` (length 1) and falls through to the glyph path. It comes back as one key labeled `Ctrl++`.
  - Both should give `Ctrl`, (`Shift`,) `+`. The comment "A lone `+` is a key" only covers the legend `+` on its own.
- evidence: read
- severity: medium

## With a layout, KeyDiagram drops the `label` given in its `keys` prop
- where: packages/ui/src/components/Keycaps/KeyDiagram.tsx:70 (KeyDiagram, `placement` memo)
- scenario: `<KeyDiagram layout={KEYBOARD_LAYOUTS.macos} keys={[{ code: 'KeyW', label: 'Fwd' }]} />` reduces `keys` to a set of codes for `placeKeys`. The slot then prints the layout's label or the code's legend (`W`), not `Fwd`. Without a layout the same `keys` entry prints `Fwd` (row path, line 106). The `KeyboardKey` type documents `label` as "What it prints", so one prop is honored on one path and silently dropped on the other.
- evidence: read
- severity: low

## Without a layout, KeyDiagram ignores a key's `width`
- where: packages/ui/src/components/Keycaps/KeyDiagram.tsx:106 (KeyDiagram, row path) / :78 (slot)
- scenario: `<KeyDiagram keys={[{ code: 'Space', width: 6 }]} />` passes `{code, width}` to `slot` with no `place`. No `--w` is set and `fixed` is false, so the key is drawn at its legend's width. `width` is part of the `KeyboardKey` that `keys` accepts. It is honored only when a layout places the key.
- evidence: read
- severity: low

## useLinger shows the diagram again after `linger` is switched on later
- where: packages/ui/src/components/Keycaps/KeyDiagram.tsx:128 (useLinger)
- scenario: While `linger` is undefined, releasing a key sets `lingering = true`. The effect returns early, so nothing ever clears it. If `linger` is later set (say to 2), the effect starts the timer. Even though no key was held, the diagram then shows (`data-up`) for 2 s when it should stay hidden. The same stale state also follows any linger-less period.
- evidence: read
- severity: low

## `data-captioned` counts marks for keys the diagram doesn't draw
- where: packages/ui/src/components/Keycaps/KeyDiagram.tsx:75 (KeyDiagram, `captioned`)
- scenario: `captioned` reads `Object.values(marks)` without checking which keys are drawn. With `keys={['KeyA','KeyB']}` and `marks={{ KeyQ: { caption: 'turn' } }}`, `data-captioned` is set. Every row then reserves `--caption-h` of empty caption space, so the board is taller than any drawn key needs. It should consider only marks on drawn keys.
- evidence: read
- severity: low

## keyGlyph upper-cases whole key names, which keyLegendFromKey doesn't
- where: packages/ui/src/components/Keycaps/keyGlyph.ts:20 (keyGlyph)
- scenario: `keyGlyph('Home')` returns `HOME` and `keyGlyph('PageUp')` returns `PAGEUP`, while gestures' `keyLegendFromKey` upper-cases only one-character keys (`Home`). The doc says unknown keys are upper-cased "so `'a'` reads as `A`… and returned unchanged otherwise", which describes the single-character rule. So the question of how a named key prints gets two answers in two places.
- evidence: read
- severity: low

## The KeySequence story describes `joins: 'key'` differently from the code
- where: packages/ui/src/components/Keycaps/KeySequence.stories.tsx:50 (meta.argTypes.joins)
- scenario: The control's description says `key` puts a separator "once, between the last modifier and the first non-modifier". The code (`sepBefore`, Keycaps.tsx:59) and the prop doc put one before every non-modifier, so `⌘ K L` renders `⌘ + K + L`. The story's own JoinKey docstring has it right.
- evidence: read
- severity: low

## The KeyCap gallery labels `⎋` as `wide`, but it renders square
- where: packages/ui/src/components/Keycaps/Keycap.stories.tsx:162 (KeyCapGallery rows)
- scenario: The gallery row `{ label: '⎋', kind: 'wide' }` prints "wide" in its kind column. `inferKeycapKind('⎋')` returns `'square'`: `⎋` isn't in `WIDE_GLYPHS` and is one grapheme. So the gallery that exists to show each kind mislabels the chip it draws.
- evidence: read
- severity: low

## The story relabeler maps `⇪` (Caps Lock) to the `meta` modifier
- where: packages/ui/src/components/Keycaps/keycapLegends.story.ts:6 (MOD_BY_GLYPH)
- scenario: `relabel('⇪', 'windows', 'auto')` returns `⊞`, and on macOS it returns `⌘`. Caps Lock becomes the Windows/Command key, so a story fed `⇪` (the Modifier story's doc lists it) draws the wrong key on every platform.
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

<!-- done: 9 findings, files read: 27 -->