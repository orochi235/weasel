I couldn't write `.skulkr/out/findings.md` because permission to write there was denied, so the whole document is below.

## A `sheet()` frame inside a PropertyPanel inherits the panel's backdrop blur and title inset
- where: packages/ui/src/components/MotifFrame/motifs/sheet.module.css:10 (`.sheet`), with packages/ui/src/components/MotifFrame/MotifFrame.module.css:29 (the `.frame` slot block)
- scenario: Put `<DefaultMotif group={sheet()}>` or `<MotifFrame motif={sheet()}>` inside a `PropertyPanel`. `sheet` reads `--_s-blur` and `--_s-title-inset`, but only `.panel[data-motif]` in PropertyPanel.stance.css declares them. The generic `.frame` slot block declares neither, so a frame that isn't a panel inherits the enclosing panel's values (`--wzl-panel-blur` → `--wzl-glass-blur: 3px`). The inner frame then gets `backdrop-filter: blur(3px)`. As the rule's own comment warns, that makes it a containing block for `position: fixed` descendants, so popovers and menus inside it are placed wrong. It also picks up the panel's title padding. It should draw with no blur (the `none` fallback), as the same frame does outside a panel.
- evidence: read
- severity: medium

## `drawn('')` is true, so an empty-string title makes a named group with an empty heading
- where: packages/ui/src/components/MotifFrame/root.ts:21 (`drawn`), used at packages/ui/src/components/MotifFrame/MotifFrame.tsx:100 and in every motif
- scenario: Pass `<MotifFrame title="">` or `title={label ?? ''}`. React draws nothing for `''`, but `drawn('')` returns true, although its own doc says it matches what React draws. The root gets `role="group"` with `aria-labelledby` pointing at an empty span, which is a group with an empty accessible name. `headed()` is true, so each motif draws an empty heading:
  - `rule`: an empty `<h3>` between the two rules
  - `notch`: an empty legend
  - `tab`: an empty tab
  - `titlebar`: an empty strip

  It should behave as untitled: no role and no heading.
- evidence: read
- severity: low

## DefaultMotif's doc says a `panel` kind reads `--wzl-panel-*` slots in any motif; `MotifFrame kind="panel"` does not
- where: packages/ui/src/components/MotifFrame/MotifFrame.tsx:39 (`DefaultMotif` JSDoc), and MotifFrame.tsx:96-104, where the root is built with no marker for its kind
- scenario: Render `<MotifFrame kind="panel" title="X">`. `kind` only picks the default motif. The root gets `s.frame` and the generic frame slots (sunken surface, uppercase title at `--wzl-font-size-sm`), never the `--wzl-panel-*` slots, which only `PropertyPanel`'s own `.panel[data-motif]` class supplies. So the doc's "A kind decides a frame's colors and title type" is false for MotifFrame itself.
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