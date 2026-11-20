# Findings: labkit.lab.part1

## LabBoundary leaves several lab/trial contexts unmasked, so pieces under it still reach the enclosing lab
- where: packages/labkit/src/lab/LabBoundary.tsx:34 (ABSENT)
- scenario: a component workshop renders a labkit `<Transport>` (or anything calling `useTransportKeys`) inside `<LabBoundary>` inside a trial. `TransportKeysContext` is not in `ABSENT`, so the transport claims the enclosing lab's `lab.transport.*` keys and Space/arrows drive the workshop's transport — on a bare page `useTransportKeys` "answers none" (clock/useTransportKeys.ts:92). The same holds for `LabChordsContext` (labChords.ts:38, published by LabActions), `LabMarkStoresContext` (published by LabProviders.tsx:38), `TrialWritersContext` (state/context.tsx:40), `TrialConfigChangeContext` (trial/trialConfigChange.ts:11), `HeldClockContext` and `FloatSidebarContext`: each is published by a `<Lab>` or `<Trial>` and none reads as absent below the boundary, contrary to its doc ("every context a `<Lab>` or a `<Trial>` publishes reads as absent below it"). The hand-kept list has drifted from the contexts that exist.
- evidence: read (grep of every `createContext` in packages/labkit/src against ABSENT)
- severity: medium

## A sidebar/aside contribution appearing or leaving remounts every trial
- where: packages/labkit/src/lab/LabPage.tsx:182 (LabContent); packages/labkit/src/lab/LabPanes.tsx:29-49 (LabPanes)
- scenario: a lab passes `labChrome` that gains or loses a `region: 'sidebar'` or `'aside'` contribution at runtime (an inspector shown on a toggle). `chromeAll.hasPanes` flips, and `LabContent` switches `children` between a fragment and `<LabPanes>`; inside `LabPanes` the same happens between bare `children`, one `<Split>`, and nested `<Split>`s. Each switch changes the element type above `TrialWorkspace`, so React unmounts and remounts the whole workspace: every `<Trial>`'s canvas, GL tenancy, camera and in-memory instrument state is torn down and rebuilt. The panel-host registry is kept for the lab's lifetime precisely so a trial survives a layout change (LabPage.tsx:172), but the trials themselves do not. Expected: a pane appearing leaves the trials mounted (a stable wrapper whose panes are conditional).
- evidence: read (inference from React reconciliation; not run)
- severity: medium

## LabSwitcher marks the wrong page when one page's path is a suffix of another's
- where: packages/labkit/src/lab/LabSwitcher.tsx:77 (currentPage, onDoc)
- scenario: `pages = [{ href: '/stats', label: 'Stats' }, { href: '/sub/stats', label: 'Sub stats' }]`, path `/sub/stats`. Both hrefs are already resolved to absolute paths against `base`, yet `onDoc` matches by `here.doc.endsWith(doc)`: `'/sub/stats'.endsWith('/stats')` is true, so `findIndex` returns 0 and the menu marks "Stats" as current instead of "Sub stats". The same order dependence hits hash routes through `onDoc`. Expected: the exact (or longest) match wins.
- evidence: read (traced by hand; not run)
- severity: low

## LabZoom's "outside a `<Lab>`" path throws instead of bringing its own registry
- where: packages/labkit/src/lab/LabZoom.tsx:71-85 (LabZoom, LabZoomControls)
- scenario: `<LabZoom>` mounted outside a `<Lab>` takes the `useInLabActions() === false` branch, wraps itself in `<LabActions>`, and then `LabZoomControls` calls `useLabCommands()` (throws "useLabCommands must be used inside <Lab>") and requires `LabStoreContext` (throws "<LabZoom> requires <LabStoreProvider>"). The doc says "Outside a `<Lab>` it brings a registry of its own"; in practice that branch only runs where a lab's commands and store exist without `LabActions`, which `LabProviders` never produces (it always mounts `LabActions`). Either the fallback is dead or the doc promises a standalone use that crashes.
- evidence: read
- severity: low

## `body:has(.lk-shell)` strips the host page's body margin for an embedded shell
- where: packages/labkit/src/lab/Lab.less:4
- scenario: a page renders `<LabShell bar={false}>` as one widget inside its own layout — the case `bar={false}` is documented for ("a shell that sits inside a page with a title of its own", LabShell.tsx:13-15). `.lk-shell` matches, so the whole host page's `body` loses its default margin, changing layout outside the shell. The rule's premise ("`<LabShell>` alone fills the viewport") does not hold for an embedded shell. Expected: only a viewport-filling lab/shell zeroes the margin.
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

<!-- done: 5 findings, files read: 30 -->
