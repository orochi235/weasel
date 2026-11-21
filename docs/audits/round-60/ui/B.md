# Audit round 60 — area `ui` — reviewer findings

I couldn't write `.skulkr/out/findings.md` because the write permission was denied, so the whole document is here.

The frozen commit deaf03bd8ed407174fa289a1262d2699ffbe97db is not in this repository (`git cat-file` reports a bad object). I read the files from the working tree as I found it, at HEAD 6f634fabe1. Some files in `packages/ui/src` have uncommitted changes from another session, so line numbers may not match the frozen commit.

## useScrollSpy never subscribes when its container mounts after the hook's first effect
- where: packages/ui/src/useScrollSpy.ts:112-118 (useScrollSpy, the subscribe effect)
- scenario: a caller renders its scrolling container conditionally, for example behind a loading state or a tab. `rootRef.current` is null when the effect first runs, so the effect returns early. Its deps (`rootRef`, `measure`) don't change when the ref is attached later. No `scroll` listener is ever added, and `active` stays null until `ids` or `slack` happen to change. It should pick up a container attached after mount, as `useRovingTabIndex` does with its `listened` state (useRovingTabIndex.ts:193, 233-240).
- evidence: read
- severity: medium

## useScrollSpy's active section goes stale when the container resizes or its sections reflow without a scroll
- where: packages/ui/src/useScrollSpy.ts:93-118 (`measure` runs only on mount, on `scroll`, and when a `scrollTo` hold ends)
- scenario: a reader is scrolled to the end of a pane, so `heightAtEnd` makes the last short section win. Then the window grows until the container no longer scrolls, or a section above expands or collapses. No `scroll` event fires, so `active` keeps the section the old layout chose and the rail marks the wrong entry until the user scrolls. Nothing observes size: there is no ResizeObserver on the root or the sections.
- evidence: read
- severity: low

## useRovingTabIndex counts hidden items as stops, so an arrow key can move the tab stop onto an item that can't take focus
- where: packages/ui/src/useRovingTabIndex.ts:70-77 (isEnabled/canStop), 242-268 (onKeyDown), 196-211 (place)
- scenario: an item still matches `itemSelector` but is hidden with `hidden` or `display: none`, for example a button collapsed into an overflow. The arrow key does this:
  - `rovingTarget` lands on the hidden item, because it counts as enabled.
  - `onNavigate(next)` commits its index, so a bar whose selection follows focus selects an item nobody can see.
  - `el.focus()` silently does nothing.
  - `place(el)` gives the hidden item `tabIndex = 0` and the item that still has focus `-1`.

  After Tab leaves, Shift+Tab back skips the whole container, because its only tab stop can't render. `createDomFocusScope` in the same package filters out `[hidden]` and unrendered elements, so the two answer the same question differently.
- evidence: read
- severity: low

## createDomMeasureEnv measures every document's text on a canvas owned by the first document it saw
- where: packages/ui/src/createDomMeasureEnv.ts:5, 20 (module-level `context`)
- scenario: the first `createDomMeasureEnv(el)` call creates the shared 2D context in `el.ownerDocument`, for example a story iframe. Later calls for elements in another document, such as the main page or a popout, reuse that canvas. A canvas resolves `context.font` against its own document's font set. So a web font loaded through `document.fonts` or `@font-face` only in the second document isn't available: widths and ascent/descent come back in the fallback face, and labels get sized wrong. If the first document is torn down (iframe removed), every later measurement runs on a canvas from a detached document. The context should be cached per document, for example in a `WeakMap<Document, CanvasRenderingContext2D>`.
- evidence: read
- severity: low

## Files read
packages/ui/src/alongTrack.ts
packages/ui/src/byRank.ts
packages/ui/src/color/ColorRamp.stories.module.css
packages/ui/src/color/ColorRamp.stories.tsx
packages/ui/src/createDomFocusScope.ts
packages/ui/src/createDomMeasureEnv.ts
packages/ui/src/cssPx.ts
packages/ui/src/cursors/cursors.stories.module.css
packages/ui/src/cursors/cursors.stories.tsx
packages/ui/src/dlog.ts
packages/ui/src/dropTarget.ts
packages/ui/src/handles.ts
packages/ui/src/icons.gen.ts (partial: lines 290-319 and 700-739, plus a check that the name union, the group lists and the `IconName` augmentation each hold 293 names and that the "Marks" group exists)
packages/ui/src/icons.table.ts
packages/ui/src/index.ts
packages/ui/src/kitSettings.ts
packages/ui/src/nativeProps.ts
packages/ui/src/nodeText.ts
packages/ui/src/optionKey.ts
packages/ui/src/overlays/blockFrame.ts
packages/ui/src/overlays/overlayAnimation.ts
packages/ui/src/overlays/overlayFrame.module.css
packages/ui/src/overlays/overlayFrame.ts
packages/ui/src/overlays/portalHost.tsx
packages/ui/src/pathThrough.ts
packages/ui/src/pbt.fixture.ts
packages/ui/src/rowControls.ts
packages/ui/src/selectionRoving.ts
packages/ui/src/snap.ts
packages/ui/src/themes/testing/mountThemed.tsx
packages/ui/src/tiling.module.css
packages/ui/src/tiling.ts
packages/ui/src/useAsyncOptions.ts
packages/ui/src/useAttachRef.ts
packages/ui/src/useDebouncedText.ts
packages/ui/src/useEditDraft.ts
packages/ui/src/useFieldLocale.ts
packages/ui/src/useIdleSettle.ts
packages/ui/src/useRemovedRowFocus.ts
packages/ui/src/useReorderDragList.ts
packages/ui/src/useRovingTabIndex.ts
packages/ui/src/useRowNavigation.ts
packages/ui/src/useScrollSpy.ts
packages/ui/src/useTextDraft.ts
packages/ui/src/useTypeahead.ts
packages/ui/src/wrapLine.ts

<!-- done: 4 findings, files read: 46 -->