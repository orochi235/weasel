Audit round 47, area `editing.presets`: no fixes, no commits, nothing changed. TODO count unchanged.

- Double-click group entry ignores `selectTool.pickBest`, so it can enter a different group than the press selected (A; B cleared the same lead): not a defect. `docs/unruled.md:1554` rules that press classification, hover, `onClick` and `getNodeAtPoint` take the topmost hit rather than `selectTool.pickBest`, because `pickBest` can't see the asking view's camera or the live Alt key. That entry is "Left as is." The open note at `docs/unruled.md:1766` already records the gap: `pickBest` steers only the select tool's own pick, and the dispatcher picks topmost. The double-click binding itself is matched on that topmost pick (`target: { kindOf: isBodyOffChrome }`). So switching `group.enter` alone to `pickBest` would make it disagree with the binding that started it. This is the open question at line 1766, not a separate defect in the presets.

No other defects turned up in a read of `select.ts`, `tools.ts` and `groupEntry.ts`. B's other cleared leads (deduped actions, `clipboard.pasteEvent`, `canSwap`, `selectRotates: false`, the tool-set ids) were not rechecked.

Checks: none run. With no change made, there was nothing for the per-file tests, `npm run checks:gate` or `npm run lint -w` to cover. The tree is clean at f361e68530.

Both reviewers say frozen commit 44e73a9… is not in their clone and that they read 782733b19c. This node's HEAD is f361e68530 ("skulk: frozen tree"), with 782733b19c as its parent.