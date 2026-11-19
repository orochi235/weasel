A step blocked by the brush's own bound now writes nothing: fixed acbd8f8f01 (A).

Shared size clamped to the first tool's bounds in a prefs-backed store: fixed ce351f622a (B). The shared leaf now takes the widest `min`, `max`, and `endless` of every tool naming the key, and each tool clamps the value when it reads it. A scratch test against a real `createPrefsStore` passed: the max-400 brush read 120 and the max-30 brush read 30. That test was deleted afterward, and the committed test checks the shared leaf's bounds.

`shareBrushSize` put a world-unit size under the pixel key and accepted an empty key: fixed 71fb144542 (B). It now throws in both cases. Passing a key of its own is the override. This is my strict call, recorded in `docs/unruled.md` under "Audit round thirty-seven (2026-11-18): brush".

Part of A's finding is not a defect: the last-operation panel through `keepToolOptions`. It compares against the clamped value it reads and skips a write when nothing changed, so it never wrote the clamp back.

No extra defects found. The existing test "moves every sharing brush's size when one's step action runs" relied on the old write-back, so I rewrote it to use shrink. It now expects 24.

Checks:
- `npx vitest run --maxWorkers=1` on each file: pass for `packages/brush/src/brushSize.test.ts` (5/5), `packages/routing/src/tools/toolOptionPrefs.test.ts` (9/9), `toolOptionShare.test.ts` (7/7), `toolOptions.test.ts` (18/18), `toolOptionSteps.pbt.test.ts` (1/1), `toolOptionSteps.shrunk.test.ts` (2/2), and `packages/path-tools/src/pathEditTools.canvas.test.tsx` (5/5).
- eslint on the changed files: pass.
- `npm run check:size`: pass ("no file or function grew past its cap").
- `npm run check:changesets`: pass ("OK — 1723 changeset(s)").
- `npm run typecheck:packages -- brush routing`: **unrun**. A PreToolUse hook refused it as "a suite-sized npm script, and this is the controller", and told me not to rephrase around it. It needs running before merge.
- No `*.browser.test.*` files touched.

The tree is clean.