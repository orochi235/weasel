# Findings: ui.components.MotifFrame (round 58)

## `<DefaultMotif>` given a kind as `undefined` erases the outer default instead of keeping it
- where: packages/ui/src/components/MotifFrame/MotifFrame.tsx:43 (DefaultMotif)
- scenario: `<DefaultMotif group={titlebar()}>…<DefaultMotif group={desktop ? stereo() : undefined}>` with `desktop` false. `{ ...outer, ...kinds }` copies the own key `group: undefined` over the outer `titlebar()`, so `inherited.group` is `undefined` and frames below fall through to `fallback` / `rule()`. The doc says "A kind left out keeps the motif from further up", and a conditionally-passed prop is the common way to leave one out. The same applies to `named`: `{ ...outerNamed, ...named }` lets `named={{ x: undefined }}` hide an outer `x`. Undefined values should be dropped before merging.
- evidence: read
- severity: medium

## Most motifs draw a heading for an untitled frame; only `sheet` and `well` keep the "untitled draws no heading" contract
- where: packages/ui/src/components/MotifFrame/motifs/rule.tsx:18 (rule.render), motifs/divider.tsx:19 (divider.render), also titlebar.tsx:20, tab.tsx:21, stereo.tsx:33, notch.tsx:21, plaque.tsx:29
- scenario: `HeadingParts.title` says "Absent for an untitled frame: an untitled panel draws no heading", and `PropertyPanel.render.test.tsx` checks "omits the heading when no title is given", but only for the default `sheet`. An untitled `<MotifFrame>` (kind `group` → `rule()`) renders an empty `<h3>` with two `<hr>`s and an empty span. Under `<DefaultMotif panel={titlebar()}>` (the `EveryKind` story) an untitled `PropertyPanel` draws an empty title strip; `divider` draws an empty `<h4>` and a rule; `notch` draws an empty `<legend>` whose `padding-inline` still cuts a gap in the top border; `tab` draws an empty tab; `stereo` an empty bar. The empty heading elements are also an accessibility failure (axe `empty-heading`). The expected output is what `sheet`/`well` do: no heading when `title`, `twisty`, `leading` and `actions` are all absent.
- evidence: read
- severity: medium

## `inline` is dropped for an untitled frame in `sheet` and `well` but drawn by every other motif
- where: packages/ui/src/components/MotifFrame/motifs/sheet.tsx:16 (sheet.render), motifs/well.tsx:28 (well.render)
- scenario: `<MotifFrame kind="panel" inline={<Switch/>}>` with no title. `sheet` builds `titled` only when `title != null`, and `inline` lives only inside it, so the switch silently vanishes. `well`'s `row` test leaves `inline` out, so it vanishes there too. `rule`, `divider`, `titlebar`, `tab`, `stereo`, `notch` and `plaque` render `inline` regardless of the title. The same prop is answered two ways depending on the motif. `disabled`'s doc names `inline` as the switch that can turn a frame back on, so dropping it can leave the frame impossible to re-enable.
- evidence: read
- severity: low

## A `well({ label })` styles the titles of every well nested inside it
- where: packages/ui/src/components/MotifFrame/motifs/well.module.css:54 (`.well[data-label='wide'] .title`, and `wider` at :59)
- scenario: An outer `well({ label: 'wider' })` holding an inner `well()` with no `label`. The descendant selector matches the inner well's `.title` too (CSS module class names are shared across instances), so the inner title is uppercased and tracked even though its params ask for neither. The selector should be scoped to its own heading, e.g. `.well[data-label='wide'] > .head > .row > .title`.
- evidence: read
- severity: low

## `stereo`'s extra body inset uses physical sides while the bar's placement follows the inline direction, so they part in RTL
- where: packages/ui/src/components/MotifFrame/motifs/stereo.module.css:102 (`.stereo[data-side='left'] > .body`), :106
- scenario: In `dir="rtl"`, `flex-direction: row` for `side: 'left'` puts the bar on the right (flex rows follow the inline direction). But the body's `border-left` inset stays on the left, on the side away from the bar. The rows then crowd the bar, and the extra room goes to the outer edge. `side: 'right'` is mirrored the same way. Either both should be physical (with `direction`-independent placement) or both logical (`border-inline-start`/`-end`).
- evidence: read (reasoned from the CSS; not rendered)
- severity: low

## `plaque({ mix })` outside 0–100 makes the whole fill and ink invalid
- where: packages/ui/src/components/MotifFrame/motifs/plaque.tsx:25 (plaque.render) / plaque.module.css:5
- scenario: `plaque({ mix: 120 })`, `plaque({ mix: -10 })` or a NaN from a slider writes `--wzl-plaque-mix: 120%`. `color-mix()` rejects percentages outside 0%–100%, so `--_edge` becomes invalid at computed-value time. The background goes transparent, and `--_edge-ink`, `--wzl-fg` and the accent overrides in `.content` all go invalid with it, which leaves the title and controls with no defined color. The factory should clamp `mix` to [0, 100], or reject a non-finite value.
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

<!-- done: 6 findings, files read: 26 -->
