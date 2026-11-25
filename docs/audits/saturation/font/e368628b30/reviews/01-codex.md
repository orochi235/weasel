# Review saturation for `font`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 42 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Concurrent atlas registrations and replacement ownership | 1 | 1 | 0 |
| 2 | Warmup resolution and lazy fallback after an outline failure | 1 | 2 | 0 |
| 3 | DOM font creation, CSS family parsing, and registration disposal | 0 | 2 | 1 |
| 4 | Dynamic glyph rasterization, page reclamation, and texture uploads | 0 | 2 | 2 |
| 5 | Baked metrics, glyph fallback, and shader coverage | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An older atlas fetch can win after switching away from and back to the same URLs

[registerFont.ts](packages/font/src/registerFont.ts#L205) · Pass 1 · Medium · Source-traced

Completion and failure are gated by URL equality alone. Start a slow load for A, replace it with B, then replace B with A again. If the latest A finishes first, the original A can still pass landFontUrls and replace the latest bitmap with its stale response. If the original A fails while the latest A is still pending and no A has landed, releaseFontUrls can clear the newer request's claim.

### 2. Warmup stops at a failed outline registration instead of loading the lazy atlas fallback

[warmFonts.ts](packages/font/src/warmFonts.ts#L68) · Pass 2 · Medium · Source-traced

A failed outline still makes hasFontOutlines true. When no exact or near atlas is available, variantLoads returns at this check without waking a far lazy atlas that resolveFontVariant selects after the failed outline. For example, a failed upright 400 outline and a lazily declared italic 400 atlas leave an upright render without its fallback on the first draw after warmup. The same omission can occur when the outline fails during warmup.

Source and tests were left untouched.
