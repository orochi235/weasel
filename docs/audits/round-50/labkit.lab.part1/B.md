I couldn't write `.skulk/out/findings.md` because permission was denied twice, so the whole findings document is below. I read the code only and ran nothing.

# Findings: labkit.lab.part1 (round 50)

## LabSurface under a host's surface sets the lightbox layers to `[null]`, so no lightbox in the lab lifts the host's buffers
- where: packages/labkit/src/lab/LabSurface.tsx:136-137,177 (LabSurface)
- scenario: a lab embedded where a surface already exists. That can be a host app that owns a surface and wraps its tiles in `<LightboxLayers below={[hostUnder]} above={[hostOver]}>`, as surface/AGENTS.md:93 and docs/guides/1-recipes.md:72 tell it to. It can also be a `<Lab>` nested in an outer lab's trial (supported since cad915da05), where the outer `LabSurface` declares its layers. With `outerSurface` set, the inner `LabSurface` renders no layers of its own, so `underLayer` and `overLayer` stay null. It still wraps its body in `<LightboxLayers below={[null]} above={[null]}>`. That provider replaces the outer declaration for everything below it (LightboxLayers.tsx:31-35 does not merge), and null entries are skipped. So expanding a trial of the inner lab lifts no buffer: the trial goes into the top layer, while the buffers it still paints into (through `outerSurface`) stay underneath. Its canvas drawing and marks vanish while it is expanded. When there is an outer surface, LabSurface should leave the outer `LightboxLayersContext` in force.
- evidence: read
- severity: medium

## LabBoundary leaves several lab and trial contexts in force, so content under it still reaches the enclosing lab and trial
- where: packages/labkit/src/lab/LabBoundary.tsx:34 (ABSENT)
- scenario: `ABSENT` leaves out these contexts:
  - `TransportKeysContext` (clock/useTransportKeys.ts:41)
  - `LabChordsContext` (lab/labChords.ts:38)
  - `LabMarkStoresContext` (annotations/labMarkStores.ts:53)
  - `TrialWritersContext` (state/context.tsx:40)
  - `HeldClockContext` (clock/contexts.ts:20)
  - `TrialConfigChangeContext` (trial/trialConfigChange.ts:11)
  - `FloatSidebarContext` (trial/FloatSidebar.tsx:22)
  - `FieldChoicesContext` (controls/fieldChoices.ts:6)
  - every core context `<LabActions>` publishes: the actions registry, the dep registry, the active-tool context and the menu host.

  Take a component workshop rendered inside a trial under `<LabBoundary>`:
  - A `useTrialConfigChange` handler mounts on the enclosing trial (trialConfigChange.ts:21) and runs on that trial's config writes.
  - A keyed transport claims the enclosing lab's transport keys (useTransportKeys.ts:99-103), so the outer lab's Space drives it.
  - `useLabChords` claims the outer lab's chords.
  - `useRegisterTrialMarks` registers into the outer lab's mark registry.
  - With a `LabStoreProvider`/`TrialIdProvider` pair set up under the boundary, `useTrialState().setState` still goes through the outer trial's writers (useTrialState.ts:20,38).
  - `useHeldClock` reads the outer `HeldClock`.
  - `useCommand` registers on the outer lab's registry, and the outer lab's key dispatcher fires its keys.

  The doc says "every context a `<Lab>` or a `<Trial>` publishes reads as absent below it".
- evidence: read
- severity: medium

## LabSwitcher marks the first page that matches, not the one the path names
- where: packages/labkit/src/lab/LabSwitcher.tsx:77-92 (currentPage)
- scenario: with hash routes, `pages=[{href:'#/dev',label:'Dev'},{href:'#/dev/tools',label:'Tools'}]` and `path='/#/dev/tools'`, the routed `findIndex` accepts `#/dev` first because `'/dev/tools'.startsWith('/dev/')`. "Dev" is marked current instead of the exact match "Tools". With documents, `pages=[{href:'/stats'},{href:'/labs/stats'}]` on `/labs/stats`, `onDoc` is a suffix check (`here.doc.endsWith(doc)`), so `/stats`, a different document, matches first and is marked. It should prefer an exact match, then the longest one.
- evidence: read
- severity: low

## The loading fallback ignores `header={false}` and `nebula`, so a stored lab flashes a header it never draws once loaded
- where: packages/labkit/src/lab/Lab.tsx:34 (LabFallback), Lab.tsx:84
- scenario: `<Lab storageKey="k" header={false} nebula={…}>` embedded in a page that frames it. While the store opens, `LabFallback` renders `LabShell` without passing `header`, so `bar` defaults to `true` and the title header shows. It disappears once `LabPage` mounts with `bar={header}` (false), and the page reflows. `nebula` isn't passed to `LabTheme` either, so the backdrop changes on load. labProps.ts:47 documents `fallback` as "the lab's empty shell", but the shell it draws differs from the one the lab draws once loaded.
- evidence: read
- severity: low

## Files read
packages/labkit/src/lab/Lab.less
packages/labkit/src/lab/Lab.stories.less
packages/labkit/src/lab/Lab.stories.tsx
packages/labkit/src/lab/Lab.tsx
packages/labkit/src/lab/LabActions.tsx
packages/labkit/src/lab/LabBoundary.tsx
packages/labkit/src/lab/LabCommands.tsx
packages/labkit/src/lab/LabContext.ts
packages/labkit/src/lab/LabFullChrome.stories.tsx
packages/labkit/src/lab/LabHeader.tsx
packages/labkit/src/lab/LabMenuBar.tsx
packages/labkit/src/lab/LabPage.tsx
packages/labkit/src/lab/LabPalette.tsx
packages/labkit/src/lab/LabPanes.tsx
packages/labkit/src/lab/LabProviders.tsx
packages/labkit/src/lab/LabRoot.tsx
packages/labkit/src/lab/LabRuntimeContexts.tsx
packages/labkit/src/lab/LabShell.less
packages/labkit/src/lab/LabShell.stories.tsx
packages/labkit/src/lab/LabShell.tsx
packages/labkit/src/lab/LabShortcutSheet.tsx
packages/labkit/src/lab/LabSurface.tsx
packages/labkit/src/lab/LabSwitcher.less
packages/labkit/src/lab/LabSwitcher.tsx
packages/labkit/src/lab/LabZoom.tsx
packages/labkit/src/lab/LentTopBuffer.tsx
packages/labkit/src/lab/PresentedTransport.tsx
packages/labkit/src/lab/TileGrip.stories.tsx
packages/labkit/src/lab/TileGrip.tsx
packages/labkit/src/lab/TrialWorkspace.tsx

<!-- done: 4 findings, files read: 30 -->