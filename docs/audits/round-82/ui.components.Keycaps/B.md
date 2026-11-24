## `--key-diagram-unit` resizes the pitch and captions but not the keys themselves
- where: packages/ui/src/components/Keycaps/KeyDiagram.module.css:4 (.diagram), with packages/ui/src/components/Keycaps/Keycaps.module.css:2 (.keys, .key)
- scenario: a consumer sets `--key-diagram-unit: 40px` on a `KeyDiagram`, as the stylesheet's header says to "resize the whole diagram". `--u`, `--pitch`, `--pitch-y` and the caption size all follow it, but every key is a `.key` that sets `--key-h: var(--wzl-control-h-xs)` on itself, so its height stays at the control height (and a square unsized key in the row form keeps a `--key-h` width). `.slot[data-sized] > kbd.cap` sets only width. Result: keys stay ~20px tall inside 43px row pitches, leaving tall gaps, and their legends and fits don't scale; the diagram is not resized, only spread out. Should: the slot's key take `--key-h: var(--u)` (and its font size relative to it) so the whole diagram scales.
- evidence: read
- severity: medium

## On macOS, a key pressed while Command is held stays lit forever if Command's key-down was missed
- where: packages/ui/src/components/Keycaps/useHeldKeys.ts:22 (up)
- scenario: Command is already down when the target gains focus (or when the hook mounts / the story page is clicked with Cmd held), so `MetaLeft` never enters `held`. The user presses K (added; macOS sends no key-up for it while Command is down), then releases Command. `up` sees `!prev.has('MetaLeft')` and returns `prev` before the Apple sweep, so K is never released and stays lit until focus leaves the window. The sweep should run on any Meta key-up, whether or not Meta itself was recorded.
- evidence: read
- severity: low

## A key with no layout box (display:none) is measured at scale ≤ 0 and drags its whole bank to `minScale`
- where: packages/ui/src/components/Keycaps/legendMeasure.ts:44 (readRoom), :69 (fitForm)
- scenario: one `KeyCap` inside a `KeyBank` is hidden by a consumer's CSS (a responsive rule hiding part of a cluster, a collapsed row). `clientWidth`/`clientHeight` are 0, so `width`/`height` come out ≤ 0 (minus padding and the 4px slack) and `fitForm` returns a scale ≤ 0 instead of null. The member counts as shared, so `sharedScale` floors the bank at `minScale` and every visible key prints shrunk while the hidden one stays hidden. `readRoom` checks only `size`; it should return null (unmeasurable) when the box has no room.
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

<!-- done: 3 findings, files read: 28 -->
