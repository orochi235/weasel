# WebGL Transition — Step 3: Text (MSDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MSDF text rendering to `@orochi235/weasel-gl`. A `pnpm gen:font` build script converts TTF/OTF fonts to JSON metrics + PNG atlas. Inter ships prebuilt as the default font. A new SDF fragment shader renders crisp text at any zoom level. Glyph layout covers ASCII + Latin-1. `registerFont(family, atlasUrl)` provides the public API. The DrawCommand interpreter gains a `kind: 'text'` variant. Exits when `kind: 'text'` renders crisp glyphs at multiple zoom levels in headless Chromium and glyph metrics match `measureText` within sub-pixel tolerance.

**Architecture:** Two new GL programs run in the same `WeaselRenderer`: the existing `pathFill` program (unchanged) and a new `textSdf` program. The `textSdf` program takes a per-glyph quad (interleaved x,y,u,v attributes), samples an atlas texture, and applies MSDF median + smoothstep to produce crisp anti-aliased glyphs. A `FontRegistry` (module-level `Map<string, FontFace>`) holds loaded fonts keyed by family name; `registerFont` is async because it fetches the PNG atlas and uploads it as a GL texture. Glyph layout is a pure function `layoutGlyphs(text, style, font) → GlyphQuad[]` that walks codepoints, looks up each in the font's JSON metrics, advances the pen by `advance + kerning`, and emits one quad per glyph. The renderer uploads the per-frame glyph quad buffer as a dynamic VBO (one VBO per draw call, reused each frame). Atlas textures live in a `GLTextureCache` (Map keyed by `TextureHandle` id). `WeaselRenderer` gains a `textSdf: ShaderProgram` field and a `textureCache: GLTextureCache` field; `drawText` is wired into `draw.ts` analogously to `drawPath`.

**Tech Stack:** TypeScript (strict), vitest. New dev dep: `msdf-bmfont-xml` (atlas generation CLI, not a runtime dep). Default font: **Inter v4 (Apache-2.0)**. The plan documents the license in the done-note template at the bottom. Atlas size: 512×512 for ASCII + Latin-1 (codepoints 0x0020–0x00FF). CJK base is explicitly deferred (noted below).

**Spec:** [`docs/superpowers/specs/2026-05-08-webgl-transition-plan-design.md`](../specs/2026-05-08-webgl-transition-plan-design.md), Sequencing → Step 3.

**Required reading before starting:**
- [`webgl-stepwise-conventions.md`](./webgl-stepwise-conventions.md) — accumulated lessons. Entries §1, §2, §3, §6 apply directly (see task callouts below).
- [`2026-05-08-webgl-step-1-done.md`](./2026-05-08-webgl-step-1-done.md) — context on what step 1 shipped.
- Step-2 done note: `docs/superpowers/plans/2026-05-09-webgl-step-2-done.md` — will exist by the time step 3 is executed.

**Conventions cited by specific tasks below:**
- Task 1 (gen:font script): conventions §3 — `npm install --save-exact` for new dev dep; verify no caret lands.
- Task 8 (SDF fragment shader): conventions §2 — premultiplied output `vec4(rgb*a, a)` + `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`.
- Task 11 (atlas upload + texture cache): conventions §1 — unit tests (mock GL recorder) don't verify texture state; Playwright smoke required for pixel correctness.
- Task 14 (smoke spec): conventions §6 — `preserveDrawingBuffer: true` AND `stencil: true` on every dev-page `getContext` call.

**Deferred — out of scope for step 3:**
- CJK base and supplemental Unicode blocks. The 512×512 atlas covers ASCII + Latin-1 (236 glyphs at 32px). CJK requires a separate, much larger atlas and its own build pipeline step. Defer with a documented TODO in `registerFont`.
- Complex-script shaping (bidi, Arabic ligatures, Devanagari conjuncts). HarfBuzz integration is its own future spec. Add a `// TODO(harfbuzz): complex script shaping deferred` comment at the glyph layout entry point.
- Multi-line layout and `TextPose.width` wrapping. Step 3 lays out a single string left-to-right on one baseline. Line-break support is step 7 (port of `createTextLayer`).
- Bitmap emoji (color CBDT/CBLC or SVG-in-OpenType). Render as the `?` fallback glyph.

---

## File structure

Files this plan creates/modifies in `packages/weasel-gl/`:

```
src/
  shaders/
    textSdf.ts             # NEW — GLSL sources for the MSDF text shader
  FontAtlas.ts             # NEW — BmFont JSON types + atlas texture upload
  FontAtlas.test.ts        # NEW
  GlyphLayout.ts           # NEW — layoutGlyphs() pure function
  GlyphLayout.test.ts      # NEW
  GLTextureCache.ts        # NEW — GL texture upload + cache keyed by id
  GLTextureCache.test.ts   # NEW
  registerFont.ts          # NEW — FontRegistry + registerFont() public API
  registerFont.test.ts     # NEW
  DrawCommand.ts           # MODIFY — add TextDrawCommand variant
  draw.ts                  # MODIFY — drawText() + dispatch 'text' case
  draw.test.ts             # MODIFY — assertions for text draw calls
  WeaselRenderer.ts        # MODIFY — textSdf ShaderProgram + textureCache
  index.ts                 # MODIFY — export registerFont, TextDrawCommand, etc.

scripts/
  gen-font.ts              # NEW — CLI wrapper for msdf-bmfont-xml

fonts/
  inter/
    inter.json             # NEW — prebuilt BmFont metrics (committed)
    inter.png              # NEW — prebuilt atlas 512×512 (committed)

dev/
  text.html                # NEW — text smoke page
  text.ts                  # NEW — renders text scenes
  text.spec.ts             # NEW — Playwright smoke spec (pixel readback)
```

Files outside the package:

```
package.json               # ADD scripts: gen:font; ADD dev dep msdf-bmfont-xml
docs/superpowers/plans/2026-05-09-webgl-step-3-done.md  # NEW done note (written at step end)
```

> The `scripts/gen-font.ts` lives at `packages/weasel-gl/scripts/gen-font.ts`. The `gen:font` npm script invokes it via `tsx`.

---

## BmFont JSON shape (reference fixture for tests)

`msdf-bmfont-xml` outputs a JSON file with this structure. Tests use stripped-down inline fixtures conforming to this shape.

```ts
// packages/weasel-gl/src/FontAtlas.ts will define these types:

export interface BmFontInfo {
  face: string;
  size: number;
}

export interface BmFontCommon {
  lineHeight: number;
  base: number;
  scaleW: number;
  scaleH: number;
}

export interface BmFontChar {
  id: number;       // codepoint
  x: number;        // atlas pixel x
  y: number;        // atlas pixel y
  width: number;    // atlas region width
  height: number;   // atlas region height
  xoffset: number;  // pen offset x (bearing x)
  yoffset: number;  // pen offset y (bearing y from top)
  xadvance: number; // advance width
  page: number;     // atlas page index (always 0 in step 3)
}

export interface BmFontKerning {
  first: number;    // preceding codepoint
  second: number;   // current codepoint
  amount: number;   // kerning adjustment (pixels, negative = tighten)
}

export interface BmFont {
  info: BmFontInfo;
  common: BmFontCommon;
  chars: BmFontChar[];
  kernings: BmFontKerning[];
}
```

A minimal fixture for tests (two glyphs: 'A'=65 and 'B'=66):

```ts
export const FIXTURE_FONT: BmFont = {
  info: { face: 'Inter', size: 32 },
  common: { lineHeight: 38, base: 29, scaleW: 512, scaleH: 512 },
  chars: [
    { id: 65, x: 0,  y: 0, width: 22, height: 28, xoffset: 1, yoffset: 4, xadvance: 23, page: 0 },
    { id: 66, x: 24, y: 0, width: 20, height: 28, xoffset: 2, yoffset: 4, xadvance: 22, page: 0 },
  ],
  kernings: [
    { first: 65, second: 66, amount: -1 },
  ],
};
```

---

## Task 1: Add `msdf-bmfont-xml` dev dep and `gen:font` script

**Files:**
- Modify: `package.json` — add `msdf-bmfont-xml` as devDependency; add `gen:font` script
- Create: `packages/weasel-gl/scripts/gen-font.ts` — thin CLI wrapper

> Convention §3: use `--save-exact` so no caret range lands.

- [ ] **Step 1: Install dev dep**

```bash
npm install --save-exact --save-dev msdf-bmfont-xml@6.0.0
```

Verify no caret in `package.json`:

```bash
grep msdf-bmfont-xml package.json
```

Expected: `"msdf-bmfont-xml": "6.0.0"` (no `^` or `~`).

- [ ] **Step 2: Add `gen:font` script to `package.json`**

In the `"scripts"` block, add:

```json
"gen:font": "tsx packages/weasel-gl/scripts/gen-font.ts"
```

- [ ] **Step 3: Create the gen-font script**

Create `packages/weasel-gl/scripts/gen-font.ts`:

