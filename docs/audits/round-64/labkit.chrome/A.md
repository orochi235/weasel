I couldn't write `.skulkr/out/findings.md` because the write permission was declined, so the full findings document follows.

# Audit round 64: labkit.chrome (blind reviewer)

Note: the brief names frozen commit 49e5a07e6aecc7037a5e3692706cf28dd58211c4, but that commit doesn't exist in this clone (`git cat-file` fails). I read the working tree at HEAD 6f634fabe1 instead. `packages/labkit/src/chrome` has no uncommitted changes.

## The Marks sidebar section checks staleness against the raw config, but the canvas checks against the resolved config
- where: packages/labkit/src/chrome/builtins.tsx:291 (builtinContributions, `marks` section)
- scenario: an instrument declares `annotations`, and one target's `positionDependsOn` names a config path that is unpinned (auto).
  - `ctx.config` is `record.config` (useTrialChromeContext.ts:148). It is raw: it holds the value that un-pinning writes back.
  - The overlay gets `useTrialConfig`'s config instead, which `useResolvedConfig` passes through `resolveAutoConfig` (Trial.tsx:92,189). Marks are stamped (`seenValues`, markTools.ts:73) and drawn (`isStale`, drawOne.ts:50) against that resolved config.
  - `<MarkList config={ctx.config}>` calls `marks.isStale(a, config)` with the raw value.
  - Result: whenever the raw and resolved values of an auto path differ, the list marks as stale a mark the canvas draws as current, or the other way round. MarkList should get the same resolved config the overlay uses.
- evidence: read
- severity: medium

## SidebarPanes gives the spare height to the last open section and ignores `SidebarSection.fill`
- where: packages/labkit/src/chrome/regions/SidebarPanes.tsx:173 (SidebarPanes, `filler`)
- scenario: `SidebarSection.fill` is documented as "Take the pane's spare height and hold the body to it".
  - The docked `SidebarRegion` honors this in CSS (SidebarRegion.less:231).
  - `SidebarPanes` draws the lab's sidebar and aside. There, `filler` is just the last open section that isn't a `render` contribution. Each section sits in its own windease panel, so the sibling CSS rule never matches.
  - Concrete case: forge's `CSS_VARS_SECTION` (`region: 'aside'`, `fill: true`) with any other aside section after it. The later section takes the spare height. The CSS Vars body is still set to `overflow: hidden` (SidebarRegion.less:283), so it is clipped to its default or dragged height instead of filling what is left.
  - Fix direction: when an open section has `fill`, make it the filler.
  - SidebarPanes.test.tsx:13,36 gives `a` `fill: true` and asserts that `c` takes the rest, so the test pins this behavior rather than catching it.
- evidence: read
- severity: medium

## A sidebar section's props are mapped from `SidebarSection` in two places
- where: packages/labkit/src/chrome/regions/SidebarPanes.tsx:116 (Pane) vs packages/labkit/src/chrome/regions/SidebarRegion.tsx:89 (sectionProps)
- scenario: commit ba22149 added `sectionProps` as the one mapping from a `SidebarSection` to `<Section>` props, used by `SidebarRegion` and torn-out sections. `Pane` in `SidebarPanes` writes the same seven fields out by hand. They agree today. A field added later to `sectionProps` would be silently dropped in the lab's sidebar and aside, the way `fill` was once missed on the torn-out path.
- evidence: read
- severity: low

## The `SuppressedAndReplaced` story replaces nothing
- where: packages/labkit/src/chrome/ChromeRegions.stories.tsx:82 (SuppressedAndReplaced)
- scenario: the story's doc says "A consumer dropping a built-in and adding its own in its place".
  - It suppresses `snapshot`, a title bar built-in.
  - It adds a toolbar item with id `export`, a crosshair glyph and an `onActivate` that does nothing.
  - `FullInstrument` declares no `annotations`, so there is no built-in `export` for it to replace, and nothing takes `snapshot`'s place.
  - Giving the instrument `annotations` would make the story throw on the duplicate `export` id instead.
- evidence: read
- severity: low

## `LabRegion`'s doc leaves out the `aside` region it declares
- where: packages/labkit/src/chrome/labTypes.ts:14 (LabRegion)
- scenario: the doc describes `header`, `footer`, `palette`, `sidebar` and `overlay`. `aside` is in the union but not described, so a reader can't learn where an `aside` contribution goes. Similarly, `EveryRegion`'s doc (ChromeRegions.stories.tsx:21) says "all five trial regions", but `TrialRegion` has six.
- evidence: read
- severity: low

## Files read
packages/labkit/src/chrome/ChromeRegions.stories.tsx
packages/labkit/src/chrome/LabChrome.tsx
packages/labkit/src/chrome/builtins.tsx
packages/labkit/src/chrome/index.ts
packages/labkit/src/chrome/labTypes.ts
packages/labkit/src/chrome/merge.ts
packages/labkit/src/chrome/regions/OverlayRegion.tsx
packages/labkit/src/chrome/regions/PaletteRegion.less
packages/labkit/src/chrome/regions/PaletteRegion.tsx
packages/labkit/src/chrome/regions/SidebarPanes.stories.tsx
packages/labkit/src/chrome/regions/SidebarPanes.tsx
packages/labkit/src/chrome/regions/SidebarRegion.less
packages/labkit/src/chrome/regions/SidebarRegion.stories.tsx
packages/labkit/src/chrome/regions/SidebarRegion.tsx
packages/labkit/src/chrome/regions/StatusRegion.tsx
packages/labkit/src/chrome/regions/TitleBarRegion.tsx
packages/labkit/src/chrome/regions/ToolbarRegion.tsx
packages/labkit/src/chrome/regions/ViewportRegion.less
packages/labkit/src/chrome/regions/ViewportRegion.tsx
packages/labkit/src/chrome/regions/groupsOf.ts
packages/labkit/src/chrome/trialActions.tsx
packages/labkit/src/chrome/types.ts

<!-- done: 5 findings, files read: 22 -->