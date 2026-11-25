GLMeshCache reused a mesh's handle without checking its extra attribute (A+B, counted once): fixed d31b47cb17. A hit now has to carry the same attribute (location, size and data). A different attribute replaces the handle, and the old buffers are freed at the end of the frame.

A replacement GLImageCache read every on-screen image as "not drawn" until the next render (A): fixed 3cab0e1d09. The new cache shares the old one's drawn-frame record. This covers both `setImageMinification` and context `restore`.

A thin world-width glyph stroke vanished or narrowed in steps because its width was rounded to a fixed em quantum (B): fixed e68467faf3. Widths under a quarter em now round to within 1/256 of their own size, so a positive width never rounds to zero. Wider strokes keep the 1/1024 em quantum.

Non-finite stop offsets collapsed in the gradient ramp key, so different stop lists shared a row (B): fixed 9904180492. The key now writes NaN and both infinities as distinct strings.

GLImageCache ignored `repetition` on a cache hit (B): fixed 01c9541795. No caller passed the parameter, so it is removed and image textures always clamp. Repeating tiles go through GLTextureCache, which re-applies wrap on every upload. No changeset, because nothing a consumer can see changes.

A never-disposed GLImageCache stayed pinned forever by the module-level `live` set (B): fixed db3899791e. The set now holds weak references and prunes dead ones as it iterates. The test forces GC through `node:v8`/`node:vm`, and I confirmed it fails against the code before the fix.

Extra defects found while fixing: none.

Checks:
- `npx vitest run --maxWorkers=1` on each test file I touched or that covers the changes: GLMeshCache.test.ts (14), GLImageCache.test.ts (17), outlineStrokeMeshCache.test.ts (6), GradientRampAtlas.test.ts (29), drawText.rotate.test.ts (3), draw.imageMinification.test.ts (13) and WeaselRenderer.test.ts (23). All passed.
- `npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/renderer`: the package has no lint script ("Missing script: lint"). The root `npm run lint` inside the gate passed.
- The tree is clean.

tally: 6 of 7 fixed, 0 extra fixed