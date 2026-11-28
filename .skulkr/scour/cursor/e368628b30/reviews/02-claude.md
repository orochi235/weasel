# Findings: cursor

## brushRing draws a negative or NaN radius as the default 24px ring, and turns a negative world radius into a fixed-px CSS cursor
- where: packages/cursor/src/brushRing.ts:20 (brushRing)
- scenario: `brushRing(-5)` → `size = Math.round(-5 * 24 / 9.9) = -12`; `brushRing(NaN)` → `size = NaN`. Both specs reach `resolveCursor`, whose `positive()` drops the size, so the ring bakes at the default 24px (a ~9.9px-radius ring) instead of being refused. `brushRing(-5, 'world')` (or `NaN, 'world'`) returns `{ worldRadius: -5 }`; `resolveCursor` ignores the non-positive world radius and returns a CSS cursor baked at 24px, so a world-unit brush silently stops following zoom. The function refuses infinite radii and an overflowed size explicitly "rather than draw it at the default", and floors tiny positive radii at 1px for the same reason, but a negative or NaN radius (a real result of a computed brush radius, e.g. a slider minus an offset, or 0/0) still lands on exactly that default. It should either refuse (RangeError, as for Infinity) or clamp to the 1px ring that 0 draws.
- evidence: read
- severity: low
- fix: packages/cursor/src/brushRing.ts
- size: line
- cause: guard covers only ±Infinity, not negative/NaN
- confidence: sure

## Files read
packages/cursor/src/bake.ts
packages/cursor/src/brushRing.ts
packages/cursor/src/cursorSink.ts
packages/cursor/src/glyphs.ts
packages/cursor/src/index.ts
packages/cursor/src/mark.ts
packages/cursor/src/paint.ts
packages/cursor/src/paintedCursorState.ts
packages/cursor/src/pbt.fixture.ts
packages/cursor/src/registry.ts
packages/cursor/src/resolve.ts
packages/cursor/src/types.ts

<!-- done: 1 findings, files read: 12 -->
