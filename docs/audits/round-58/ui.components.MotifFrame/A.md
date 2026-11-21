## Untitled frames draw an empty heading in rule, divider, notch, tab, titlebar, stereo and plaque, while sheet and well draw none
- where: packages/ui/src/components/MotifFrame/motifs/rule.tsx:18 (rule.render); also divider.tsx:22, notch.tsx:21, tab.tsx:21, titlebar.tsx:20, stereo.tsx:33, plaque.tsx:29
- scenario: `<MotifFrame motif={rule()} level={5}>` with no `title`, as `ObjectLeaf` renders an unlabeled section (`title={labeled ? section.name : undefined}`, `motif={section.motif}`, packages/ui/src/components/PanelCells/ObjectLeaf.tsx:88). A schema naming `motif: 'rule'` gets an empty `<h5>` (two hrs and an empty span) in the heading outline, which a screen reader reads as a blank "heading level 5". `divider` does the same with an `<h4>`, and the other motifs draw an empty label bar, tab or strip with its padding. `sheet` (`title != null &&`, sheet.tsx:16) and `well` (`row`, well.tsx:28) skip the heading when the title is absent. HeadingParts.title says "Absent for an untitled frame: an untitled panel draws no heading", so changing the motif changes whether the frame has a heading at all. Every motif should skip the heading element (and a bar holding nothing) when it has no title.
- evidence: read
- severity: medium

## An untitled notch frame is named by its legend's controls
- where: packages/ui/src/components/MotifFrame/motifs/notch.tsx:20 (notch.render)
- scenario: `<MotifFrame motif={notch()} actions={<button>Remove</button>}>` with no title. MotifFrame drops `role`/`aria-labelledby` from the root because the frame is untitled ("An untitled frame is not a named group"), but a `<fieldset>` is a group by default and takes its name from its first `<legend>`. The notch always renders the legend, so the frame becomes a group named "Remove" (or by its inline control, leading or twisty). The legend should be left out when there is no title, or the title should get a legend of its own and the actions sit outside it.
- evidence: read
- severity: low

## `<DefaultMotif panel={undefined}>` wipes out the outer default instead of keeping it
- where: packages/ui/src/components/MotifFrame/MotifFrame.tsx:43 (DefaultMotif)
- scenario: `<DefaultMotif group={titlebar()}><DefaultMotif group={desktop ? stereo() : undefined}>…` with `desktop` false. `{ ...outer, ...kinds }` copies the own key `group: undefined` over the outer `titlebar()`, so `inherited.group` becomes undefined and the frame drops to its `fallback` or `rule()`. The doc says "A kind left out keeps the motif from further up". A conditional prop is the usual way to leave a kind out, so undefined kinds should be skipped when merging. `named` has the same problem: an entry `{ x: undefined }` hides an outer `x`.
- evidence: read
- severity: low

## sheet and well silently drop `inline` when the frame has no title
- where: packages/ui/src/components/MotifFrame/motifs/sheet.tsx:16 (sheet.render); well.tsx:37
- scenario: `<MotifFrame kind="panel" inline={<Switch/>}>` with no title. `titled = title != null && (<Heading>…{inline}</Heading>)`, so the inline control is never rendered. With `well` the control is dropped as well, and the `row` test (well.tsx:28) doesn't count `inline`, so an inline-only frame has no row. rule, divider, notch, tab, titlebar, stereo and plaque all render `inline` whether or not there is a title, so whether a caller's control appears depends on the motif.
- evidence: read
- severity: low

## The titlebar clips the focus ring of an `inline` control in the title strip
- where: packages/ui/src/components/MotifFrame/motifs/titlebar.module.css:36 (.mid); titlebar.tsx:23
- scenario: `inline` (e.g. the control PrefsForm's `headingInline` puts in the heading) is rendered inside `.mid`, which has `overflow: hidden` so the title can ellipsize. The outline of a focused switch or button in `inline`, or anything of it that extends past `.mid`'s box (the strip's padding is only `--wzl-space-1` tall), is cut off, so keyboard focus on that control is barely visible. Only the label should be clipped and ellipsized, with `inline` outside the overflow box.
- evidence: read
- severity: low

## Rule and divider treat `null`/`false` actions and leading as present, and sheet/well as absent
- where: packages/ui/src/components/MotifFrame/motifs/rule.tsx:32 (rule.render); divider.tsx:27; notch.tsx:21,28
- scenario: `actions={canRemove && <RemoveButton/>}` with `canRemove` false passes `false`. rule checks `=== undefined`, so it switches to the `headRow` layout and renders an empty `.actions` span, whose flex gap pushes the title off center. divider adds an empty span and gap, and notch sets `data-actions`, which stretches the legend across the full width (`width: 100%; margin-inline: 0`) and draws an empty run, which overrides `align: 'center'`. sheet and well test `!= null` and draw nothing. The two checks give different results for the same props.
- evidence: read
- severity: low

## Rule draws its tint edge on the physical left, so in RTL it ends up on the trailing edge
- where: packages/ui/src/components/MotifFrame/motifs/rule.module.css:12 (.rule[data-tint])
- scenario: a tinted PropertyGroup under `dir="rtl"`. `border-left: 4px solid var(--wzl-tint)` puts the "which of a list" edge on the trailing side. Everything else in the motif uses logical properties (`margin-inline-*`, `inset-inline-*`), and well's equivalent edge uses `border-inline-start`. It should be `border-inline-start`.
- evidence: read
- severity: low

## sheet always sets a backdrop-filter, making every panel a containing block for fixed descendants
- where: packages/ui/src/components/MotifFrame/motifs/sheet.module.css:9 (.sheet)
- scenario: `backdrop-filter: blur(var(--_s-blur, 0))` is not `none` even when no blur is set, and any value other than `none` makes the element a containing block for `position: fixed` and absolute descendants and starts a stacking context. Any fixed-position element rendered inline inside a panel (an overlay given a portal target within the panel, or a consumer's fixed tooltip) is positioned and clipped against the sheet instead of the viewport, and gets a compositing layer per panel. When `--_s-blur` is unset the property should resolve to `none` (e.g. by defaulting the whole value to a variable that falls back to `none`).
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

<!-- done: 8 findings, files read: 26 -->
