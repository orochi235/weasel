Theme panel unmounted mid-gesture drops the pending value and leaves the undo entry unsealed (A+B): fixed 6f0dbef2a3

`commit` on one path discards a pending `input` on another (B): fixed 54096ec1a1

`useTool` builds a RegExp from an unescaped tool name (B): fixed 303536af2d. The same unescaped pattern in `apps/chart/src/pages/offPage.browser.test.tsx` now uses the same helper.

`mountChartApp` called twice leaks the first root (A): fixed 53f988015f. I made the strict call: a second mount throws until `unmountChartApp` runs. It is recorded in `docs/unruled.md`.

No changesets: `apps/chart` is not a published package (it has no `package.json`).

Checks:
- `npx vitest run --maxWorkers=1 apps/chart/src/theme/useThemeEdit.test.tsx`: pass (2 tests, both failed before the fixes)
- `npx vitest run --maxWorkers=1 apps/chart/src/theme/ThemePanel.test.tsx`: pass (6)
- `npx vitest run --maxWorkers=1 apps/chart/src/testing/toolName.test.ts`: pass (1)
- `apps/chart/src/testing/mountChartApp.browser.test.tsx`, `apps/chart/src/pages/offPage.browser.test.tsx` and the browser tests that use `chartSession.ts`: unrun (browser)
- `npm run checks:gate`: all 33 passed, root `lint` included
- `npm run lint -w <pkg>`: not applicable, since `apps/chart` is not a workspace package; the gate's root `lint` covers it

tally: 4 of 4 fixed, 0 extra fixed