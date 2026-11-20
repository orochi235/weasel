## An in-document trial's a11y audit runs on an empty host once the trial is out of view, and hangs forever if it never rendered
- where: packages/forge/src/shell/TrialHost.tsx:110 (TrialHost, `audit`)
- scenario: `audit` waits only on `rendered.promise` and then runs `auditElement(host)`. It never holds the host live through `show()` (from `useStoryShow`, which `useStoryHost` gets for exactly this). Case one: a trial that rendered and has since been scrolled more than `IN_VIEW_MARGIN` out of view has its content unmounted (`host && live ? … : null`). Focus it and the Accessibility aside's automatic run, or Re-check, audits an empty `.fg-story` and reports 0 violations as a clean pass. Case two: a trial that was out of view from its mount (a restored lab with the focused trial below the fold) never resolves `rendered`, so the promise never settles. `A11yPanel` then shows "Running axe…" with Re-check disabled for good. The disconnect on unmount doesn't settle it either. The frame path does: an out-of-view frame drops its link, and `closeLink` settles pending audits with "The frame went away". Expected: hold the host shown for the audit's length and audit the rendered story, or settle with a failure, as the frame path does.
- evidence: read
- severity: medium

## Get Info opened on an index-page trial does nothing, then opens on its own later
- where: packages/forge/src/shell/info/StoryInfoDialog.tsx:26 (StoryInfoDialog)
- scenario: `Workshop` passes `index={index}`, the story entries only. The index pages are the extra entries in `entries` (`indexEntries(index)`), so are the route-missing instruments. When the focused trial shows an index page, `entry` is undefined and the component returns null without rendering the `Dialog`. ⌘I sets `infoOpen` to true anyway, and since no `Dialog` is mounted, `onOpenChange(false)` can never run. Nothing visible happens, but `infoOpen` stays true. As soon as the user focuses a trial showing a story, the Get Info dialog pops open unasked. Expected: either cover index pages (the dossier fields exist on their entries), or keep `open` false or reset it while there is no entry.
- evidence: read
- severity: medium

## A global's `shows` is asked with `App` unresolved, while `opposite` gets it resolved
- where: packages/forge/src/shell/globals.ts:115 (labGlobals), packages/forge/src/shell/GlobalsToolbar.tsx:52 (GlobalSelect), packages/forge/src/shell/globalsMenu.tsx:26 (globalsMenu)
- scenario: Suppose `mode` declares `follows` and the lab sets it to `App`, while another global declares `shows: (v, g) => g.mode === 'dark' || v !== 'oled'`. `labGlobals` builds `offered` with the raw `'app'` and checks `shows` against it. The toolbar and the menu pass the unresolved `useLabGlobals` values to `labOptions` as well. So `shows` sees `mode: 'app'`, never the light or dark the chrome is actually showing. Its options don't match the mode in force, and a stored value gets pushed to a fallback that is wrong for that mode. Meanwhile `opposite` is documented as asked only after `App` and `auto` are resolved, so one question gets two answers. Expected: resolve `App` with `followApp` and the lab's chrome before asking `shows`, or document that `shows` sees `App`.
- evidence: read
- severity: low

## The frame pool retries a frame URL that never says hello forever, every 30 s
- where: packages/forge/src/shell/framePool.ts:68 (createFramePool, `load` timeout)
- scenario: When a pooled frame misses `HELLO_TIMEOUT_MS`, the timeout removes it and calls `refill()`, which loads a replacement once the page is idle. There is no cap and no backoff. If `frameUrl` 404s, or its document throws before posting `FRAME_HELLO` (a broken frame entry, say), the workshop keeps loading `size` new iframes of that URL every 30 seconds for as long as it is open. Each attempt is a new document load and network request that can never succeed. Expected: stop or back off after a failed load, as `FrameView` does by showing a single "Frame did not start" fault.
- evidence: read
- severity: low

## Files read
packages/forge/src/shell/Crumbs.css
packages/forge/src/shell/Crumbs.tsx
packages/forge/src/shell/FrameView.tsx
packages/forge/src/shell/GlobalsToolbar.tsx
packages/forge/src/shell/IndexTrial.tsx
packages/forge/src/shell/RouteKnobs.tsx
packages/forge/src/shell/StoryBody.tsx
packages/forge/src/shell/StoryGlobalsContext.ts
packages/forge/src/shell/StoryScroller.tsx
packages/forge/src/shell/StoryTrial.tsx
packages/forge/src/shell/TrialHost.tsx
packages/forge/src/shell/Workshop.tsx
packages/forge/src/shell/a11y/A11yPanel.tsx
packages/forge/src/shell/a11y/reasons.ts
packages/forge/src/shell/answers.ts
packages/forge/src/shell/breadcrumb.ts
packages/forge/src/shell/checkShellConfig.ts
packages/forge/src/shell/dependencies.ts
packages/forge/src/shell/documentInstrument.tsx
packages/forge/src/shell/followEdits.ts
packages/forge/src/shell/frameLink.ts
packages/forge/src/shell/framePool.ts
packages/forge/src/shell/globals.ts
packages/forge/src/shell/globalsMenu.tsx
packages/forge/src/shell/hostConditions.ts
packages/forge/src/shell/inViewMargin.ts
packages/forge/src/shell/index.ts
packages/forge/src/shell/info/StoryDossier.tsx
packages/forge/src/shell/info/StoryInfoDialog.tsx
packages/forge/src/shell/info/dossier.ts
packages/forge/src/shell/info/infoItem.ts
packages/forge/src/shell/instrumentCache.ts
packages/forge/src/shell/issues/IssuesPanel.tsx

<!-- done: 4 findings, files read: 33 -->
