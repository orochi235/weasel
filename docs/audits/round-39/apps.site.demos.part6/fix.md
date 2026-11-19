- TiledSurfaceDemo doesn't resize the shared buffer when devicePixelRatio changes (A): fixed 0b7e4b0f8d
- UiInputDemo's `e.key.length !== 1` drops keys outside the BMP, where ui-input uses `isOneChar` (A): fixed 07e97b03ad
- TimelineFramesDemo still downloads the frame being encoded after Cancel (A): fixed 2da7708188
- Voronoi WGSL `array<vec2f, 8>` is refused without `uniform_buffer_standard_layout` (B): fixed 7306571a82. The seeds are now packed two to a `vec4f`, and the flat seed list fills it unchanged. The new test checks every demo program under the strict layout and confirms the flat list packs the same way.

No extra defects found. No changesets: these are all private site demos, and none of the earlier demo-only commits had one. No `docs/unruled.md` calls were needed.

Checks:
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/customShaderPrograms.test.ts`: pass (4/4), failed before the fix
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/UiInputDemo.test.tsx`: pass (2/2), failed before the fix
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/TimelineFramesDemo.test.tsx`: pass (3/3), failed before the fix
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/TiledSurfaceDemo.test.tsx`: pass (1/1), failed before the fix
- `npm run typecheck`: pass. I ran this in place of `typecheck:packages` because `apps/site` isn't a package and no package changed.
- eslint on the 8 changed files: pass
- `npm run check:size`: pass ("no file or function grew past its cap")
- `npm run check:changesets`: pass ("OK — 1823 changeset(s)")
- Tree is clean apart from `.skulk/`.