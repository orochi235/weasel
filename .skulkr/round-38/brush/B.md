## README example builds a fresh `share` each render, so the brush tools are redefined every render
- where: packages/brush/README.md:9 (usage example), packages/brush/src/brushSize.ts:10 (shareBrushSize)
- scenario: The README calls `shareBrushSize(...)` beside the `useKneadTool`/`useSandTool` hook calls — i.e. in a component body, the second one inline in the hook's options. `shareBrushSize` returns a new object literal on every call, and both hooks memo their `Tool` on `[share]` (`packages/path-tools/src/sand/useSandTool.ts:41`, knead the same) and document "Keep it stable across renders". Copying the example gives a new `Tool` object on every render of the host, so whatever keys on tool identity (tool registration, active-tool effects) churns each render. The example should hoist the shares to module scope (or `useMemo`), or `shareBrushSize` should be documented as needing that; nothing in the brush package says its result must be held stable.
- evidence: read
- severity: low

## Files read
packages/brush/src/brushSize.ts
packages/brush/src/index.ts

<!-- done: 1 findings, files read: 2 -->
