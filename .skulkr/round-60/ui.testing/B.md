I couldn't write `.skulkr/out/findings.md` because permission was denied, so the whole document is below.

The brief names commit deaf03bd8ed407174fa289a1262d2699ffbe97db, but that commit isn't in this repository. I read HEAD instead (6f634fabe1), which has no uncommitted changes under `packages/ui/src/testing`.

## storiesOf runs every non-story export of a native story file as a CSF story, where forge takes only `story()` exports
- where: packages/ui/src/testing/composeStory.tsx:62 (storiesOf)
- scenario: a native story file (`export default meta({...})`) that also exports a helper, e.g. `export function sampleRows(n) {…}`. forge's `loadStory` sees the native meta and calls `loadNativeModule`, which skips every export not marked `[NATIVE] === 'story'` (packages/forge/src/story/native.ts:17). storiesOf does not branch on the meta: it sends each function export to `csf(meta, { render: value })`. The teardown harness then mounts `sampleRows(args, ctx)` as a story, so it tests something forge never shows: the helper either throws or its return value gets rendered. storiesOf should choose exports the way forge's loader does, where a native meta takes only native-story exports. No ui story file exports a helper today (checked), so nothing fails yet.
- evidence: read
- severity: medium

## storiesOf ignores a CSF meta's includeStories/excludeStories
- where: packages/ui/src/testing/composeStory.tsx:62 (storiesOf)
- scenario: `export default { component: Tag, excludeStories: /Data$/ }; export const sampleData = {…}`. forge skips `sampleData` (packages/forge/src/csf/loadCsfModule.tsx:157-158, and in the index at packages/forge/src/vite/indexFile.ts:132). storiesOf treats it as a story object with no render, falls back to `meta.component`, and mounts `<Tag {...meta.args} {...sampleData.args}/>` under the export name `sampleData`. The teardown suite then fails or passes on a case that is not a story. Two places decide which exports are stories, and they answer differently.
- evidence: read
- severity: low

## storiesOf drops a CSF 2 function story's hoisted annotations (`Story.args`, `Story.decorators`)
- where: packages/ui/src/testing/composeStory.tsx:63 (storiesOf)
- scenario: `const Template = (args) => <Button {...args}/>; export const Primary = Template.bind({}); Primary.args = { label: 'Go' }; Primary.decorators = [Frame];`. forge spreads the function's own properties into the spec (`{ ...value, render: value }`, loadCsfModule.tsx:162), so it renders with `label: 'Go'` inside `Frame`. storiesOf passes only `{ render: value }`, so the story renders with the meta's args alone and without its decorators. Any provider those decorators supply is missing, and the leak check runs on a different tree from the one forge draws.
- evidence: read
- severity: low

## csf()'s story context leaves out the story's own `globals` and its display name
- where: packages/ui/src/testing/composeStory.tsx:29 (csf)
- scenario: take a story with `globals: { theme: 'dark' }` (on itself or its meta) whose render or decorator reads `ctx.globals.theme`. forge passes `{ ...globals, ...meta.globals, ...spec.globals }` (loadCsfModule.tsx:175, 189). composeStory passes `globals: {}`, so the story takes its default branch instead. Likewise, `ctx.name` is the export name, where forge uses `spec.name || spec.storyName || storyNameFromExport(...)`.
- evidence: read
- severity: low

## selectRow's `trigger` builds a RegExp from the label without escaping it
- where: packages/ui/src/testing/selectRow.ts:7 (trigger)
- scenario: `pick('Size (px)', 'Large')` builds `/(?<!About )Size (px)/`. The parentheses become a group, so the pattern matches "Size px" and never the button named "Large Size (px)", and getByRole throws "Unable to find role button". A label containing `+`, `?`, `[` or `.` likewise errors or matches the wrong row. Current callers (the Properties tests and PlotDataPanel) pass plain words only.
- evidence: read
- severity: low

## painted() composites over a transparent canvas, so a translucent or transparent ground does not give "what a screen shows"
- where: packages/ui/src/testing/paintedContrast.ts:4 (painted), :22 (lineContrast)
- scenario: `lineContrast(cs.borderTopColor, cs.backgroundColor)` where the computed background is `rgba(0, 0, 0, 0)` or a translucent fill such as `rgb(255 255 255 / 0.5)`. The canvas starts transparent, and getImageData returns un-premultiplied RGB with the alpha discarded. A transparent fill therefore reads as black `[0,0,0]`, and a half-white fill reads as pure white, regardless of what is behind it. The contrast is then measured against a color nobody sees. The callers (the sunkenBox, rule and ContextMenuHost browser tests) pass computed backgrounds; I did not check whether any of them is translucent today.
- evidence: read (the effect on current callers is inference)
- severity: low

## readModuleCss inlines only `./`-relative, single-quoted @imports, though its doc says "each relative @import"
- where: packages/ui/src/testing/readModuleCss.ts:10 (readModuleCss)
- scenario: a sheet with `@import '../shared/row.css';` or `@import "./family.css";` is not matched by `/@import '(\.\/[^']+)';/`. The import stays in the output as written, and the rules it would bring in are missing. A test reading a selector from that sheet then fails or passes vacuously, with no sign that an import was skipped. Two sheets that import each other recurse until the stack overflows. Today only Properties.module.css imports anything, all in the `./` single-quoted form.
- evidence: read
- severity: low

## Files read
packages/ui/src/testing/badge.ts
packages/ui/src/testing/composeStory.tsx
packages/ui/src/testing/contextMenu.ts
packages/ui/src/testing/geometry.ts
packages/ui/src/testing/icon.ts
packages/ui/src/testing/labViews.ts
packages/ui/src/testing/paintedContrast.ts
packages/ui/src/testing/paramsText.ts
packages/ui/src/testing/prefs.ts
packages/ui/src/testing/readModuleCss.ts
packages/ui/src/testing/selectRow.ts
packages/ui/src/testing/sweep.ts
packages/ui/src/testing/teardown.tsx
packages/ui/src/testing/withIcons.tsx

<!-- done: 7 findings, files read: 14 -->