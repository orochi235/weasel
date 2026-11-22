A0 (settle returns early on empty first markup) — A — fixed c987da3301
A1/B1 (paramsText and fontCascade judge "visually hidden" two different ways) — A+B — fixed 537e48c217
A2/B0 (`trigger('Mode')` also matches a "Blend Mode" row) — A+B — fixed 83ed63ffe3
A3/B6 (`sweepAcross` releases with `buttons: 1` from a non-primary pointer) — A+B — fixed 649ccecde0
A4 (`readModuleCss` inlines a shared sheet once per import path) — A — fixed 2044aafe0d
A5 (`readModuleCss` reads a `supports()` nested two levels deep as media) — A+B — fixed 5b7c8c521c
A6/B4 (stale-`unmounted` check skips entries naming a component nothing exports) — A+B — fixed 6cf3922848
B2 (`rowTexts` counts the label's own text among its values) — B — fixed 8be7274012
B3 (`exportedComponents` skips names that open on an acronym, such as `XYPad`) — B — fixed 507ff77c5f
B5 (`settle` waits on the host only, not on its portals) — B — fixed 9b040e9f64

Extra: none. The 537e48c217 commit also stops `rowTexts` reading a native `<select>`'s option text as row values. Under the old predicate those options were skipped by accident, and the new one would have let them in. That is part of the same fix, not a separate defect.

No changesets: `packages/ui/src/testing` is not in the package's `exports` or its shipped `dist`, so a consumer cannot notice any of these changes. No `docs/unruled.md` entries were needed.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own: `shown.test.ts` pass (4), `paramsText.test.ts` pass (2), `fontCascade.test.tsx` pass (4), `selectRow.test.tsx` pass (4), `sweep.test.ts` pass (1), `readModuleCss.test.ts` pass (6).
- Callers rerun: `PropertyField.a11y` / `.noValue` / `.names` / `.kinds` / `.readout` / `.unit`, `PropertyPanel.header`, `PropertyMetrics`, and `PlotDataPanel` tests: all pass.
- `npm run checks:gate`: pass, "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/ui`: the package has no `lint` script (npm error: missing script). The root `npm run lint` passed inside the gate.
- Unrun: `packages/ui/src/fontCascade.browser.test.tsx`, `packages/labkit/src/fontCascade.browser.test.tsx`, `paramsTextSize.browser.test.tsx`, `ControlPanel.textSize.browser.test.tsx`, and every `sweepAcross` browser test. They need a GUI node, and the shared hidden-text predicate, the label exclusion, and the pointer release changes all reach them.

tally: 10 of 10 fixed, 0 extra fixed