```ts
#!/usr/bin/env tsx
/**
 * gen-font — wraps msdf-bmfont-xml to produce a JSON metrics file + PNG atlas
 * for use in packages/weasel-gl/fonts/<family>/.
 *
 * Usage:
 *   pnpm gen:font --font path/to/Inter.ttf --out packages/weasel-gl/fonts/inter --size 32
 *
 * Output:
 *   <out>/inter.json   — BmFont metrics JSON
 *   <out>/inter.png    — MSDF atlas PNG (RGBA, 512×512)
 *
 * The prebuilt Inter atlas is already committed to the repo under
 * packages/weasel-gl/fonts/inter/. Re-run this script only when updating
 * the font or adding new charset coverage.
 *
 * Charset: ASCII + Latin-1 (U+0020–U+00FF, 224 codepoints).
 * CJK: deferred. See docs/superpowers/specs/ for the HarfBuzz follow-up.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

const fontPath = flag('font');
const outDir = flag('out');
const size = Number(flag('size') ?? 32);
const atlasSize = Number(flag('atlas') ?? 512);

if (!fontPath || !outDir) {
  console.error('Usage: pnpm gen:font --font <path> --out <dir> [--size 32] [--atlas 512]');
  process.exit(1);
}

const absOut = resolve(process.cwd(), outDir);
mkdirSync(absOut, { recursive: true });

const stem = basename(fontPath, extname(fontPath)).toLowerCase();
const outJson = resolve(absOut, `${stem}.json`);
const outPng = resolve(absOut, `${stem}.png`);

// ASCII + Latin-1: 0x0020–0x00FF. Pass as a charset string.
// msdf-bmfont-xml accepts --charset as a path to a file listing codepoints,
// or --string for a literal string. We use --charset-start / --charset-end
// flags supported by msdf-bmfont-xml v6.
execFileSync(
  'npx',
  [
    'msdf-bmfont',
    '-f', 'json',
    '-o', outJson,
    '--texture-size', `${atlasSize},${atlasSize}`,
    '--font-size', String(size),
    '--charset-start', '32',
    '--charset-end', '255',
    '--type', 'msdf',
    '--field-type', 'msdf',
    fontPath,
  ],
  { stdio: 'inherit' },
);

console.log(`✓ atlas → ${outPng}`);
console.log(`✓ metrics → ${outJson}`);
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json packages/weasel-gl/scripts/gen-font.ts
git commit -m "chore(weasel-gl): add msdf-bmfont-xml dev dep + gen:font script"
```

---

## Task 2: Pre-build and commit the Inter font atlas

**Files:**
- Create: `packages/weasel-gl/fonts/inter/inter.json`
- Create: `packages/weasel-gl/fonts/inter/inter.png`

> **Important:** The atlas files are binary + large text. Commit them directly to git (no LFS required for a 512×512 PNG, ~80–120 KB). PNG files should be tracked in `.gitattributes` as binary if not already.

- [ ] **Step 1: Obtain Inter TTF**

Download Inter v4 from https://github.com/rsms/inter/releases (Apache-2.0 license). Save as `/tmp/Inter-Regular.ttf`.

Alternatively, if `inter` is already installed as an npm package: `npx inter-ui` or find the TTF in `node_modules/@fontsource/inter/files/`.

Check for it first:

```bash
find node_modules -name 'inter-latin*.woff2' 2>/dev/null | head -3
# or the TTF variant:
find node_modules -name '*.ttf' -path '*inter*' 2>/dev/null | head -5
```

If found, use that path. Otherwise download manually or via:

```bash
npm install --save-exact --save-dev @fontsource/inter@5.0.0
find node_modules/@fontsource/inter -name '*.ttf' | head
```

> `@fontsource/inter` is Apache-2.0. Add it to devDependencies with `--save-exact`.

- [ ] **Step 2: Generate the atlas**

```bash
mkdir -p packages/weasel-gl/fonts/inter
pnpm gen:font \
  --font node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2 \
  --out packages/weasel-gl/fonts/inter \
  --size 32 \
  --atlas 512
```

> Note: `msdf-bmfont-xml` can handle WOFF2 if `ttx` is available. If it fails, convert to TTF first: `pip install fonttools && fonttools woff2 decompress <file>`.

Verify the output exists:

```bash
ls -lh packages/weasel-gl/fonts/inter/
```

Expected: `inter.json` (~50–80 KB) and `inter.png` (~80–120 KB, 512×512 RGBA).

Verify the JSON is valid BmFont format:

```bash
node -e "const f = require('./packages/weasel-gl/fonts/inter/inter.json'); console.log('chars:', f.chars.length, 'kernings:', f.kernings.length)"
```

Expected: `chars: 224` (or close; depends on coverage) and kernings > 0.

- [ ] **Step 3: Mark PNG as binary in .gitattributes**

If `packages/weasel-gl/fonts/**/*.png` is not already in `.gitattributes`:

```bash
echo 'packages/weasel-gl/fonts/**/*.png binary' >> .gitattributes
```

- [ ] **Step 4: Commit**

```bash
git add packages/weasel-gl/fonts/inter/ .gitattributes
git commit -m "feat(weasel-gl): add prebuilt Inter v4 MSDF atlas (Apache-2.0)"
```

---

## Task 3: `BmFont` types + `parseBmFont` loader

**Files:**
- Create: `packages/weasel-gl/src/FontAtlas.ts`
- Create: `packages/weasel-gl/src/FontAtlas.test.ts`

This module defines the TypeScript types for the BmFont JSON format and provides `parseBmFont(json: unknown): BmFont` — a defensive parser that throws if required fields are missing.

- [ ] **Step 1: Write the failing test**

Create `packages/weasel-gl/src/FontAtlas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseBmFont, FIXTURE_FONT } from './FontAtlas';

describe('parseBmFont', () => {
  it('parses a valid BmFont JSON object', () => {
    const font = parseBmFont(FIXTURE_FONT);
    expect(font.info.face).toBe('Inter');
    expect(font.common.lineHeight).toBe(38);
    expect(font.chars).toHaveLength(2);
    expect(font.kernings).toHaveLength(1);
  });

  it('indexes chars by codepoint for O(1) lookup', () => {
    const font = parseBmFont(FIXTURE_FONT);
    expect(font.charMap.get(65)).toMatchObject({ id: 65, xadvance: 23 });
    expect(font.charMap.get(66)).toMatchObject({ id: 66, xadvance: 22 });
    expect(font.charMap.get(99)).toBeUndefined();
  });

  it('indexes kernings as map[first][second]', () => {
    const font = parseBmFont(FIXTURE_FONT);
    expect(font.kerningMap.get(65)?.get(66)).toBe(-1);
    expect(font.kerningMap.get(65)?.get(67)).toBeUndefined();
  });

  it('throws on missing required fields', () => {
    expect(() => parseBmFont({})).toThrow();
    expect(() => parseBmFont({ info: {}, common: {}, chars: 'not-array' })).toThrow();
  });

  it('accepts JSON with no kernings array (defaults to [])', () => {
    const noKern = { ...FIXTURE_FONT, kernings: undefined };
    const font = parseBmFont(noKern);
    expect(font.kernings).toHaveLength(0);
    expect(font.kerningMap.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- packages/weasel-gl/src/FontAtlas.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `FontAtlas.ts`**

Create `packages/weasel-gl/src/FontAtlas.ts`:

```ts
/**
 * BmFont JSON types and parser for the MSDF atlas format produced by
 * msdf-bmfont-xml. The parser builds accelerator maps (charMap, kerningMap)
 * for O(1) glyph and kerning lookup during layout.
 */

export interface BmFontInfo {
  face: string;
  size: number;
}

export interface BmFontCommon {
  lineHeight: number;
  base: number;
  scaleW: number;
  scaleH: number;
}

export interface BmFontChar {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  xoffset: number;
  yoffset: number;
  xadvance: number;
  page: number;
}

export interface BmFontKerning {
  first: number;
  second: number;
  amount: number;
}

/** Raw JSON fields from msdf-bmfont-xml output. */
export interface BmFont {
  info: BmFontInfo;
  common: BmFontCommon;
  chars: BmFontChar[];
  kernings: BmFontKerning[];
  /** Map from codepoint → char (built by parseBmFont). */
  charMap: Map<number, BmFontChar>;
  /** Map from first-codepoint → (second-codepoint → amount). */
  kerningMap: Map<number, Map<number, number>>;
}

/**
 * Minimal fixture — two glyphs ('A'=65, 'B'=66) and one kerning pair.
 * Exported so unit tests can import a ready-to-use font without file I/O.
 */
export const FIXTURE_FONT = {
  info: { face: 'Inter', size: 32 },
  common: { lineHeight: 38, base: 29, scaleW: 512, scaleH: 512 },
  chars: [
    { id: 65, x: 0,  y: 0, width: 22, height: 28, xoffset: 1, yoffset: 4, xadvance: 23, page: 0 },
    { id: 66, x: 24, y: 0, width: 20, height: 28, xoffset: 2, yoffset: 4, xadvance: 22, page: 0 },
  ],
  kernings: [
    { first: 65, second: 66, amount: -1 },
  ],
};

/**
 * Parse and validate a BmFont JSON object. Throws a descriptive error if
 * required fields are absent or wrong type.
 *
 * Builds `charMap` and `kerningMap` accelerators as a post-processing step.
 */
