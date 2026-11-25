# Findings: forge.shell.part1 (round 48, blind)

## A disposed frame pool still hands out its warm frames, detached from the document
- where: packages/forge/src/shell/framePool.ts:88 (createFramePool → claim / dispose)
- scenario: `dispose()` removes the shelf and stops pending loads but leaves `warm` filled and `claim()` ungated by `disposed`. When `Workshop`'s `frameUrl` changes (or `framed` flips), React runs every passive cleanup in the commit before any mount effect, so `useFramePool`'s cleanup disposes the old pool before `FrameView`'s `mountFrame` effect re-runs for its new `src`. That effect still reads the old pool from `latestRef` (the re-render with `pool = null` hasn't happened yet) and claims a frame. It gets one that is disconnected and loaded at the *old* `frameUrl`, and `moveFrame` calls `moveBefore` with a disconnected node, which throws `HierarchyRequestError`. Even if it didn't throw, the view would connect to a document for the wrong frame URL. `claim()` should return null once disposed, and `dispose` should empty `warm`.
- evidence: read
- severity: low

## Get Info pressed on an index-page or missing-route trial leaves `infoOpen` stuck true, so the dialog later opens on its own
- where: packages/forge/src/shell/info/StoryInfoDialog.tsx:26 (StoryInfoDialog); packages/forge/src/shell/Workshop.tsx:177,228 (infoCommand / StoryInfoDialog index={index})
- scenario: `Workshop` hands the dialog `index` (the story entries only), not `entries`, which also holds the index pages from `indexEntries`. Focus an index-page trial (or the "No story …" trial a bad route opens) and press ⌘I or the header's Info button. `infoItem` calls `setInfoOpen(true)`, but `StoryInfoDialog` finds no entry and returns null, so nothing shows and `open` stays true. When the user later clicks a story trial to focus it, `entry` resolves and the dialog opens with no request. Expected: Info either works for index pages, or does nothing and leaves `open` false (e.g. call `onOpenChange(false)` when there is no entry, or disable the command).
- evidence: read
- severity: medium

## The a11y panel's in-flight count and pointed nodes carry over from one focused trial to the next
- where: packages/forge/src/shell/a11y/A11yPanel.tsx:72,90 (A11yPanel), rendered unkeyed by FocusedA11y at :139-141
- scenario: `FocusedA11y` swaps `TrialIdContext` under the same `<A11yPanel />` instance, so `inFlight` and `pointed` belong to whichever trial was focused first. Focus trial A while its audit is still waiting (a frame audit is queued until the frame renders, and a document `TrialHost` audit waits on `rendered.promise`, which never settles while that host stays out of view). Then focus trial B. B's audit runs and finishes, but `inFlight` is still 1 from A, so B's panel reads "Checking…" and keeps Re-check disabled over B's finished report until A's audit settles, which may be never. Likewise a `pointed` set left over is re-sent as `a11y.highlight` to B's frame with A's selectors. Expected: per-trial state (key the panel by `record.id`, or count per audit).
- evidence: read
- severity: low

## Changing one global writes the fallback of every other global into storage, losing a choice that `shows` only hid for a while
- where: packages/forge/src/shell/GlobalsToolbar.tsx:20 (useLabGlobals → set)
- scenario: `set` stores `{ ...labGlobals(declarations, prev), [key]: value }`, and `labGlobals` replaces a value that the current `shows` hides with the nearest shown option. Take the case `globalsMenu.test` covers: `theme.shows` hides `light` unless `contrast === 'hi'`. Choose Contrast High, then Theme Light, then Contrast Low. The stored record now holds the fallback (say `theme: 'auto'`), not `light`. Choose Contrast High again and Theme stays `auto`, where `labGlobals`' contract ("falls back" when hidden) implies `light` comes back once it shows again. The fallback is a reading of the stored values, but `set` makes it permanent. Expected: merge onto the raw stored record (`{ ...(isRecord(prev) ? prev : {}), [key]: value }`) and let `labGlobals` resolve when reading.
- evidence: read
- severity: low

## checkShellConfig rejects an option valued 'lab' but not one valued 'app' on a declaration that `follows`
- where: packages/forge/src/shell/checkShellConfig.ts:9 (checkShellConfig)
- scenario: A declaration `{ follows: (c) => c.mode, options: [{ value: 'app', label: 'App palette' }, …] }` passes the check. `labOptions` then offers `APP_OPTION` and the author's option, both keyed `'app'`, so the select and the menu enum hold two items with one key. `followApp` treats the author's `'app'` as "follow the chrome", so their option can never be chosen as itself. The check already throws on the equivalent clash with `FOLLOW_LAB`. It should throw on `FOLLOW_APP` too when `follows` is set.
- evidence: read
- severity: low

## A document trial's audit runs axe on an empty host once its story has scrolled out of view, and reports it clean
- where: packages/forge/src/shell/TrialHost.tsx:110 (TrialHost, `audit` in the registry layout effect)
- scenario: `audit` waits only on `rendered.promise`, which settles once, at the host's first paint. The host's content renders only while `live` (`inView || held > 0`, `useStoryShow`). Open a trial, let it render, scroll it more than `IN_VIEW_MARGIN` out of view (keeping it focused), then press Re-check in the Accessibility panel. `auditElement(host)` runs against a `.fg-story` whose `StoryScroller` holds nothing, and the panel shows "0 violations · 0 to review" for a story that may have many. A trial that has never been in view goes the other way: the audit waits on `rendered.promise` forever and the panel says "Checking…" for good. `useStoryShow` already exports `show()`, which holds the content rendered and resolves after paint (what `useStoryHost` hands to other callers), but the audit doesn't use it. Expected: `const release = await show(); try { audit } finally { release() }`.
- evidence: read
- severity: medium

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
packages/forge/src/shell/a11y/A11yPanel.css
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

<!-- done: 6 findings, files read: 34 -->
