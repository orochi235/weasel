# weasel-den (placeholder)

This directory is a **scaffold marker**, not a working package. The build,
demo, and WeaselDraw do not (yet) depend on anything here.

## Why it exists

`docs/specs/2026-05-03-weasel-den-design.md` approves a peer workspace
package `@weasel-js/den` whose scope is:

- Finished, stable tools (delete, duplicate, nudge, undo/redo, hand,
  wheel-zoom, wheel-pan, keyboard-zoom). Today these still live inside
  `src/tools/builtin/` of the core package.
- Convenience composition layers — `useStandardTools`,
  `useStandardCanvasSetup`.
- Domain "packs" — `useDrawingAppPack`, future ones (diagram, whiteboard,
  presentation) added per real consumer demand.

The full migration is large (npm-workspaces conversion of the repo,
moving all of core into `packages/weasel/`, then this package). It has
been deferred so that weasel-ui — a sibling package for UI chrome
primitives (`PropertiesPanel`, etc.) — could land first as a forcing
function for the `packages/` layout.

This README exists so the spec doesn't get lost the next time someone
looks at the file tree and asks "what's weasel-den?"

## Status

- [ ] Stand up workspaces in repo root
- [ ] Move core into `packages/weasel/`
- [ ] Create real `packages/den/{package.json,tsconfig.json,src/}`
- [ ] Migrate first tool (`useDeleteTool`)
- [ ] Implement `useStandardTools`
- [ ] Implement `useStandardCanvasSetup`
- [ ] Implement `useDrawingAppPack`
- [ ] Update demo + WeaselDraw to consume the den

See `docs/specs/2026-05-03-weasel-den-design.md` for the full plan and
`docs/TODO.md` (`## weasel-den deferrals`) for tracked follow-ups.
