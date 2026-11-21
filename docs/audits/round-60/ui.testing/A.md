I couldn't write `.skulkr/out/findings.md` because the write permission was denied, so the whole document is below. The brief names commit deaf03bd, but that commit isn't in this repo. I read the files from the checked-out tree instead (HEAD 6f634fabe1), where nothing under `packages/ui/src/testing` has local changes.

# Audit round 60, area `ui.testing`

## `painted` quietly keeps the previous fill when given a color the canvas cannot parse, so a test can pass without checking anything
- where: packages/ui/src/testing/paintedContrast.ts:6 (painted)
- scenario: Canvas 2D ignores an assignment to `fillStyle` that it cannot parse. If `color` is unparseable (an empty `getPropertyValue` result, a `var(--…)` string, `light-dark(…)`, a typo), the second `fillRect` paints `ground` again and `painted` returns `ground`'s channels as if they were `color`'s. If `ground` is the unparseable one, the canvas paints the default `#000000` under `color`. Neither case throws. In `gloss.browser.test.tsx:79`, `expect(painted(topFill(el), 'magenta')).toEqual(MAGENTA)` passes whenever `topFill` returns something the canvas rejects, which is exactly the outcome the assertion is meant to rule out. `lineContrast` with a bad `line` returns 1. It should throw when `fillStyle` does not change after an assignment.
- evidence: read
- severity: medium

## `trigger(label)` builds a RegExp from the label without escaping it and without anchoring it
- where: packages/ui/src/testing/selectRow.ts:7 (trigger); `pick` at :10 inherits it
- scenario: `trigger('Size (px)')` compiles to `/(?<!About )Size (px)/`. The parentheses become a group, so the pattern matches the text "Size px" and never "Size (px)", and `getByRole` throws "unable to find". Labels containing `+ . ? * [` misbehave the same way. Because the pattern is unanchored, `trigger('Mode')` also matches the triggers of rows labelled "Mode select" or "Mode menu" (both drawn by `paramsText.ts`'s `LEAVES_BY_KIND.enum`), and a trigger whose value text contains the label. Either case throws "multiple elements". The comment says the name is "value then label", so the pattern should escape the label and anchor it at the end.
- evidence: read
- severity: medium

## `painted` and `lineContrast` report a translucent result as if it were opaque
- where: packages/ui/src/testing/paintedContrast.ts:10 (painted), :22 (lineContrast)
- scenario: The canvas starts transparent, and `getImageData` returns unpremultiplied RGB with alpha dropped. Take `ground = 'rgba(255,255,255,0.5)'` (a glass menu's `backgroundColor`, which `ContextMenuHost.browser.test.tsx:76` passes as `fill`): `painted(fill, fill)` returns `[255,255,255]`, a fully white ground. What a screen actually shows depends on the backdrop. The docstring promises "the three channels a screen shows", and the WCAG ratio is computed against a ground that is never drawn.
- evidence: read
- severity: low

## `storiesOf` composes CSF stories differently from forge's loader: it ignores `include/excludeStories` and CSF2 hoisted annotations, and drops `parameters` and `globals`
- where: packages/ui/src/testing/composeStory.tsx:62-64 (storiesOf), :29-31 (csf)
- scenario: forge's `loadCsfModule` (packages/forge/src/csf/loadCsfModule.tsx:157-175) skips exports named by `includeStories`/`excludeStories`. It also spreads a CSF2 function's own `.args`/`.decorators` into its spec (`{ ...value, render: value }`), and passes merged `parameters` and `globals`. `storiesOf` does none of this:
  - an `excludeStories: ['helper']` module renders `helper` as a story, and the teardown suite runs it;
  - `Primary.args = { tone: 'warn' }` is dropped, and so are `Primary.decorators`;
  - a render or decorator that reads `ctx.parameters.x` or `ctx.globals.theme` gets `undefined`.

  The file's own comment says it composes a story "as forge draws it". The same question is answered two ways, and the teardown harness (`teardown.tsx:22`) tests a different story from the one forge shows.
- evidence: read
- severity: low

## `readModuleCss` inlines only single-quoted `./` imports, though its doc says "each relative `@import`"
- where: packages/ui/src/testing/readModuleCss.ts:10 (readModuleCss)
- scenario: `@import "./a.css";`, `@import '../shared/rows.css';`, `@import url('./a.css');` and `@import './a.css' layer(base);` all stay in the output as literal text. A test asserting a rule from that sheet then fails, and a test asserting a rule is absent passes when it should not. A commented-out `/* @import './old.css'; */` does get inlined. The output no longer matches "a stylesheet's text as the bundler assembles it".
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

<!-- done: 5 findings, files read: 14 -->