export function parseBmFont(raw: unknown): BmFont {
  if (typeof raw !== 'object' || raw === null) throw new Error('parseBmFont: expected object');
  const r = raw as Record<string, unknown>;

  if (!r.info || typeof r.info !== 'object') throw new Error('parseBmFont: missing info');
  if (!r.common || typeof r.common !== 'object') throw new Error('parseBmFont: missing common');
  if (!Array.isArray(r.chars)) throw new Error('parseBmFont: chars must be an array');

  const info = r.info as BmFontInfo;
  const common = r.common as BmFontCommon;
  const chars = r.chars as BmFontChar[];
  const kernings: BmFontKerning[] = Array.isArray(r.kernings)
    ? (r.kernings as BmFontKerning[])
    : [];

  // Build accelerator maps.
  const charMap = new Map<number, BmFontChar>();
  for (const ch of chars) charMap.set(ch.id, ch);

  const kerningMap = new Map<number, Map<number, number>>();
  for (const k of kernings) {
    let inner = kerningMap.get(k.first);
    if (!inner) { inner = new Map(); kerningMap.set(k.first, inner); }
    inner.set(k.second, k.amount);
  }

  return { info, common, chars, kernings, charMap, kerningMap };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- packages/weasel-gl/src/FontAtlas.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-gl/src/FontAtlas.ts packages/weasel-gl/src/FontAtlas.test.ts
git commit -m "feat(weasel-gl): BmFont types + parseBmFont with charMap/kerningMap"
```

---

## Task 4: Glyph layout

**Files:**
- Create: `packages/weasel-gl/src/GlyphLayout.ts`
- Create: `packages/weasel-gl/src/GlyphLayout.test.ts`

Pure function: `layoutGlyphs(text, style, font) → GlyphQuad[]`. Walks codepoints left-to-right, advances the pen by `xadvance × scale + kerning × scale`, emits one `GlyphQuad` per printable glyph. Unknown codepoints emit a fallback `?` glyph (codepoint 63) or are skipped with a console warning if `?` is also absent. `scale = style.fontSize / font.info.size`.

`GlyphQuad` carries screen-space quad corners and atlas UV corners for the vertex buffer.

- [ ] **Step 1: Write the failing test**

Create `packages/weasel-gl/src/GlyphLayout.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { parseBmFont, FIXTURE_FONT } from './FontAtlas';
import { layoutGlyphs, type GlyphQuad } from './GlyphLayout';

const font = parseBmFont(FIXTURE_FONT);
// fontSize 32 == atlas size → scale 1.0; simplifies the expected math.
const style = { fontSize: 32, align: 'left' as const, baseline: 'alphabetic' as const };

describe('layoutGlyphs', () => {
  it('emits one quad per known glyph', () => {
    const quads = layoutGlyphs('AB', style, font);
    expect(quads).toHaveLength(2);
  });

  it('advances pen by xadvance + kerning', () => {
    const quads = layoutGlyphs('AB', style, font);
    // A: pen starts at 0, xoffset=1 → quad.x0 = 0 + 1 = 1
    // B: pen after A = 0 + 23 + kerning(A,B)=-1 = 22; xoffset=2 → quad.x0 = 24
    expect(quads[0].x0).toBeCloseTo(1);
    expect(quads[1].x0).toBeCloseTo(24);
  });

  it('applies fontSize scaling', () => {
    const halfStyle = { ...style, fontSize: 16 };
    const quads = layoutGlyphs('A', halfStyle, font);
    // scale = 16/32 = 0.5; A xoffset=1*0.5=0.5; A width=22*0.5=11
    expect(quads[0].x0).toBeCloseTo(0.5);
    expect(quads[0].x1 - quads[0].x0).toBeCloseTo(11);
  });

  it('applies a starting x/y origin offset', () => {
    const quads = layoutGlyphs('A', style, font, { x: 100, y: 200 });
    expect(quads[0].x0).toBeCloseTo(101);   // 100 + xoffset=1
    expect(quads[0].y0).toBeCloseTo(204);   // 200 + yoffset=4
  });

  it('emits UV coordinates normalized to 0..1 atlas space', () => {
    const quads = layoutGlyphs('A', style, font);
    // A: atlas x=0, y=0, w=22, h=28; atlas 512×512
    // u0=0/512=0, v0=0/512=0, u1=22/512≈0.043, v1=28/512≈0.055
    expect(quads[0].u0).toBeCloseTo(0 / 512);
    expect(quads[0].v0).toBeCloseTo(0 / 512);
    expect(quads[0].u1).toBeCloseTo(22 / 512, 4);
    expect(quads[0].v1).toBeCloseTo(28 / 512, 4);
  });

  it('emits a ? fallback quad for unknown codepoints', () => {
    // Add '?' (codepoint 63) to the fixture chars so fallback exists.
    const fontWithQ = parseBmFont({
      ...FIXTURE_FONT,
      chars: [
        ...FIXTURE_FONT.chars,
        { id: 63, x: 48, y: 0, width: 18, height: 28, xoffset: 1, yoffset: 4, xadvance: 18, page: 0 },
      ],
    });
    // 'Ω' (codepoint 937) is not in the fixture.
    const quads = layoutGlyphs('Ω', style, fontWithQ);
    expect(quads).toHaveLength(1);
    // The quad's UV x0 should point to the '?' glyph at atlas x=48.
    expect(quads[0].u0).toBeCloseTo(48 / 512, 4);
  });

  it('skips glyphs and warns when codepoint AND fallback are absent', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const quads = layoutGlyphs('Ω', style, font); // No '?' in FIXTURE_FONT
    expect(quads).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('937'));
    warnSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- packages/weasel-gl/src/GlyphLayout.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `GlyphLayout.ts`**

Create `packages/weasel-gl/src/GlyphLayout.ts`:

```ts
/**
 * MSDF glyph layout — pure function, no GL dependency.
 *
 * layoutGlyphs walks the text string codepoint-by-codepoint, looks up each
 * glyph in the BmFont charMap, applies kerning from kerningMap, and emits
 * one GlyphQuad per rendered glyph. Unknown codepoints fall back to '?' (63);
 * if '?' is also absent, the glyph is skipped with a console.warn.
 *
 * Complex script shaping (bidi, Arabic ligatures, Devanagari):
 * TODO(harfbuzz): complex script shaping deferred — requires HarfBuzz WASM.
 * See docs/superpowers/specs/ for the follow-up spec.
 */

import type { BmFont, BmFontChar } from './FontAtlas';

/** Axis-aligned quad corners (screen space) + UV corners (atlas 0..1 space). */
export interface GlyphQuad {
  /** Screen-space left edge of the glyph box. */
  x0: number;
  /** Screen-space top edge. */
  y0: number;
  /** Screen-space right edge. */
  x1: number;
  /** Screen-space bottom edge. */
  y1: number;
  /** Atlas U at left edge. */
  u0: number;
  /** Atlas V at top edge. */
  v0: number;
  /** Atlas U at right edge. */
  u1: number;
  /** Atlas V at bottom edge. */
  v1: number;
}

export interface GlyphLayoutStyle {
  fontSize: number;
  align: 'left' | 'center' | 'right';
  baseline?: 'alphabetic' | 'top' | 'middle';
}

export interface GlyphLayoutOrigin {
  x: number;
  y: number;
}

const FALLBACK_CODEPOINT = 63; // '?'

/**
 * Lay out `text` using `font` at `style.fontSize`, returning one quad per
 * rendered glyph. Quads are in screen space relative to `origin` (default 0,0).
 *
 * @param text    - String to lay out. Surrogate pairs decoded to codepoints.
 * @param style   - Font size and alignment.
 * @param font    - Parsed BmFont with charMap and kerningMap.
 * @param origin  - Top-left anchor in screen space. Default { x:0, y:0 }.
 */
export function layoutGlyphs(
  text: string,
  style: GlyphLayoutStyle,
  font: BmFont,
  origin: GlyphLayoutOrigin = { x: 0, y: 0 },
): GlyphQuad[] {
  const scale = style.fontSize / font.info.size;
  const atlasW = font.common.scaleW;
  const atlasH = font.common.scaleH;

  const quads: GlyphQuad[] = [];
  let penX = origin.x;
  const penY = origin.y;

  // Decode to codepoints (handles surrogate pairs for BMP+SMP).
  const codepoints = [...text].map((ch) => ch.codePointAt(0)!);

  let prevCp: number | undefined;
  for (const cp of codepoints) {
    let glyph: BmFontChar | undefined = font.charMap.get(cp);

    if (!glyph) {
      // Attempt fallback.
      const fb = font.charMap.get(FALLBACK_CODEPOINT);
      if (!fb) {
        console.warn(
          `weasel-gl text: no glyph for codepoint ${cp} and no fallback '?'; skipping.`,
        );
        prevCp = cp;
        continue;
      }
      glyph = fb;
    }

    // Apply kerning from previous glyph.
    if (prevCp !== undefined) {
      const kern = font.kerningMap.get(prevCp)?.get(cp) ?? 0;
      penX += kern * scale;
    }

    const qx0 = penX + glyph.xoffset * scale;
    const qy0 = penY + glyph.yoffset * scale;
    const qx1 = qx0 + glyph.width * scale;
    const qy1 = qy0 + glyph.height * scale;

    const u0 = glyph.x / atlasW;
    const v0 = glyph.y / atlasH;
    const u1 = (glyph.x + glyph.width) / atlasW;
    const v1 = (glyph.y + glyph.height) / atlasH;

    quads.push({ x0: qx0, y0: qy0, x1: qx1, y1: qy1, u0, v0, u1, v1 });

    penX += glyph.xadvance * scale;
    prevCp = cp;
  }

  return quads;
}

/**
 * Build a flat `Float32Array` interleaving x,y,u,v per vertex, 4 vertices
 * per quad, ready to upload as a GL_ARRAY_BUFFER. Vertex order per quad:
 * [top-left, top-right, bottom-left, bottom-right].
 *
 * Separate helper so tests can validate quad positions without touching GL.
 */
export function quadsToVertexBuffer(quads: GlyphQuad[]): Float32Array {
  const out = new Float32Array(quads.length * 4 * 4); // 4 verts × (x,y,u,v)
  let i = 0;
  for (const q of quads) {
    // top-left
    out[i++] = q.x0; out[i++] = q.y0; out[i++] = q.u0; out[i++] = q.v0;
    // top-right
    out[i++] = q.x1; out[i++] = q.y0; out[i++] = q.u1; out[i++] = q.v0;
    // bottom-left
    out[i++] = q.x0; out[i++] = q.y1; out[i++] = q.u0; out[i++] = q.v1;
    // bottom-right
    out[i++] = q.x1; out[i++] = q.y1; out[i++] = q.u1; out[i++] = q.v1;
  }
  return out;
}

/**
 * Build a `Uint32Array` index buffer for `quadCount` quads. Each quad is
 * two triangles: [0,1,2, 1,3,2] relative to the quad's base vertex.
 */
export function buildQuadIndexBuffer(quadCount: number): Uint32Array {
  const out = new Uint32Array(quadCount * 6);
  let i = 0;
  for (let q = 0; q < quadCount; q++) {
    const base = q * 4;
    out[i++] = base;     out[i++] = base + 1; out[i++] = base + 2;
    out[i++] = base + 1; out[i++] = base + 3; out[i++] = base + 2;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- packages/weasel-gl/src/GlyphLayout.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-gl/src/GlyphLayout.ts packages/weasel-gl/src/GlyphLayout.test.ts
git commit -m "feat(weasel-gl): glyph layout (pen advance, kerning, UV mapping, fallback)"
```

---

## Task 5: `quadsToVertexBuffer` + `buildQuadIndexBuffer` tests

These helpers live in `GlyphLayout.ts` (already written above) but need their own test coverage.

**Files:**
- Modify: `packages/weasel-gl/src/GlyphLayout.test.ts` — append

- [ ] **Step 1: Write the failing tests**

Append to `packages/weasel-gl/src/GlyphLayout.test.ts`:

```ts
import { quadsToVertexBuffer, buildQuadIndexBuffer } from './GlyphLayout';

describe('quadsToVertexBuffer', () => {
  it('produces 16 floats per quad (4 verts × 4 components)', () => {
    const quads = layoutGlyphs('AB', style, font);
    const buf = quadsToVertexBuffer(quads);
    expect(buf.length).toBe(quads.length * 16);
  });

  it('first four values of first quad are x0,y0,u0,v0 of first glyph', () => {
    const quads = layoutGlyphs('A', style, font);
    const buf = quadsToVertexBuffer(quads);
    expect(buf[0]).toBeCloseTo(quads[0].x0);
    expect(buf[1]).toBeCloseTo(quads[0].y0);
    expect(buf[2]).toBeCloseTo(quads[0].u0);
    expect(buf[3]).toBeCloseTo(quads[0].v0);
  });
});

describe('buildQuadIndexBuffer', () => {
  it('produces 6 indices per quad', () => {
    expect(buildQuadIndexBuffer(3).length).toBe(18);
  });

  it('first two triangles of first quad are [0,1,2] and [1,3,2]', () => {
    const idx = buildQuadIndexBuffer(1);
    expect(Array.from(idx)).toEqual([0, 1, 2, 1, 3, 2]);
  });

  it('second quad starts at base vertex 4', () => {
    const idx = buildQuadIndexBuffer(2);
    expect(Array.from(idx.slice(6))).toEqual([4, 5, 6, 5, 7, 6]);
  });
});
```

- [ ] **Step 2: Run test to verify they pass (implementations already exist)**

```bash
npm test -- packages/weasel-gl/src/GlyphLayout.test.ts
```

Expected: PASS, all tests including the new 5.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-gl/src/GlyphLayout.test.ts
git commit -m "test(weasel-gl): vertex buffer + index buffer helpers for glyph quads"
```

---

## Task 6: GL texture cache

**Files:**
- Create: `packages/weasel-gl/src/GLTextureCache.ts`
- Create: `packages/weasel-gl/src/GLTextureCache.test.ts`

A cache of GL textures keyed by a `TextureHandle` (opaque string id). `upload(id, image)` uploads an `HTMLImageElement | ImageBitmap | ImageData` and returns a handle. `bind(handle, unit)` binds the texture to a texture unit. On context loss, the renderer discards the cache and creates a new one (same pattern as `GLMeshCache`).

Atlas textures use `gl.RGBA` / `UNSIGNED_BYTE`, linear filtering (`gl.LINEAR`), no mipmaps (MSDF works correctly without them and mipmap generation is expensive for multi-channel SDF data).

- [ ] **Step 1: Write the failing test**

Create `packages/weasel-gl/src/GLTextureCache.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from '../../test-utils/glRecorder';
import { GLTextureCache } from './GLTextureCache';

// Minimal ImageData-like object the GL recorder accepts.
const fakeImage = { width: 4, height: 4, data: new Uint8ClampedArray(64) } as ImageData;

describe('GLTextureCache', () => {
  it('upload() returns an opaque handle string', () => {
    const { gl } = makeGLRecorder();
    const cache = new GLTextureCache(gl);
    const handle = cache.upload('inter', fakeImage);
    expect(typeof handle).toBe('string');
    expect(handle).toBe('inter');
  });

  it('upload() calls createTexture, texImage2D', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLTextureCache(gl);
    cache.upload('inter', fakeImage);
    expect(calls.some((c) => c.name === 'createTexture')).toBe(true);
    expect(calls.some((c) => c.name === 'texImage2D')).toBe(true);
  });

  it('bind() calls bindTexture + activeTexture', () => {
    const { gl, calls, reset } = makeGLRecorder();
    const cache = new GLTextureCache(gl);
    cache.upload('inter', fakeImage);
    reset();
    cache.bind('inter', 0);
    expect(calls.some((c) => c.name === 'activeTexture')).toBe(true);
    expect(calls.some((c) => c.name === 'bindTexture')).toBe(true);
  });

  it('upload() for the same id is a no-op on second call (cached)', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLTextureCache(gl);
    cache.upload('inter', fakeImage);
    const countAfterFirst = calls.filter((c) => c.name === 'createTexture').length;
    cache.upload('inter', fakeImage);
    const countAfterSecond = calls.filter((c) => c.name === 'createTexture').length;
    expect(countAfterFirst).toBe(countAfterSecond);
  });

  it('has() returns true after upload, false otherwise', () => {
    const { gl } = makeGLRecorder();
    const cache = new GLTextureCache(gl);
    expect(cache.has('inter')).toBe(false);
    cache.upload('inter', fakeImage);
    expect(cache.has('inter')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- packages/weasel-gl/src/GLTextureCache.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `GLTextureCache.ts`**

Create `packages/weasel-gl/src/GLTextureCache.ts`:

```ts
/**
 * GL texture upload + cache for MSDF font atlases and (future) images.
 *
 * Textures are keyed by a string `TextureHandle` (the font family name or
 * image id). Upload happens once; subsequent calls for the same handle are
 * no-ops. The cache is GL-context-bound; discard and create a new one on
 * context loss (same pattern as GLMeshCache).
 *
 * Atlas format: RGBA UNSIGNED_BYTE, linear filtering, no mipmaps.
 * Mipmap generation is deliberately skipped: MSDF works correctly with
 * linear filtering and mipmap resampling corrupts the multi-channel SDF signal.
 *
 * Conventions §2: shader output must be premultiplied. This cache does not
 * modify texture data — the SDF fragment shader handles alpha math.
 */

type TexSource = HTMLImageElement | ImageBitmap | ImageData | HTMLCanvasElement;

export class GLTextureCache {
  private readonly map = new Map<string, WebGLTexture>();

  constructor(private readonly gl: WebGL2RenderingContext) {}

  /** Returns true if `id` has already been uploaded. */
  has(id: string): boolean {
    return this.map.has(id);
  }

  /**
   * Upload `source` as a GL texture tagged `id`. If `id` is already cached,
   * this is a no-op and the existing handle is returned.
   *
   * @returns The `id` string (used as the opaque TextureHandle).
   */
  upload(id: string, source: TexSource): string {
    if (this.map.has(id)) return id;

    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error(`GLTextureCache: createTexture failed for id="${id}"`);

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);

    // Linear filtering; no mipmaps (MSDF-correct).
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_2D, null);

    this.map.set(id, tex);
    return id;
  }

  /**
   * Bind the texture for `id` to texture unit `unit` (0-indexed).
   * Throws if `id` has not been uploaded.
   */
  bind(id: string, unit: number): void {
    const tex = this.map.get(id);
    if (!tex) throw new Error(`GLTextureCache: texture "${id}" not uploaded`);
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }
}
```

- [ ] **Step 4: Extend the GL recorder to handle `TEXTURE_2D` and texture constants**

The mock GL recorder in `test-utils/glRecorder.ts` needs constants for texture operations. Add these to the `GL_CONSTANTS` map:

```ts
// In GL_CONSTANTS, add:
TEXTURE_2D: 0x0DE1,
TEXTURE0: 0x84C0,
RGBA: 0x1908,
UNSIGNED_BYTE: 0x1401,
TEXTURE_MIN_FILTER: 0x2801,
TEXTURE_MAG_FILTER: 0x2800,
LINEAR: 0x2601,
TEXTURE_WRAP_S: 0x2802,
TEXTURE_WRAP_T: 0x2803,
CLAMP_TO_EDGE: 0x812F,
```

Edit `packages/weasel-gl/test-utils/glRecorder.ts`:

In the `GL_CONSTANTS` object, append those key/value pairs. Keep the existing entries; just add to the block.

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- packages/weasel-gl/src/GLTextureCache.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-gl/src/GLTextureCache.ts packages/weasel-gl/src/GLTextureCache.test.ts packages/weasel-gl/test-utils/glRecorder.ts
git commit -m "feat(weasel-gl): GLTextureCache — atlas upload, linear filter, no mipmaps"
```

---

## Task 7: `registerFont` public API

**Files:**
- Create: `packages/weasel-gl/src/registerFont.ts`
- Create: `packages/weasel-gl/src/registerFont.test.ts`

`registerFont(family, atlasUrl)` is async: it fetches the JSON metrics, fetches the PNG atlas as an `ImageBitmap`, and stores both in the module-level `FontRegistry`. The registry is queried by `drawText` at render time. If the registry doesn't have a font for the requested family, `drawText` logs a warning and skips rendering (not an error — fonts may still be loading).

The registry holds a `GLTextureCache` reference, but `registerFont` itself is GL-context-agnostic: it stores the parsed `BmFont` and the fetched `ImageBitmap`. The renderer calls `ensureFontTexture(family, gl, textureCache)` at render time to lazily upload the atlas when the GL context is first available.

> This split (fetch-time vs. render-time) avoids a circular dependency: `registerFont` doesn't need `gl` or `WeaselRenderer`, and the renderer doesn't need to know about fetch logic.

- [ ] **Step 1: Write the failing test**

Create `packages/weasel-gl/src/registerFont.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerFont,
  getFont,
  _resetFontRegistryForTests,
} from './registerFont';
import { FIXTURE_FONT } from './FontAtlas';

// Stub global fetch to return fixture data.
function stubFetch() {
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(FIXTURE_FONT),
      });
    }
    if (url.endsWith('.png')) {
      // Return a minimal 1-byte body; createImageBitmap will be stubbed below.
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  }) as typeof fetch;

  // Stub createImageBitmap so jsdom doesn't fail.
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
}

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

describe('registerFont', () => {
  it('stores a parsed BmFont after successful fetch', async () => {
    await registerFont('inter', '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const entry = getFont('inter');
    expect(entry).not.toBeNull();
    expect(entry!.font.info.face).toBe('Inter');
    expect(entry!.font.charMap.size).toBe(2);
  });

  it('calling twice for the same family is a no-op (returns same entry)', async () => {
    await registerFont('inter', '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const first = getFont('inter');
    await registerFont('inter', '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const second = getFont('inter');
    expect(first).toBe(second);
    // fetch should have been called only twice (once per URL on first call).
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  it('getFont returns null for unknown family', () => {
    expect(getFont('unknown')).toBeNull();
  });

  it('rejects with an informative error when fetch fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network error'));
    await expect(
      registerFont('bad', '/bad.json', '/bad.png'),
    ).rejects.toThrow('weasel-gl registerFont');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- packages/weasel-gl/src/registerFont.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `registerFont.ts`**

Create `packages/weasel-gl/src/registerFont.ts`:

```ts
/**
 * FontRegistry and registerFont() public API.
 *
 * registerFont(family, metricsUrl, atlasUrl) is async: it fetches JSON
 * metrics + PNG atlas and stores both in the module-level registry.
 *
 * At render time, WeaselRenderer calls ensureFontTexture() to lazily upload
 * the atlas ImageBitmap to GL the first time a font is drawn. This split
 * keeps registerFont GL-context-agnostic (no circular dep on WeaselRenderer).
 *
 * CJK coverage: deferred. The default Inter atlas covers ASCII + Latin-1.
 * Extending coverage requires generating a larger atlas and calling
 * registerFont with the extended metrics + PNG.
 */

import { parseBmFont, type BmFont } from './FontAtlas';
import type { GLTextureCache } from './GLTextureCache';

export interface FontEntry {
  font: BmFont;
  bitmap: ImageBitmap;
  /** Set to true once the GL texture has been uploaded via ensureFontTexture(). */
  textureUploaded: boolean;
}

let registry = new Map<string, FontEntry>();

/** Test helper. Do not call from product code. */
export function _resetFontRegistryForTests(): void {
  registry = new Map();
}

/**
 * Returns the registered font entry for `family`, or null if not registered.
 * Used by drawText to look up the font at render time.
 */
export function getFont(family: string): FontEntry | null {
  return registry.get(family) ?? null;
}

/**
 * Fetch and register a font. Subsequent calls for the same `family` are
 * no-ops. Throws `Error('weasel-gl registerFont: ...')` if any fetch fails.
 *
 * @param family     - Logical name (e.g. 'inter', 'roboto').
 * @param metricsUrl - URL to the BmFont JSON metrics file.
 * @param atlasUrl   - URL to the MSDF atlas PNG.
 */
export async function registerFont(
  family: string,
  metricsUrl: string,
  atlasUrl: string,
): Promise<void> {
  if (registry.has(family)) return;

  try {
    const [metricsRes, atlasRes] = await Promise.all([
      fetch(metricsUrl),
      fetch(atlasUrl),
    ]);

    if (!metricsRes.ok) {
      throw new Error(`HTTP ${metricsRes.status} fetching metrics from ${metricsUrl}`);
    }
    if (!atlasRes.ok) {
      throw new Error(`HTTP ${atlasRes.status} fetching atlas from ${atlasUrl}`);
    }

    const [rawJson, blob] = await Promise.all([
      metricsRes.json(),
      atlasRes.blob(),
    ]);

    const font = parseBmFont(rawJson);
    const bitmap = await createImageBitmap(blob);

    registry.set(family, { font, bitmap, textureUploaded: false });
  } catch (err) {
    throw new Error(
      `weasel-gl registerFont("${family}"): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Lazily upload the font atlas to GL the first time the font is used in a
 * render frame. Called by drawText before binding the texture.
 *
 * If the font is not registered, returns false (caller logs and skips).
 */
export function ensureFontTexture(
  family: string,
  textureCache: GLTextureCache,
): boolean {
  const entry = registry.get(family);
  if (!entry) return false;
  if (!entry.textureUploaded) {
    textureCache.upload(family, entry.bitmap);
    entry.textureUploaded = true;
  }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- packages/weasel-gl/src/registerFont.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-gl/src/registerFont.ts packages/weasel-gl/src/registerFont.test.ts
git commit -m "feat(weasel-gl): registerFont() — async fetch + FontRegistry"
```

---

## Task 8: MSDF text SDF fragment shader

**Files:**
- Create: `packages/weasel-gl/src/shaders/textSdf.ts`

> **Convention §2 applies here.** Fragment shader output MUST be premultiplied: `vec4(textColor.rgb * a, a)` where `a = textColor.a * smoothstep(...) * u_alpha`. The browser composites the canvas expecting premultiplied pixels. Blend func stays `gl.ONE, gl.ONE_MINUS_SRC_ALPHA`.

The text shader differs from the path-fill shader in two ways:
1. It takes interleaved x,y,u,v attributes (not just x,y) because each vertex has a UV coordinate into the atlas.
2. The fragment shader samples the atlas as an MSDF texture and recovers the SDF value via `median(r, g, b)`, then applies `smoothstep` for anti-aliasing.

No test for this task (GLSL source is a string; the real test is visual correctness in the smoke). The shader is exported for `WeaselRenderer` to compile.

- [ ] **Step 1: Create `packages/weasel-gl/src/shaders/textSdf.ts`**

```ts
/**
 * GLSL ES 3.0 sources for the built-in MSDF text shader.
 *
 * Vertex inputs (interleaved, stride 16 bytes = 4 × float):
 *   a_position  vec2   screen-space x,y of the glyph quad vertex
 *   a_uv        vec2   atlas UV (0..1)
 *
 * Uniforms:
 *   u_proj      mat3   screen → clip projection (same convention as pathFill)
 *   u_model     mat3   cumulative group transform (same convention as pathFill)
 *   u_atlas     sampler2D  the MSDF atlas texture (bound to TEXTURE0)
 *   u_color     vec4   text color (straight RGBA)
 *   u_alpha     float  group alpha multiplier
 *   u_aaWidth   float  smoothstep half-width for anti-aliasing (default 0.05)
 *
 * Fragment output: PREMULTIPLIED alpha — `vec4(color.rgb * a, a)`.
 * See conventions §2: browser premultipliedAlpha:true requires premultiplied
 * fragment output. Blend func is ONE / ONE_MINUS_SRC_ALPHA.
 *
 * MSDF channel layout: msdf-bmfont-xml outputs R,G,B channels as independent
 * signed-distance fields covering different edge directions. The true SDF value
 * is the median of R,G,B. This recovers sharp outlines while averaging out
 * single-channel aliasing artifacts.
 *
 *   median(r,g,b) = max(min(r,g), min(max(r,g),b))
 *
 * Anti-aliasing: smoothstep(0.5 - aaWidth, 0.5 + aaWidth, sdfValue) maps
 * the SDF coverage into a smooth [0..1] mask. aaWidth=0.05 gives ~2px AA at
 * the atlas resolution (32px glyphs, 512×512 atlas).
 *
 * The 0.5 threshold is the canonical "on the outline" value for MSDF atlases
 * produced by msdf-bmfont-xml. Shifting this threshold allows bold/thin effects.
 */

export const TEXT_VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
in vec2 a_uv;
uniform mat3 u_proj;
uniform mat3 u_model;
out vec2 v_uv;
void main() {
  vec3 screen = u_model * vec3(a_position, 1.0);
  vec3 clip   = u_proj  * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_uv = a_uv;
}
`;

export const TEXT_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_atlas;
uniform vec4 u_color;
uniform float u_alpha;
uniform float u_aaWidth;
out vec4 outColor;

// Recover MSDF value from three independent per-channel SDFs.
// median(r,g,b) eliminates single-channel noise while preserving sharp edges.
float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

void main() {
  vec3 sdf = texture(u_atlas, v_uv).rgb;
  float sdfVal = median(sdf.r, sdf.g, sdf.b);
  float aaW = u_aaWidth > 0.0 ? u_aaWidth : 0.05;
  float coverage = smoothstep(0.5 - aaW, 0.5 + aaW, sdfVal);
  // Premultiplied alpha output (conventions §2).
  float a = u_color.a * coverage * u_alpha;
  outColor = vec4(u_color.rgb * a, a);
}
`;

export const TEXT_SDF_UNIFORMS = [
  'u_proj', 'u_model', 'u_atlas', 'u_color', 'u_alpha', 'u_aaWidth',
] as const;

export const TEXT_SDF_ATTRIBUTES = ['a_position', 'a_uv'] as const;
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-gl/src/shaders/textSdf.ts
git commit -m "feat(weasel-gl): MSDF text SDF fragment shader (median + smoothstep, premultiplied)"
```

---

## Task 9: `TextDrawCommand` variant

**Files:**
- Modify: `packages/weasel-gl/src/DrawCommand.ts`

Extend the `DrawCommand` union with `kind: 'text'`. The `TextStyle` type from `@orochi235/weasel` is reused (via a re-export of `TextStyle` from `src/features/text/textStyle.ts` through the main barrel).

- [ ] **Step 1: Verify `TextStyle` is exported from `@orochi235/weasel`**

```bash
grep -n 'TextStyle' src/index.ts | head -10
```

If `TextStyle` is not exported, add it:

```ts
export type { TextStyle, ResolvedTextStyle, resolveTextStyle } from './features/text/textStyle';
```

Run `npm run typecheck` to confirm.

- [ ] **Step 2: Add `TextDrawCommand` to `DrawCommand.ts`**

Edit `packages/weasel-gl/src/DrawCommand.ts`:

```ts
import type { Path, Stroke, TextStyle } from '@orochi235/weasel';
import type { Mat3 } from './mat3';

/**
 * Solid-fill paint variant (subset of the spec's full Paint union).
 * Step 1 supports only solid; pattern + gradients arrive in step 4.
 */
export interface SolidPaint {
  fill?: 'solid';
  color: string;
  opacity?: number;
}

/** DrawCommand variants implemented through step 3 (path + stroke + group + text). */
export type DrawCommand = PathDrawCommand | GroupDrawCommand | TextDrawCommand;

export interface PathDrawCommand {
  kind: 'path';
  path: Path;
  fill?: SolidPaint;
  stroke?: Stroke;
}

export interface GroupDrawCommand {
  kind: 'group';
  transform?: Mat3;
  alpha?: number;
  children: DrawCommand[];
}

/**
 * Text draw command. Renders `text` at (`x`, `y`) in screen space.
 *
 * `style.fontFamily` must match a family registered via `registerFont()`.
 * If the font isn't registered yet, `drawText` logs a warning and skips.
 *
 * Step 3 scope: single-line, left-to-right, ASCII + Latin-1 only.
 * Multi-line wrapping lands in step 7 (port of createTextLayer).
 */
export interface TextDrawCommand {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  style: TextStyle;
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/weasel-gl/src/DrawCommand.ts src/index.ts
git commit -m "feat(weasel-gl): TextDrawCommand variant; export TextStyle from weasel barrel"
```

---

## Task 10: `drawText` in `draw.ts`

**Files:**
- Modify: `packages/weasel-gl/src/draw.ts`
- Modify: `packages/weasel-gl/src/draw.test.ts`

Wire up the `'text'` dispatch case. `drawText` must:
1. Call `ensureFontTexture(family, textureCache)` → if false (font not registered), `console.warn` + return.
2. Call `layoutGlyphs` with the text, style, and font.
3. Call `quadsToVertexBuffer` and `buildQuadIndexBuffer`.
4. Upload the vertex data as a dynamic `ARRAY_BUFFER` (new buffer each draw call in step 3; a reusable pool comes later).
5. Use the `textSdf` shader program; set uniforms; bind the atlas texture to unit 0; draw.

The `DrawContext` must gain `textSdf: ShaderProgram` and `textureCache: GLTextureCache` fields. `WeaselRenderer` populates both.

- [ ] **Step 1: Write the failing tests**

Append to `packages/weasel-gl/src/draw.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeGLRecorder } from '../../test-utils/glRecorder';
import { dispatch, type DrawContext } from './draw';
import { ShaderProgram } from './ShaderProgram';
import { GLMeshCache } from './GLMeshCache';
import { GroupState } from './GroupState';
import { GLTextureCache } from './GLTextureCache';
import * as registerFontModule from './registerFont';
import { parseBmFont, FIXTURE_FONT } from './FontAtlas';
import type { TextDrawCommand } from './DrawCommand';

// Build a minimal DrawContext with a text shader and texture cache.
function makeCtx(gl: WebGL2RenderingContext): DrawContext {
  // Minimal stub ShaderProgram (recorder returns synthetic handles).
  const pathFill = new ShaderProgram(gl, 'void main(){}', 'out vec4 c; void main(){c=vec4(0);}');
  const textSdf = new ShaderProgram(gl, 'void main(){}', 'out vec4 c; void main(){c=vec4(0);}');
  const meshCache = new GLMeshCache(gl, 0);
  const textureCache = new GLTextureCache(gl);
  const state = new GroupState();
  return { gl, pathFill, textSdf, meshCache, textureCache, state, widthCss: 800, heightCss: 600 };
}

describe('dispatch text command', () => {
  beforeEach(() => {
    registerFontModule._resetFontRegistryForTests();
  });

  it('skips rendering and warns when font is not registered', () => {
    const { gl } = makeGLRecorder();
    const ctx = makeCtx(gl as unknown as WebGL2RenderingContext);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cmd: TextDrawCommand = {
      kind: 'text', x: 0, y: 0, text: 'hi', style: { fontFamily: 'inter', fontSize: 32 },
    };
    dispatch(ctx, cmd);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('inter'));
    warnSpy.mockRestore();
  });

  it('calls useProgram(textSdf) when font is registered', async () => {
    // Register a fake font entry directly.
    vi.spyOn(registerFontModule, 'ensureFontTexture').mockReturnValue(true);
    vi.spyOn(registerFontModule, 'getFont').mockReturnValue({
      font: parseBmFont(FIXTURE_FONT),
      bitmap: { width: 512, height: 512 } as ImageBitmap,
      textureUploaded: true,
    });

    const { gl, calls } = makeGLRecorder();
    const ctx = makeCtx(gl as unknown as WebGL2RenderingContext);

    const cmd: TextDrawCommand = {
      kind: 'text', x: 0, y: 0, text: 'A', style: { fontFamily: 'inter', fontSize: 32 },
    };
    dispatch(ctx, cmd);

    const useProgramCalls = calls.filter((c) => c.name === 'useProgram');
    // The textSdf program handle should be used.
    expect(useProgramCalls.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- packages/weasel-gl/src/draw.test.ts
```

Expected: FAIL — `textSdf` not on `DrawContext`, `dispatch` doesn't handle `'text'`.

- [ ] **Step 3: Extend `DrawContext` and wire `drawText`**

Edit `packages/weasel-gl/src/draw.ts`:

Add `textSdf: ShaderProgram` and `textureCache: GLTextureCache` to `DrawContext`:

```ts
import type { Stroke, TextStyle } from '@orochi235/weasel';
import type { DrawCommand, GroupDrawCommand, PathDrawCommand, TextDrawCommand } from './DrawCommand';
import type { GroupState } from './GroupState';
import type { GLMeshCache, GLMeshHandle } from './GLMeshCache';
import type { ShaderProgram } from './ShaderProgram';
import type { GLTextureCache } from './GLTextureCache';
import { mat3 } from './mat3';
import { getMesh } from './cache';
import { parseColor } from './color';
import { tessellateStroke } from './stroke';
import { getFont, ensureFontTexture } from './registerFont';
import { layoutGlyphs, quadsToVertexBuffer, buildQuadIndexBuffer } from './GlyphLayout';
import { resolveTextStyle } from '@orochi235/weasel';

export interface DrawContext {
  gl: WebGL2RenderingContext;
  pathFill: ShaderProgram;
  textSdf: ShaderProgram;
  meshCache: GLMeshCache;
  textureCache: GLTextureCache;
  state: GroupState;
  widthCss: number;
  heightCss: number;
}
```

Add `'text'` to the `dispatch` switch:

```ts
export function dispatch(ctx: DrawContext, cmd: DrawCommand): void {
  switch (cmd.kind) {
    case 'group': return drawGroup(ctx, cmd);
    case 'path':  return drawPath(ctx, cmd);
    case 'text':  return drawText(ctx, cmd);
  }
}
```

Add `drawText`:

```ts
function drawText(ctx: DrawContext, cmd: TextDrawCommand): void {
  const style = resolveTextStyle(cmd.style);
  const family = style.fontFamily;

  // Lazily upload font atlas to GL on first use.
  if (!ensureFontTexture(family, ctx.textureCache)) {
    console.warn(`weasel-gl drawText: font "${family}" not registered; call registerFont() first.`);
    return;
  }

  const entry = getFont(family);
  if (!entry) return; // ensureFontTexture returned true, so this shouldn't happen.

  const quads = layoutGlyphs(
    cmd.text,
    { fontSize: style.fontSize, align: style.align, baseline: 'alphabetic' },
    entry.font,
    { x: cmd.x, y: cmd.y },
  );
  if (quads.length === 0) return;

  const vertices = quadsToVertexBuffer(quads);
  const indices = buildQuadIndexBuffer(quads.length);

  const gl = ctx.gl;
  gl.useProgram(ctx.textSdf.handle);

  // Upload dynamic vertex buffer.
  const vao = gl.createVertexArray();
  if (!vao) throw new Error('drawText: createVertexArray returned null');
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  if (!vbo) throw new Error('drawText: createBuffer (VBO) returned null');
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

  // Interleaved layout: a_position (2 floats) + a_uv (2 floats) = stride 16 bytes.
  const stride = 16;
  const aPosLoc = ctx.textSdf.attribute('a_position');
  const aUvLoc  = ctx.textSdf.attribute('a_uv');
  if (aPosLoc !== undefined) {
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, stride, 0);
  }
  if (aUvLoc !== undefined) {
    gl.enableVertexAttribArray(aUvLoc);
    gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, stride, 8);
  }

  const ibo = gl.createBuffer();
  if (!ibo) throw new Error('drawText: createBuffer (IBO) returned null');
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);

  // Uniforms.
  const proj  = mat3.screenToClip(ctx.widthCss, ctx.heightCss);
  gl.uniformMatrix3fv(ctx.textSdf.uniform('u_proj')!,  false, proj);
  gl.uniformMatrix3fv(ctx.textSdf.uniform('u_model')!, false, ctx.state.transform);

  // Parse text color from the style's fill (solid paint only for step 3).
  let r = 0, g = 0, b = 0, a = 1;
  if (style.fill && 'color' in style.fill) {
    [r, g, b, a] = parseColor(style.fill.color);
  }
  gl.uniform4f(ctx.textSdf.uniform('u_color')!, r, g, b, a);
  gl.uniform1f(ctx.textSdf.uniform('u_alpha')!, ctx.state.alpha);
  gl.uniform1f(ctx.textSdf.uniform('u_aaWidth')!, 0.05);

  // Bind atlas texture to unit 0.
  ctx.textureCache.bind(family, 0);
  gl.uniform1i(ctx.textSdf.uniform('u_atlas')!, 0);

  gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- packages/weasel-gl/src/draw.test.ts
```

Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-gl/src/draw.ts packages/weasel-gl/src/draw.test.ts
git commit -m "feat(weasel-gl): drawText — glyph layout + MSDF shader dispatch"
```

---

## Task 11: Wire `textSdf` program into `WeaselRenderer`

**Files:**
- Modify: `packages/weasel-gl/src/WeaselRenderer.ts`
- Modify: `packages/weasel-gl/src/WeaselRenderer.test.ts`

> **Convention §1 applies here.** The unit test (GL recorder) won't catch atlas-binding or texture-parameter bugs. Pixel correctness is verified in the smoke spec (Task 14). The test here only checks that the renderer constructs a `textSdf` program and that `DrawContext` has the new fields.

- [ ] **Step 1: Write the failing test**

Append to `packages/weasel-gl/src/WeaselRenderer.test.ts`:

```ts
describe('WeaselRenderer text fields', () => {
  it('exposes _textSdf() and _textureCache() after construction', () => {
    const { gl } = makeGLRecorder();
    const r = new WeaselRenderer({
      gl: gl as unknown as WebGL2RenderingContext,
      width: 800, height: 600, dpr: 1,
    });
    expect(r._textSdf()).toBeDefined();
    expect(r._textureCache()).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- packages/weasel-gl/src/WeaselRenderer.test.ts
```

Expected: FAIL — `_textSdf` / `_textureCache` not on `WeaselRenderer`.

- [ ] **Step 3: Update `WeaselRenderer`**

Edit `packages/weasel-gl/src/WeaselRenderer.ts`:

Add imports:

```ts
import { ShaderProgram } from './ShaderProgram';
import {
  TEXT_VERT_SRC, TEXT_FRAG_SRC, TEXT_SDF_UNIFORMS, TEXT_SDF_ATTRIBUTES,
} from './shaders/textSdf';
import { GLTextureCache } from './GLTextureCache';
```

Add fields:

```ts
private textSdf: ShaderProgram;
private textureCache: GLTextureCache;
```

In the constructor, after the pathFill program lines, add:

```ts
this.textSdf = new ShaderProgram(this.gl, TEXT_VERT_SRC, TEXT_FRAG_SRC);
this.textSdf.lookupUniforms(TEXT_SDF_UNIFORMS);
this.textSdf.lookupAttributes(TEXT_SDF_ATTRIBUTES);
this.textureCache = new GLTextureCache(this.gl);
```

In `onContextRestored()`, after rebuilding `pathFill` and `meshCache`, add:

```ts
this.textSdf = new ShaderProgram(this.gl, TEXT_VERT_SRC, TEXT_FRAG_SRC);
this.textSdf.lookupUniforms(TEXT_SDF_UNIFORMS);
this.textSdf.lookupAttributes(TEXT_SDF_ATTRIBUTES);
this.textureCache = new GLTextureCache(this.gl);
// Mark all font entries as not uploaded so they're re-uploaded on next render.
// (FontRegistry entries hold the ImageBitmap; re-upload is cheap.)
import { _markAllFontsNotUploaded } from './registerFont';
_markAllFontsNotUploaded();
```

Update `render()` to pass the new fields into `DrawContext`:

```ts
const ctx: DrawContext = {
  gl,
  pathFill: this.pathFill,
  textSdf: this.textSdf,
  meshCache: this.meshCache,
  textureCache: this.textureCache,
  state: this.groupState,
  widthCss: this.widthCss,
  heightCss: this.heightCss,
};
```

Add internal accessors:

```ts
/** @internal */ _textSdf(): ShaderProgram { return this.textSdf; }
/** @internal */ _textureCache(): GLTextureCache { return this.textureCache; }
```

Add `_markAllFontsNotUploaded` to `registerFont.ts` (appended, not replacing):

```ts
/** Called by WeaselRenderer on context restore to force re-upload. */
export function _markAllFontsNotUploaded(): void {
  for (const entry of registry.values()) {
    entry.textureUploaded = false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- packages/weasel-gl/src/WeaselRenderer.test.ts
npm test -- packages/weasel-gl/src/registerFont.test.ts
npm run typecheck
```

Expected: all pass, 0 typecheck errors.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-gl/src/WeaselRenderer.ts packages/weasel-gl/src/WeaselRenderer.test.ts packages/weasel-gl/src/registerFont.ts
git commit -m "feat(weasel-gl): wire textSdf program + GLTextureCache into WeaselRenderer"
```

---

## Task 12: Barrel exports

**Files:**
- Modify: `packages/weasel-gl/src/index.ts`

Export the new public API surface: `registerFont`, `TextDrawCommand`, `GlyphQuad`, `BmFont`, and reexport `TextStyle` from the weasel barrel (already done in Task 9 for the main weasel barrel; here we re-export from weasel-gl).

- [ ] **Step 1: Update `index.ts`**

Edit `packages/weasel-gl/src/index.ts` — append:

```ts
export { registerFont } from './registerFont';
export type {
  TextDrawCommand,
} from './DrawCommand';
export type {
  GlyphQuad,
  GlyphLayoutStyle,
} from './GlyphLayout';
export type {
  BmFont,
  BmFontChar,
  BmFontKerning,
  FontEntry,
} from './FontAtlas';
export type { TextStyle } from '@orochi235/weasel';
```

- [ ] **Step 2: Run tests**

```bash
npm test -- packages/weasel-gl/src/index.test.ts
npm run typecheck
```

Expected: PASS, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-gl/src/index.ts
git commit -m "feat(weasel-gl): barrel exports for registerFont + text types"
```

---

## Task 13: Update `gen:font` to handle `@fontsource` WOFF2 input

**Files:**
- Modify: `packages/weasel-gl/scripts/gen-font.ts`

`msdf-bmfont-xml` may not support WOFF2 natively. This task hardens the script to fall back to a font-format conversion step if the input is not a TTF/OTF.

This is a best-effort task: if `fonttools` (Python) is available, the script auto-converts. If not, it prints a clear error message with instructions rather than silently producing garbage.

- [ ] **Step 1: Update `gen-font.ts` to detect WOFF2 and fail informatively**

Edit `packages/weasel-gl/scripts/gen-font.ts` — replace the `execFileSync` block:

```ts
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';

// ... (keep existing arg parsing) ...

const ext = extname(fontPath).toLowerCase();
let ttfPath = fontPath;

if (ext === '.woff2' || ext === '.woff') {
  // Try to decompress via fonttools (pip install fonttools brotli).
  const probe = spawnSync('python3', ['-c', 'import fontTools; print("ok")'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    console.error(
      `gen-font: input is ${ext}; fonttools not found. Install with:\n  pip install fonttools brotli\nThen retry.`,
    );
    process.exit(1);
  }
  const outTtf = resolve(absOut, `${stem}.ttf`);
  execFileSync(
    'python3',
    ['-m', 'fontTools.scripts.woff2', 'decompress', '-o', outTtf, fontPath],
    { stdio: 'inherit' },
  );
  ttfPath = outTtf;
}

execFileSync(
  'npx',
  [
    'msdf-bmfont',
    '-f', 'json',
    '-o', outJson,
    '--texture-size', `${atlasSize},${atlasSize}`,
    '--font-size', String(size),
    '--charset-start', '32',
    '--charset-end', '255',
    '--type', 'msdf',
    '--field-type', 'msdf',
    ttfPath,
  ],
  { stdio: 'inherit' },
);

console.log(`✓ atlas → ${outPng}`);
console.log(`✓ metrics → ${outJson}`);
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-gl/scripts/gen-font.ts
git commit -m "chore(weasel-gl): harden gen-font for WOFF2 input via fonttools"
```

---

## Task 14: Playwright text smoke spec

**Files:**
- Create: `packages/weasel-gl/dev/text.html`
- Create: `packages/weasel-gl/dev/text.ts`
- Create: `packages/weasel-gl/dev/text.spec.ts`
- Modify: `packages/weasel-gl/dev/playwright.config.ts` — extend `testMatch` to include `text.spec.ts`

> **Convention §1:** Unit tests with the GL recorder don't catch atlas sampling, texture binding, or smoothstep bugs. This smoke spec is the primary correctness verification.
> **Convention §6:** `getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })` on every dev-page canvas.

This task verifies that `kind: 'text'` renders non-empty pixels at two font sizes (small, large) and that the glyph bounding box area has higher alpha than background regions. It does not do a pixel-perfect comparison (that's the visual regression rig in step 9).

- [ ] **Step 1: Create `text.html`**

Create `packages/weasel-gl/dev/text.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>weasel-gl step 3 text smoke</title>
    <style>
      html, body { margin: 0; padding: 8px; background: #1a1a1a; color: #fff; font: 13px sans-serif; }
      canvas { display: block; margin: 8px 0; background: #000; }
    </style>
  </head>
  <body>
    <p>Loading Inter font atlas…</p>
    <h3>32px "Hello, World!" (Inter Regular)</h3>
    <canvas id="cHello" width="600" height="80"></canvas>
    <h3>16px body text — Lorem ipsum (small size)</h3>
    <canvas id="cSmall" width="600" height="60"></canvas>
    <h3>64px large heading</h3>
    <canvas id="cLarge" width="600" height="120"></canvas>
    <h3>Zoom test: same string at 4 sizes overlaid</h3>
    <canvas id="cZoom" width="600" height="200"></canvas>
    <script type="module" src="./text.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `text.ts`**

Create `packages/weasel-gl/dev/text.ts`:

```ts
import { WeaselRenderer, registerFont } from '../src/index';
import type { DrawCommand } from '../src/DrawCommand';

const FONTS_BASE = '/packages/weasel-gl/fonts/inter';

async function main() {
  await registerFont('Inter', `${FONTS_BASE}/inter.json`, `${FONTS_BASE}/inter.png`);
  document.querySelector('p')!.textContent = 'Inter loaded.';

  const make = (id: string, w: number, h: number, cmds: DrawCommand[]) => {
    const c = document.getElementById(id) as HTMLCanvasElement;
    const gl = c.getContext('webgl2', {
      preserveDrawingBuffer: true,
      stencil: true,
    }) as WebGL2RenderingContext;
    const r = new WeaselRenderer({ gl, canvas: c, width: w, height: h, dpr: window.devicePixelRatio || 1 });
    r.render(cmds);
    return r;
  };

  // cHello: 32px
  make('cHello', 600, 80, [{
    kind: 'text',
    x: 20, y: 20,
    text: 'Hello, World!',
    style: { fontFamily: 'Inter', fontSize: 32, fill: { fill: 'solid', color: '#ffffff' } },
  }]);

  // cSmall: 16px
  make('cSmall', 600, 60, [{
    kind: 'text',
    x: 20, y: 16,
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    style: { fontFamily: 'Inter', fontSize: 16, fill: { fill: 'solid', color: '#cccccc' } },
  }]);

  // cLarge: 64px
  make('cLarge', 600, 120, [{
    kind: 'text',
    x: 20, y: 20,
    text: 'Weasel GL',
    style: { fontFamily: 'Inter', fontSize: 64, fill: { fill: 'solid', color: '#00aaff' } },
  }]);

  // cZoom: same text at 4 sizes to verify crisp MSDF scaling
  make('cZoom', 600, 200, [
    { kind: 'text', x: 20, y: 10,  text: 'MSDF', style: { fontFamily: 'Inter', fontSize: 12, fill: { fill: 'solid', color: '#aaa' } } },
    { kind: 'text', x: 20, y: 32,  text: 'MSDF', style: { fontFamily: 'Inter', fontSize: 24, fill: { fill: 'solid', color: '#ccc' } } },
    { kind: 'text', x: 20, y: 70,  text: 'MSDF', style: { fontFamily: 'Inter', fontSize: 48, fill: { fill: 'solid', color: '#eee' } } },
    { kind: 'text', x: 20, y: 130, text: 'MSDF', style: { fontFamily: 'Inter', fontSize: 64, fill: { fill: 'solid', color: '#fff' } } },
  ]);
}

main().catch(console.error);
```

- [ ] **Step 3: Create `text.spec.ts`**

Create `packages/weasel-gl/dev/text.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

/**
 * Step 3 text smoke. Verifies that kind:'text' renders non-empty pixels.
 * Convention §6: preserveDrawingBuffer:true + stencil:true on the dev page.
 * Convention §1: unit tests don't catch atlas/sampler bugs; this smoke is
 * the primary correctness check for MSDF rendering.
 *
 * NOT a pixel-baseline test — that lands in step 9's visual regression rig.
 */

test('text smoke — Inter glyphs paint non-empty pixels at all sizes', async ({ page }) => {
  await page.goto('/packages/weasel-gl/dev/text.html');
  // Wait for font to load and canvases to render.
  await page.waitForFunction(() =>
    document.querySelector('p')?.textContent === 'Inter loaded.',
  { timeout: 10_000 });
  await page.waitForTimeout(200);

  const canvasIds = ['cHello', 'cSmall', 'cLarge', 'cZoom'];

  for (const id of canvasIds) {
    const painted = await page.evaluate((cid) => {
      const c = document.getElementById(cid) as HTMLCanvasElement;
      const gl = c.getContext('webgl2')!;
      const w = c.width;
      const h = c.height;
      let nonZero = 0;
      const samples = 64;
      const px = new Uint8Array(4);
      for (let i = 0; i < samples; i++) {
        const x = Math.floor((i / samples) * w);
        const y = Math.floor((i / samples) * h);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        if (px[3] > 10) nonZero++;
      }
      return nonZero;
    }, id);
    expect(painted, `canvas#${id} should have painted glyph pixels`).toBeGreaterThan(0);
  }
});

test('text smoke — glyph region has higher alpha than background', async ({ page }) => {
  await page.goto('/packages/weasel-gl/dev/text.html');
  await page.waitForFunction(() =>
    document.querySelector('p')?.textContent === 'Inter loaded.',
  { timeout: 10_000 });
  await page.waitForTimeout(200);

  // For cHello: text starts at (20, 20), font size 32px.
  // Sample a 10×10 block around (30, 36) — should be inside glyph coverage.
  // Sample a 10×10 block at (0, 0) — should be background (alpha ≈ 0).
  const result = await page.evaluate(() => {
    const c = document.getElementById('cHello') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const px = new Uint8Array(4);

    const sampleAlpha = (x: number, y: number): number => {
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px[3];
    };

    // Midpoint of the first glyph ('H' at x≈20, y≈20, ~22px wide, ~28px tall).
    const glyphAlpha = sampleAlpha(30, 36);
    // Top-left corner — definitely background.
    const bgAlpha = sampleAlpha(2, 2);

    return { glyphAlpha, bgAlpha };
  });

  expect(result.glyphAlpha).toBeGreaterThan(result.bgAlpha + 10);
});
```

- [ ] **Step 4: Extend `playwright.config.ts` test match**

Edit `packages/weasel-gl/dev/playwright.config.ts` — change `testMatch`:

```ts
testMatch: /(smoke|synthetic|text)\.spec\.ts/,
```

- [ ] **Step 5: Run the smoke spec**

```bash
npm run test:smoke:step1
# or equivalently:
npx playwright test --config=packages/weasel-gl/dev/playwright.config.ts text.spec.ts
```

Expected: 2 tests PASS. If the atlas fetch fails (404), check that `packages/weasel-gl/fonts/inter/` contains `inter.json` and `inter.png` and that the Vite dev server can serve them (the vite config roots at repo root).

Also open `http://localhost:5173/packages/weasel-gl/dev/text.html` in a browser and visually verify:
- Text is readable and crisp at all four sizes in `cZoom`.
- No obvious artifacts (boxy aliasing = SDF threshold wrong; fully-black glyphs = atlas not loaded; transparent text = premultiply bug).

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-gl/dev/text.html packages/weasel-gl/dev/text.ts packages/weasel-gl/dev/text.spec.ts packages/weasel-gl/dev/playwright.config.ts
git commit -m "test(weasel-gl): text smoke spec — MSDF glyph pixel coverage"
```

---

## Task 15: Add `gen:font` script to npm scripts + update roadmap

**Files:**
- Modify: `package.json` — confirm `gen:font` is present (already done in Task 1; verify only)
- Modify: `docs/superpowers/plans/2026-05-08-webgl-transition-roadmap.md` — mark step 3 plan written

- [ ] **Step 1: Verify package.json scripts**

```bash
grep gen:font package.json
```

Expected: `"gen:font": "tsx packages/weasel-gl/scripts/gen-font.ts"`.

- [ ] **Step 2: Update roadmap**

In `docs/superpowers/plans/2026-05-08-webgl-transition-roadmap.md`, change the step 3 row from `_not yet written_` / `Pending step 2` to:

```
| 3 | [`2026-05-09-webgl-step-3-text-msdf.md`](./2026-05-09-webgl-step-3-text-msdf.md) | Plan written | **Text (MSDF).** `pnpm gen:font` build pipeline. Inter v4 prebuilt atlas (Apache-2.0). MSDF fragment shader (median + smoothstep). Glyph layout ASCII + Latin-1. `registerFont(family, metricsUrl, atlasUrl)`. `kind: 'text'` DrawCommand. |
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-05-08-webgl-transition-roadmap.md
git commit -m "docs(roadmap): mark step 3 plan written"
```

---

## Task 16: Full test suite + typecheck pass

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all vitest tests pass (existing weasel + all new weasel-gl tests).

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Run Playwright smoke (all specs)**

```bash
npm run test:smoke:step1
```

Expected: `smoke.spec.ts`, `synthetic.spec.ts`, and `text.spec.ts` all pass.

- [ ] **Step 4: Bundle size check**

```bash
npm run bundlesize:weasel-gl
```

Record the output. The addition of MSDF shaders, layout, and font types is expected to add ~5–10 KB to the bundle. If delta > 50 KB, investigate (likely the BmFont JSON or a dep being bundled instead of externalized).

- [ ] **Step 5: Commit done note**

Create `docs/superpowers/plans/2026-05-09-webgl-step-3-done.md` following the structure of `2026-05-08-webgl-step-1-done.md`. Include:
- What shipped (list all new files/modules).
- Font license note: **Inter v4, Apache-2.0** (https://github.com/rsms/inter). Atlas committed to repo; license compatible with MIT project license.
- Notable deviations from plan.
- Test results (vitest count + Playwright pass count).
- Lessons for step 4 (images, patterns, gradients).

```bash
git add docs/superpowers/plans/2026-05-09-webgl-step-3-done.md
git commit -m "docs(weasel-gl): step 3 done note — MSDF text shipped"
```

---

## Reference: MSDF shader math (for reviewers)

The SDF fragment shader recovers the signed-distance value from the three MSDF channels using:

```glsl
float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}
float sdfVal = median(texture(u_atlas, v_uv).rgb);
float coverage = smoothstep(0.5 - aaWidth, 0.5 + aaWidth, sdfVal);
```

**Why median?** `msdf-bmfont-xml` assigns each edge direction to one of R, G, or B. The median operation selects the "middle" channel, which is almost always on the correct side of the edge for any given pixel. Single-channel SDF would lose the per-direction information; using all three via median recovers sharp corners without the ringing artifacts of single-channel SDF.

**Why 0.5 threshold?** The atlas generator normalizes distances so the glyph outline sits at exactly 0.5. Values above 0.5 are inside the glyph; below 0.5 are outside. `smoothstep(0.45, 0.55, sdfVal)` produces a smooth edge with ~2px AA width at 32px glyph size / 512px atlas.

**Why no mipmaps?** MSDF works best at or above the generated atlas resolution. Mipmapping would average adjacent channels at small sizes, corrupting the multi-channel signal and producing hollow artifacts. At very small sizes (< 8px rendered height), the SDF approximation breaks down regardless — those sizes are outside scope for step 3.

**Premultiplied output** (conventions §2): the browser `getContext('webgl2')` defaults to `premultipliedAlpha: true`. The fragment shader outputs `vec4(rgb * a, a)` and the blend func is `ONE / ONE_MINUS_SRC_ALPHA`, matching.

---

## Open questions / concerns

1. **`msdf-bmfont-xml` v6 `--charset-start`/`--charset-end` flags.** These flags exist in the v6 CLI but the exact flag names may differ from `--charset-start 32 --charset-end 255`. Verify by running `npx msdf-bmfont --help` after install; adjust `gen-font.ts` if the flag names differ. Alternatively, pass a charset file via `--charset <file>` with the file listing codepoints 32–255 one per line.

2. **`@fontsource/inter` TTF vs WOFF2.** The `@fontsource` npm package typically ships WOFF2 only, not TTF. Task 13 handles the WOFF2→TTF conversion via `fonttools`. If `fonttools` is unavailable in the build environment, the fallback is to download the Inter TTF directly from the GitHub release. Document this in the done note.

3. **Atlas PNG committed to git.** A 512×512 RGBA PNG is ~80–120 KB. This is acceptable for a dev asset without LFS. If future steps add more font weights or a larger charset, revisit.

4. **`gl.DYNAMIC_DRAW` for per-frame text vertex buffers.** Step 3 allocates a new `VBO`/`VAO` per `drawText` call and does not clean them up within the frame. This is a known inefficiency: for step 3's scope (smoke tests, not production demos), it's acceptable. Step 7 (port of `createTextLayer`) should introduce a dynamic buffer pool. Track this as a TODO comment in `drawText`.

5. **`resolveTextStyle` import in `draw.ts`.** The `draw.ts` module imports `resolveTextStyle` from `@orochi235/weasel`. This is a cross-package value import, so vitest alias must be present. Convention §4 applies: verify the vitest alias for `@orochi235/weasel` exists in `vitest.config.ts` before running the draw tests (it should already be there from step 1).
