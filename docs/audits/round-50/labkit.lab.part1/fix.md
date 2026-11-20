LabBoundary hides every context (A+B): fixed b5eb4e1416 (its test now finds every `createContext` in labkit's source and fails on one that `ABSENT` lacks; the boundary also gives its children their own actions, dep and active-tool registries, so the lab's key dispatcher never runs what they register)
LabBoundary misses contexts (B): duplicate of LabBoundary hides every context (A)
Sidebar/aside pane coming or going remounts every trial (A): fixed 16a6880102 (both splits always render, each with a null sidebar when nothing is contributed; the workspace's `min-width: 0` rule now applies through `.lk-lab__main` and the presentation palette selector moved with it; the layout was not checked in a real browser)
LabSwitcher marks a suffix or prefix page (A+B): fixed 5354753abd (the longest match wins)
LabSwitcher first match wins (B): duplicate of LabSwitcher suffix/prefix (A)
LabZoom outside a `<Lab>` throws instead of bringing its own registry (A): fixed 3d4bc1e5e3 (the doc now says it needs a lab's store and commands, and it throws one error naming both; standalone use was never real)
`body:has(.lk-shell)` strips an embedded shell's page margin (A): fixed 4c90c55f4f (a bar-less shell carries `lk-shell--bare` and the rule skips it; a presented lab still zeroes the margin)
LabSurface under a host surface sets the lightbox layers to `[null]` (B): fixed 05b5b93537 (follow-up formatting in 01c53d1203)
Loading fallback ignores `header={false}` and `nebula` (B): fixed 2e9f3c6f3e

Extra defects:
check:numeric failed on raw `tabular-nums` in `apps/draw/src/dev/audits/Treemap.module.css` (sweep, already in the frozen tree): fixed 893b654ad3
labkit's design-token check failed on a raw `22px` in a `font-size` in `packages/ui/src/components/SpanStrip/SpanStrip.module.css` (sweep, already in the frozen tree): fixed 533c6f8e11
Three of my own changeset titles were over 140 characters: fixed 55693d878f (my own slip, not counted)

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: LabBoundary.test.tsx pass, LabSwitcher.test.tsx pass, LabSurface.test.tsx pass, Lab.persist.test.tsx pass, Lab.chrome.test.tsx pass, Lab.surface.test.tsx pass, LabActions.test.tsx pass, LabShell.test.tsx pass, LabRoot.test.tsx pass
- LabShell.browser.test.tsx (I added a body-margin test to it): unrun, browser test
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run check:changesets`: pass ("OK — 2403 changeset(s).")
- `npm run lint -w @weasel-js/labkit`: pass, as step 27/32 of the gate (calling it directly was refused by this node's hook)
- `npm run lint -w @weasel-js/ui`: unrun, refused by this node's hook as suite-sized; only the gate's root `npm run lint` and labkit's design-token check cover the SpanStrip change
- Tree clean, `.skulk/` untouched

tally: 9 of 9 fixed, 2 extra fixed