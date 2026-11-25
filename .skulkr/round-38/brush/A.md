## README example builds a new share object every render, so the Sand tool is redefined on every render
- where: packages/brush/README.md:12 (example), packages/brush/src/brushSize.ts:10 (shareBrushSize)
- scenario: `useSandTool({ share: shareBrushSize(SAND_TOOL_OPTIONS) })`, as the README writes it, must run inside a component (it calls a hook), and `shareBrushSize` returns a fresh object literal on each call. `useSandTool` memoizes its `defineTool` on `[share]` (packages/path-tools/src/sand/useSandTool.ts:41), and its own doc says "Keep it stable across renders". So each render gets a new `Tool` identity, and anything keyed on the tool (registry memo, palette, active-tool tuning) churns every render. The example should hoist the share to module scope or wrap it in `useMemo`, the way apps/site/demos/SharedBrushSizeDemo.tsx does by building it inside a memoized `brushes()`. The `knead` line has the same problem if `share` is computed in the component body.
- evidence: read
- severity: low

## Files read
packages/brush/src/brushSize.ts
packages/brush/src/index.ts

<!-- done: 1 findings, files read: 2 -->
