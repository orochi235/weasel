## Stepping `]` (grow) on a sharing brush at its own max shrinks the shared size for every other brush
- where: packages/brush/src/brushSize.ts:10 (shareBrushSize — its contract "one size, held to each tool's own bounds"); the write happens in packages/routing/src/tools/toolOptionSteps.ts:39-41 via steppedOption (packages/routing/src/tools/toolOptions.ts)
- scenario: two brushes share `brushSizePx` via `shareBrushSize`: A with radiusPx max 400, B with max 30. The user sets A's size to 120 (shared slot = 120). They switch to B, which reads 30 (clamped to its bounds, which is fine). They press `]` to grow B: the step reads current = 30 (the clamped view), steppedOption gives 37.5 → clamped to 30, and setToolOption writes 30 into the shared slot (values.set sees 120 ≠ 30 and stores it). Switching back to A, its size is now 30: a "grow" keystroke shrank the shared brush size from 120 to 30. Same for B's `[`: it writes 24, not a step down from 120, and for the last-operation panel through keepToolOptions. Expected: a step that cannot move the clamped value leaves the shared value alone (or steps from the held value), so "held to each tool's own bounds" is a read-only clamp, not a write-back of the clamp.
- evidence: read (toolOptionSteps.ts:39-41 reads toolOptionParams, the clamped value, and writes steppedOption's result unconditionally; createToolOptionValues.set only skips when the held value deep-equals the new one)
- severity: medium

## Files read
packages/brush/src/brushSize.ts
packages/brush/src/index.ts

<!-- done: 1 findings, files read: 2 -->
