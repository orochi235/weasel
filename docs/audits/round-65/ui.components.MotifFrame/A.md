# Audit round 65 — ui.components.MotifFrame

## A plaque (and a titlebar strip) with `emphasis` set doesn't redraw its controls in the plaque's ink
- where: packages/ui/src/components/MotifFrame/motifs/plaque.module.css:14 (`.content`); same gap at packages/ui/src/components/MotifFrame/motifs/titlebar.module.css:19 (`.strip`)
- scenario: `<MotifFrame motif={plaque()} tint={3} emphasis="high" actions={<Button variant="ghost">clear</Button>}>`. `useAppearance` puts `--wzl-emphasis-fg: var(--wzl-accent-fg)` inline on the root, so it is computed there, against the root's accent (the theme's accent, or `.frame[data-tint]`'s `accent-strong`, which is 70% tint), before `.content` redefines `--wzl-accent-fg`/`--wzl-fg` to the plaque ink. A ghost button's text reads `var(--wzl-emphasis-fg, var(--wzl-fg))` (Button.module.css:240), so it gets the tint-ish accent on a 100% tint fill and becomes unreadable. `emphasis="low"` gives the theme's muted fg in the same way. The plaque's documented contract ("the title, the text and the controls on it are redrawn in black or white") holds only while `emphasis` is unset. `.strip` has the same gap: it redraws `--wzl-fg` to the strip ink but not `--wzl-emphasis-fg`, so the actions on an emphasized titlebar frame sit in the accent color on the strip. It should also re-point `--wzl-emphasis-fg` (to the ink, or a mix of it) in `.content` and in `.strip`.
- evidence: read (appearance.ts:50, Button.module.css:240, plaque.module.css:14-31, titlebar.module.css:19-22)
- severity: medium

## An empty-string title counts as a title: an empty heading, and a group named by nothing
- where: packages/ui/src/components/MotifFrame/root.ts:20 (`drawn`), used at MotifFrame.tsx:99 and in every motif
- scenario: `<MotifFrame title="">` (e.g. a schema group or `PropertyGroup` whose label is `''`). `drawn('')` is true, so the root gets `role="group"` plus `aria-labelledby` pointing at an empty span. `rule` draws an `<h3>` holding two rules and nothing between them, `sheet` an empty `<h2>` with its 8px gap, and `titlebar`/`tab`/`stereo` an empty strip, tab or bar. React draws nothing for `''`, and the d14d16a2ce commit made "no heading and no empty title bar for an untitled frame" the rule. An empty string should count as not drawn here, or the title should be normalized in `MotifFrame`.
- evidence: read
- severity: low

## The tab motif squares the box's corner where the tab doesn't meet it
- where: packages/ui/src/components/MotifFrame/motifs/tab.module.css:9 (`.tabRow` padding) vs :52-58
- scenario: `tab()` (align `start`, the default). `.tabRow` has `padding-inline: var(--wzl-radius-md)`, so the tab starts `radius-md` in from the box's leading edge, but `.box` still sets `border-start-start-radius: 0` on the grounds that "the tab grows out of the box's edge". The result is a square outer corner with a bare `radius-md` stretch of top border between it and the tab: neither a rounded corner nor a tab flush with the edge. `align: 'end'` does the same at the far corner. Either the padding should go for the aligned end, or the corner should stay rounded.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/MotifFrame/MotifFrame.module.css
packages/ui/src/components/MotifFrame/MotifFrame.stories.module.css
packages/ui/src/components/MotifFrame/MotifFrame.stories.tsx
packages/ui/src/components/MotifFrame/MotifFrame.tsx
packages/ui/src/components/MotifFrame/index.ts
packages/ui/src/components/MotifFrame/motifs/divider.module.css
packages/ui/src/components/MotifFrame/motifs/divider.tsx
packages/ui/src/components/MotifFrame/motifs/index.ts
packages/ui/src/components/MotifFrame/motifs/notch.module.css
packages/ui/src/components/MotifFrame/motifs/notch.tsx
packages/ui/src/components/MotifFrame/motifs/plaque.module.css
packages/ui/src/components/MotifFrame/motifs/plaque.tsx
packages/ui/src/components/MotifFrame/motifs/rule.module.css
packages/ui/src/components/MotifFrame/motifs/rule.tsx
packages/ui/src/components/MotifFrame/motifs/sheet.module.css
packages/ui/src/components/MotifFrame/motifs/sheet.tsx
packages/ui/src/components/MotifFrame/motifs/stereo.module.css
packages/ui/src/components/MotifFrame/motifs/stereo.tsx
packages/ui/src/components/MotifFrame/motifs/tab.module.css
packages/ui/src/components/MotifFrame/motifs/tab.tsx
packages/ui/src/components/MotifFrame/motifs/titlebar.module.css
packages/ui/src/components/MotifFrame/motifs/titlebar.tsx
packages/ui/src/components/MotifFrame/motifs/well.module.css
packages/ui/src/components/MotifFrame/motifs/well.tsx
packages/ui/src/components/MotifFrame/root.ts
packages/ui/src/components/MotifFrame/types.ts

<!-- done: 3 findings, files read: 26 -->
