# PDF export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `@weasel-js/pdf` package turns `DrawCommand`s into a PDF with real, selectable text. weaselchart uses it for File › Export › Pages as PDF….

**Architecture:** `@weasel-js/pdf` is a writer with no knowledge of scenes. It takes one command list per page, in points with a top-left origin, and serializes PDF objects. Paths become vector operators, gradients become shadings, and bitmaps become image XObjects. Text is laid out again with `@weasel-js/text` so each glyph sits where the canvas put it, and it is written in Type0/CIDFontType2 fonts embedded whole. `@weasel-js/diagram-formats` gets `exportPagesPdf`, which plans each page with core's `planPixelRender` the way `exportPagePng` does and hands the commands to the writer. Fonts come in through an injected `PdfFontSource`, and anything PDF cannot express (effects, custom shaders, Porter-Duff composites) through an injected `rasterize` hook.

**Tech Stack:** TypeScript, the `@weasel-js/text`/`font`/`stroke`/`geom`/`paint`/`renderer` packages, `CompressionStream('deflate')` for FlateDecode, and `pdfjs-dist` (root devDependency, tests only) to read the files back.

**Spec:** `docs/superpowers/specs/2026-10-20-chart-fourth-arc-design.md` (the "PDF export" row and the Decisions section).

## Global Constraints

- PDF text is real text, with outlines as a fallback. Each font is embedded whole (no subsetting), glyphs are written as text, and a ToUnicode map lets the text be selected, searched, and copied. A face whose bytes can't be read is drawn as outlines.
- Text uses Type0/CIDFontType2 fonts with Identity-H encoding.
- `@weasel-js/pdf` never imports `@weasel-js/core`. Its shipped source uses relative imports only (no path aliases).
- One PDF page per placed page.
- Every changeset is `patch`. Never write a `bump-approved` marker.
- No source file over 400 lines, and no function over 120 (`npm run check:size`).
- Tests that need a real browser are `*.browser.test.ts` (the `browser` project). `packages/pdf` and `packages/font` unit tests run in the `weasel-ui` project, and `apps/chart` tests in `draw`.
- Every test, typecheck, lint and build runs on the fleet with `onto do --kind <kind> --about "<why>" -- <command>`, never on this Mac. Before merging, the branch runs `npm run test:fleet` and `npm run test:gate`, both on the fleet.
- US English in code, comments, docs and commit messages. Follow the repo's commenting rule: one or two lines, only what the code can't say.
- The first npm publish of `@weasel-js/pdf` and its trusted-publisher registration (`docs/releasing.md`, "Setting up a new package") are the maintainer's to do. No task runs `npm publish` or `setup-trusted-publishing.mjs`.

## Review Focus

- **Restricted license:** a face whose OS/2 `fsType` has bit 1 set (`0x0002`, restricted embedding) is drawn as outlines and never embedded. Pinned in Task 1 (`embeddable`) and Task 7.
- **Font collections:** a face registered from a `.ttc` member embeds that member's sfnt alone. FontFile2 cannot hold a collection, and readers reject one. Pinned in Task 1.
- **Open subpaths under `openFill: 'none'`:** PDF's `f` closes every subpath, so only the closed contours are filled. The stroke still covers every subpath. Pinned in Task 3.
- **Transparent gradient stops:** a stop such as `rgba(255,0,0,0)` needs a soft mask. An opaque shading would paint that end solid. Pinned in Task 4.
- **Characters the face can't draw:** an emoji, or a codepoint outside Inter's U+0020–00FF, is left out and listed in `skipped`. The rest of the run stays selectable, and no `.notdef` box (glyph 0) is ever written. Pinned in Task 8.

---

### Task 1: The font package exposes a face's embeddable bytes

**Files:**
- Modify: `packages/font/src/outline/OutlineFace.ts` (add `FaceEmbedding`, `OutlineFace.embedding?`)
- Modify: `packages/font/src/outline/opentypeParser.ts` (`faceFor` takes the single-member bytes and implements `embedding`)
- Create: `packages/font/src/outline/fontEmbedding.ts`
- Modify: `packages/font/src/index.ts` (export `fontEmbedding`, `type FaceEmbedding`)
- Test: `packages/font/src/outline/fontEmbedding.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface FaceEmbedding {
    /** One face's sfnt: a collection member is cut out of its collection. */
    sfnt: ArrayBuffer;
    postScriptName: string;
    unitsPerEm: number;
    /** `'cff'` when the face has a `CFF ` table and no `glyf`. */
    outlines: 'truetype' | 'cff';
    /** False when OS/2 fsType forbids embedding (bit 1, 0x0002). */
    embeddable: boolean;
    glyphIndexOf(cp: number): number | null;  // null for .notdef (0)
    advanceOfGlyph(gid: number): number;       // font units
    ascent: number; descent: number; capHeight: number; italicAngle: number; // font units / degrees
    bbox: readonly [number, number, number, number];                       // font units
  }
  // OutlineFace gains:  embedding?(): FaceEmbedding
  export function fontEmbedding(family: string, weight: number, style: FontStyle): Promise<FaceEmbedding | null>;
  ```
  `fontEmbedding` awaits `loadFontOutlines`. It answers `null` when nothing is registered, the load failed, or the face's parser has no `embedding`.

- [ ] **Step 1: Write the failing tests** in `fontEmbedding.test.ts`. Read `assets/fonts/inter/inter.ttf` with `readFileSync`, as `packages/core/src/interactions/actions/outlines/createOutlines.test.ts` does, and register it under a test family with `registerFontOutlines`. Reset with `_resetFontOutlinesForTests` in `afterEach`.
  ```ts
  it('answers the registered TrueType face with its glyph map', async () => {
    const e = (await fontEmbedding('emb-inter', 400, 'normal'))!;
    expect(e.outlines).toBe('truetype');
    expect(e.embeddable).toBe(true);
    expect(e.unitsPerEm).toBeGreaterThan(0);
    expect(e.glyphIndexOf(0x41)).toBeGreaterThan(0);
    expect(e.glyphIndexOf(0x1f600)).toBeNull();
    expect(e.advanceOfGlyph(e.glyphIndexOf(0x41)!)).toBeGreaterThan(0);
    expect(new Uint8Array(e.sfnt, 0, 4)).toEqual(new Uint8Array([0, 1, 0, 0]));
  });
  it('answers null for a family with nothing registered', async () => {
    expect(await fontEmbedding('nobody', 400, 'normal')).toBeNull();
  });
  it('answers null for a face whose parser cannot embed', async () => { /* register with a parser returning an OutlineFace without `embedding` */ });
  it('reports a restricted face as not embeddable', async () => { /* copy inter.ttf, set OS/2 fsType (offset 8 in the OS/2 table) to 0x0002, register, expect embeddable false */ });
  it('cuts a collection member out of its collection', async () => { /* wrap inter.ttf in a one-member ttcf header (see sfnt.test.ts for how it builds one), register with createOpenTypeParser(<its postScriptName>), expect sfnt to start 00 01 00 00, not 'ttcf' */ });
  ```
- [ ] **Step 2: Run them and watch them fail.** `onto do --kind test --about "font embedding tests, expected red" -- npx vitest run --project=weasel-ui packages/font/src/outline/fontEmbedding.test.ts`. Expected: FAIL, `fontEmbedding` is not exported.
- [ ] **Step 3: Implement.** `createOpenTypeParser` already has the single-member `bytes` from `sfntFromCollection`. Pass them into `faceFor`, and build `embedding()` lazily from the parsed `font`: `font.tables.os2.fsType`, `font.tables.head`, `font.tables.post.italicAngle`, the presence of `font.tables.glyf` vs `font.tables.cff`, `font.charToGlyphIndex`, and `font.glyphs.get(gid).advanceWidth`. `fontEmbedding` looks up the slot the way `outlineMetrics` does after `loadFontOutlines`. Put it in its own file so `outlineRegistry.ts` doesn't grow, and export a slot reader from `outlineRegistry.ts` if one is needed.
- [ ] **Step 4: Run the tests and see them pass.** Use the same command. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add packages/font/src/outline packages/font/src/index.ts
  git commit -m "expose a font face's embeddable sfnt and glyph map through fontEmbedding"
  ```

### Task 2: Scaffold `@weasel-js/pdf` with the object serializer and an empty document

**Files:**
- Create: `packages/pdf/{package.json,tsconfig.json,tsup.config.ts,README.md,LICENSE}`. Copy the shape of `packages/paint`'s, with `"description": "PDF documents from weasel draw commands: vector paths, shadings, images, and embedded fonts with selectable text. No scene graph, no React."`. Dependencies at `1.11.0` (the version every package is at): `@weasel-js/font`, `@weasel-js/geom`, `@weasel-js/paint`, `@weasel-js/renderer`, `@weasel-js/stroke`, `@weasel-js/text`.
- Create: `packages/pdf/src/{index.ts,objects.ts,deflate.ts,num.ts,writePdf.ts}`, plus `packages/pdf/src/fonts/fontSource.ts` holding the `PdfFontSource` interface (Task 7 adds `registryFontSource` beside it)
- Modify: `.changeset/config.json` (add `@weasel-js/pdf` to the `fixed` group), `package.json` (`build:leaves`, after `@weasel-js/renderer`), `tsconfig.json` (`paths` entry and `include`), `typedoc/categories.mjs` (`['packages/pdf/src', 'Rendering']`), and `README.md`'s package table (`npm run check:needs -- --write` redraws it).
- Create: `.changeset/pdf-package.md`
- Test: `packages/pdf/src/objects.test.ts`, `packages/pdf/src/writePdf.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // objects.ts
  export type PdfValue = number | boolean | null | PdfName | PdfRef | PdfText | PdfBytes | readonly PdfValue[] | PdfDict;
  export interface PdfDict { readonly [key: string]: PdfValue | undefined }
  export function name(n: string): PdfName;             // serializes as /n, #xx-escaping delimiters
  export function text(s: string): PdfText;             // (…) when ASCII-safe, else <FEFF…> UTF-16BE
  export function bytes(b: Uint8Array): PdfBytes;        // <hex>
  export class PdfObjects {
    alloc(): PdfRef;
    set(ref: PdfRef, value: PdfValue): void;
    stream(ref: PdfRef, dict: PdfDict, data: Uint8Array): void;  // writes /Length itself
    serialize(root: PdfRef, info?: PdfRef): Uint8Array;           // header, objects, xref, trailer
  }
  // num.ts
  export function num(n: number): string;   // ≤4 decimals, no exponent, '-0' → '0', throws on non-finite
  // deflate.ts
  export function deflate(data: Uint8Array): Promise<Uint8Array>;  // CompressionStream('deflate'), zlib-wrapped
  // writePdf.ts
  export interface PdfPage { width: number; height: number; commands: readonly DrawCommand[]; view?: GlMat3 }
  export interface WritePdfOptions {
    fonts: PdfFontSource;            // fonts/fontSource.ts, interface in Task 7's Interfaces block
    title?: string;
    compress?: boolean;              // default true; unit tests pass false (jsdom realms lack CompressionStream)
    readPixels?: (image: ImageBitmap | HTMLImageElement) => RasterPixels;   // Task 6
    rasterize?: (commands: readonly DrawCommand[], rect: Rect, scale: number) => Promise<RasterPixels>; // Task 9
  }
  export interface RasterPixels { width: number; height: number; data: Uint8ClampedArray } // straight RGBA, top-down
  export interface PdfSkip { kind: 'glyph' | 'command'; detail: string }
  export interface PdfResult { bytes: Uint8Array; skipped: readonly PdfSkip[] }
  export function writePdf(pages: readonly PdfPage[], opts: WritePdfOptions): Promise<PdfResult>;
  ```
  Page units are points, with the origin at the top left and y growing downward. Each page's content stream opens with `1 0 0 -1 0 <height> cm`.

- [ ] **Step 1: Write the failing tests.** `objects.test.ts`: `num(1/3)` is `'0.3333'`, `num(-0)` is `'0'`, `num(1e-7)` is `'0'`, `num(1e21)` is `'1000000000000000000000'`, and `num(NaN)` throws. `name('A B')` serializes as `/A#20B`. `text('é')` serializes as `<FEFF00E9>`. Serializing two objects gives a `startxref` offset that points at `xref`, and every xref entry's offset points at `N 0 obj`. `writePdf.test.ts`:
  ```ts
  it('writes one page per input page, each its own size', async () => {
    const { bytes } = await writePdf([{ width: 150, height: 75, commands: [] }, { width: 75, height: 150, commands: [] }],
      { fonts: NO_FONTS, compress: false });
    const s = latin1(bytes);
    expect(s.startsWith('%PDF-1.7')).toBe(true);
    expect(s.match(/\/Type \/Page\b/g)).toHaveLength(2);
    expect(s).toContain('/MediaBox [0 0 150 75]');
    expect(s).toContain('/MediaBox [0 0 75 150]');
    expect(s).toContain('1 0 0 -1 0 75 cm');
  });
  it('puts the title in the info dictionary', …); // /Title (Chart)
  ```
  `NO_FONTS` is a `PdfFontSource` that answers `null`/`null`. Put it and `latin1` in `packages/pdf/src/testing/` for later tasks to share.
- [ ] **Step 2: Run them and watch them fail.** `onto do --kind test --about "pdf scaffold tests, expected red" -- npx vitest run --project=weasel-ui packages/pdf/src`. Expected: FAIL on missing modules.
- [ ] **Step 3: Implement** the serializer, `num`, `deflate`, and `writePdf` with a page tree, the per-page content stream (Flate when `compress`), and an empty `/Resources`. The command walker is a stub that Task 3 fills in.
- [ ] **Step 4: Install and run.** `onto do --kind build --about "install after adding @weasel-js/pdf workspace" -- npm install`, then rerun the Step 2 command. Expected: PASS. Then `onto do --kind typecheck --about "pdf scaffold" -- npm run typecheck` and `onto do --kind lint --about "pdf package checks" -- sh -c "npm run check:imports && npm run check:build-order && npm run check:needs && npm run check:test-projects"`. Expected: all clean.
- [ ] **Step 5: Write the changeset** `.changeset/pdf-package.md`, `'@weasel-js/pdf': patch`, `'@weasel-js/font': patch`, `'@weasel-js/text': patch`, `'@weasel-js/renderer': patch`, `'@weasel-js/diagram-formats': patch`: "New package, `@weasel-js/pdf`: `writePdf` turns draw commands into a PDF document — vector paths, gradient shadings, images, and fonts embedded whole so text can be selected and copied. `@weasel-js/font` adds `fontEmbedding`; `@weasel-js/diagram-formats` adds `exportPagesPdf`, every page of a diagram as one PDF." Later tasks keep its wording accurate.
- [ ] **Step 6: Commit**
  ```bash
  git add packages/pdf .changeset package.json package-lock.json tsconfig.json typedoc/categories.mjs README.md
  git commit -m "add @weasel-js/pdf with a PDF object serializer and page tree"
  ```

### Task 3: Paths, solid paint, and group transform, alpha and clip

**Files:**
- Create: `packages/pdf/src/content.ts` (operator builder), `packages/pdf/src/pathOps.ts`, `packages/pdf/src/resources.ts`, `packages/pdf/src/drawCommands.ts`
- Test: `packages/pdf/src/pathOps.test.ts`, `packages/pdf/src/drawCommands.test.ts`

**Interfaces:**
- Consumes: `PdfObjects`, `num` (Task 2), `resolveCorners`, `forEachSegment` and `PATH_*` from `@weasel-js/geom`, `parseColor` from `@weasel-js/paint`.
- Produces:
  ```ts
  export class ContentStream { op(operator: string, ...operands: (number | string)[]): this; bytes(): Uint8Array }
  export function pathOps(out: ContentStream, path: Path, which: 'all' | 'closed'): void; // m/l/c/h, re for a rect; Q raised to C
  export class PageResources { extGState(fillAlpha: number, strokeAlpha: number): string; shading(ref: PdfRef): string;
    xobject(ref: PdfRef): string; font(ref: PdfRef): string; pattern(ref: PdfRef): string; dict(): PdfDict }
  export interface DrawState { transform: GlMat3; alpha: number; colorMatrix: number[] | null }
  export interface PageCtx { objects: PdfObjects; resources: PageResources; out: ContentStream; opts: WritePdfOptions;
    skipped: PdfSkip[]; view: GlMat3 | undefined }
  export function writeCommands(ctx: PageCtx, cmds: readonly DrawCommand[], state: DrawState): Promise<void>;
  ```
  A group becomes `q`, then `cm` from its `transform`, a clip (`pathOps` then `W n`, or `W* n` for even-odd), its children, and `Q`. `alpha` multiplies down the stack into `/ca` and `/CA` through `extGState`. `retain` is ignored.

- [ ] **Step 1: Write the failing tests.** In `pathOps.test.ts`, a rect is `x y w h re`. A quadratic is raised to the exact cubic (`C` control points at ⅔). Corner specs are expanded before writing. An even-odd fill uses `f*`. In `drawCommands.test.ts`, use `compress: false` and read the page's content stream:
  ```ts
  it('fills only closed contours when openFill is none', async () => {
    // a path with one closed triangle and one open polyline, openFill: 'none', fill + stroke
    // expect the fill block to hold one `h` and the stroke block both subpaths
  });
  it('nests a group as q cm … Q and multiplies alpha into an ExtGState', …);  // /ca 0.25 for alpha 0.5 inside alpha 0.5
  it('clips a group to its path', …);                                           // `re W n` before the children
  it('writes a solid fill as rg and its opacity through ca', …);               // '#ff0000' at opacity 0.5
  ```
- [ ] **Step 2: Run them and watch them fail.** `onto do --kind test --about "pdf paths, expected red" -- npx vitest run --project=weasel-ui packages/pdf/src/pathOps.test.ts packages/pdf/src/drawCommands.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Under `openFill: 'none'` (or the engine default from geom's `setDefaultOpenFill` when absent), fill with `which: 'closed'` and stroke with `'all'`. `writeCommands` dispatches on `kind`. Each kind that later tasks handle pushes a `{ kind: 'command', detail: '<kind> not yet supported' }` skip until its task lands.
- [ ] **Step 4: Run the tests and see them pass.** Use the same command. Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -m "write PDF paths, solid fills and group transforms, alpha and clips"`.

### Task 4: Gradients as shadings

**Files:**
- Create: `packages/pdf/src/shading.ts`
- Modify: `packages/pdf/src/drawCommands.ts` (non-solid fill → `q`, `pathOps`, `W n`, `/Sh sh`, `Q`)
- Test: `packages/pdf/src/shading.test.ts`

**Interfaces:**
- Consumes: `resolveGradientStops`, `sampleGradientStops` and `gradientGeometry` from `@weasel-js/paint`.
- Produces: `paintShading(ctx: PageCtx, paint: CommandPaint, state: DrawState): { shading: string; softMask: string | null } | null`, which answers `null` for a paint that isn't a gradient.

- [ ] **Step 1: Write the failing tests.**
  ```ts
  it('writes a linear gradient as an axial shading over its from/to', …);   // /ShadingType 2, /Coords [x0 y0 x1 y1], /Extend [true true]
  it('writes a radial gradient as a type 3 shading from the center', …);   // /Coords [cx cy 0 cx cy r]
  it('writes a conic gradient as a free-form triangle mesh', …);           // /ShadingType 4, 360 wedges about the center from `angle`
  it('stitches multi-stop gradients from type 2 functions', …);           // /FunctionType 3, /Bounds of the inner offsets
  it('samples a non-rgb interpolation into enough stops to follow it', …);  // interpolate: 'oklch' → 64 sampled stops
  it('masks a gradient whose stops are not all opaque', …);               // /SMask with a /Luminosity group, alpha shading in /DeviceGray
  it('places screen-unit paint in page space and world-unit paint through the view', …);
  ```
- [ ] **Step 2: Run them and watch them fail.** `onto do --kind test --about "pdf shadings, expected red" -- npx vitest run --project=weasel-ui packages/pdf/src/shading.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Coordinates follow the paint's `units`. `local` is the current group's frame. `screen` is the page frame, so undo the accumulated transform. `world` goes through `ctx.view` and falls back to `screen` when there is none, as the renderer does. The color matrix in effect is folded into stop colors (Task 9 supplies `foldColor`; until then the identity).
- [ ] **Step 4: Run the tests and see them pass.** Use the same command. Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -m "write linear, radial and conic gradients as PDF shadings"`.

### Task 5: Strokes and markers

**Files:**
- Modify: `packages/renderer/src/index.ts` (export `markerDrawCommands` from `./markerCommands`)
- Create: `packages/pdf/src/strokeOps.ts`
- Test: `packages/pdf/src/strokeOps.test.ts`

**Interfaces:**
- Consumes: `markerDrawCommands` (`@weasel-js/renderer`), `resolveStrokeWidth` and `strokeToPath` (`@weasel-js/stroke`).
- Produces: `writeStroke(ctx: PageCtx, path: Path, stroke: CommandStroke, state: DrawState): Promise<void>`.

- [ ] **Step 1: Write the failing tests.**
  ```ts
  it('strokes a plain centered stroke natively', …);              // w, J/j codes, M miterLimit (default 4), d dash array, S
  it('resolves a { px } width against the accumulated scale', …);  // width { px: 2 } under a 0.75 scale → 2 w in page space
  it('fills the outline of a stroke PDF cannot draw', …);         // align 'inner', vertexWidths, nib or vertexColors → strokeToPath, f
  it('draws marker heads as their own commands', …);              // markerEnd 'arrow' adds a filled path after the stroke
  ```
- [ ] **Step 2: Run them and watch them fail.** `onto do --kind test --about "pdf strokes, expected red" -- npx vitest run --project=weasel-ui packages/pdf/src/strokeOps.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** A native stroke is center-aligned, with no `vertexWidths`, `nib` or `vertexColors`. Its `{ px }` width is written inside a `q`, with the inverse of the accumulated scale baked into the width, so the line measures its screen width on the page. Everything else is filled from `strokeToPath(path, stroke, { scale, frame })`. Markers go through `writeCommands` as the paths `markerDrawCommands` returns, so marker paint follows the renderer's rules.
- [ ] **Step 4: Run the tests and see them pass.** Use the same command. Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -m "write PDF strokes natively, outlined where PDF cannot draw them, with markers"`.

### Task 6: Images, sprites, and texture patterns

**Files:**
- Create: `packages/pdf/src/images.ts`
- Test: `packages/pdf/src/images.test.ts`

**Interfaces:**
- Consumes: `opts.readPixels`, which defaults to drawing the bitmap into an `OffscreenCanvas` 2D context and reading `getImageData`. `SPRITE_STRIDE` and `textureRegistry` come from `@weasel-js/renderer`.
- Produces: `imageXObject(ctx: PageCtx, image: ImageBitmap | HTMLImageElement): PdfRef`, memoized per image across the whole document. `writeImage(ctx, cmd: ImageDrawCommand | SpritesDrawCommand, state)`.

- [ ] **Step 1: Write the failing tests.** Inject `readPixels`, because jsdom has no `ImageBitmap`.
  ```ts
  it('embeds an image once however many times it is drawn', …);         // two commands, one /Subtype /Image object
  it('writes RGB and an SMask from the alpha channel', …);              // /SMask present only when some alpha < 255
  it('places the image over its rect, flipped back upright', …);         // cm w 0 0 -h x y+h, then Do
  it('draws a source sub-rect clipped to the destination', …);          // re W n, then the whole image scaled so source lands on dest
  it('honors flipX and flipY and nearest sampling', …);                 // negative scale; /Interpolate false for 'nearest'
  it('draws every sprite of a sprites command', …);                     // 2 sprites → 2 Do, opacity through ca
  it('tiles a texture paint with a PDF tiling pattern', …);             // /PatternType 1 with the texture's bitmap, placed by origin and transform
  ```
- [ ] **Step 2: Run them and watch them fail.** `onto do --kind test --about "pdf images, expected red" -- npx vitest run --project=weasel-ui packages/pdf/src/images.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Write `/Interpolate true` for `'linear'` sampling. The color matrix in effect is applied to the pixels before they are encoded.
- [ ] **Step 4: Run the tests and see them pass.** Use the same command. Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -m "embed images, sprites and texture patterns in PDF pages"`.

### Task 7: Embedded fonts with a ToUnicode map

**Files:**
- Modify: `packages/pdf/src/fonts/fontSource.ts` (add `registryFontSource`)
- Create: `packages/pdf/src/fonts/embedFont.ts`, `packages/pdf/src/fonts/toUnicode.ts`
- Test: `packages/pdf/src/fonts/embedFont.test.ts`

**Interfaces:**
- Consumes: `FaceEmbedding` and `fontEmbedding` (Task 1), `glyphOutline` (`@weasel-js/font`).
- Produces:
  ```ts
  export interface PdfFontSource {
    embedding(family: string, weight: number, style: FontStyle): Promise<FaceEmbedding | null>;
    /** Em-space SVG path data, as glyphOutline answers it. */
    outline(family: string, weight: number, style: FontStyle, cp: number): string | null;
  }
  export const registryFontSource: PdfFontSource;   // fontEmbedding + glyphOutline
  export class DocumentFonts {
    constructor(objects: PdfObjects, source: PdfFontSource);
    /** The embedded font for a face, or null to draw its glyphs as outlines. */
    face(family: string, weight: number, style: FontStyle): Promise<EmbeddedFont | null>;
    finish(): Promise<void>;  // writes /W and /ToUnicode for the glyphs used, then the font objects
  }
  export interface EmbeddedFont { ref: PdfRef; use(cp: number): number | null /* gid, recorded for W and ToUnicode */; widthOf(gid: number): number /* 1000/em */ }
  ```
  Each face is written as `Type0` with `/Encoding /Identity-H`, a `CIDFontType2` descendant with `/CIDToGIDMap /Identity`, a `FontDescriptor` carrying `/FontFile2` (the whole sfnt, Flate-compressed), and `/ToUnicode`.

- [ ] **Step 1: Write the failing tests** against a `PdfFontSource` built from Inter's real bytes (as in Task 1):
  ```ts
  it('embeds a TrueType face whole as a Type0 font', …);   // /Subtype /Type0, /Identity-H, /CIDFontType2, /FontFile2 length = sfnt length uncompressed
  it('maps every glyph used back to its character', …);    // ToUnicode holds <gid> <0041> for 'A', in beginbfchar blocks of ≤100
  it('writes widths only for glyphs used', …);             // /W [gid [w]] in 1000/em units
  it('answers null for a CFF face, a restricted face, or no bytes', …);  // three sources → three nulls
  it('embeds a face once however many runs use it', …);
  ```
- [ ] **Step 2: Run them and watch them fail.** `onto do --kind test --about "pdf font embedding, expected red" -- npx vitest run --project=weasel-ui packages/pdf/src/fonts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `face()` answers `null` unless `outlines === 'truetype' && embeddable`. Those are the cases the spec's fallback covers: the text is drawn, as outlines.
- [ ] **Step 4: Run the tests and see them pass.** Use the same command. Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -m "embed TrueType faces whole as Type0 fonts with ToUnicode maps"`.

### Task 8: Text commands

**Files:**
- Modify: `packages/text/src/index.ts` (export `syntheticBoldOffset` and `emboldenGlyphD` from `./syntheticBold`)
- Create: `packages/pdf/src/textOps.ts`
- Test: `packages/pdf/src/textOps.test.ts`

**Interfaces:**
- Consumes: `cachedLayoutRuns`, `cachedPaintRuns`, `resolveTextStyle`, `verticalAlignOffset`, `syntheticBoldOffset`, `emboldenGlyphD` and `SYNTHETIC_ITALIC_RADIANS` from `@weasel-js/text`. `DocumentFonts` (Task 7), `writeCommands` (Task 3), `paintShading` (Task 4).
- Produces: `writeText(ctx: PageCtx, cmd: TextDrawCommand, state: DrawState): Promise<void>`.

- [ ] **Step 1: Write the failing tests** with Inter registered as `sans-serif` outlines (Task 1's setup) and no atlas, so layout runs on the outline tier:
  ```ts
  it('lays text out with the options drawText uses and writes it as TJ in the embedded font', …);
    // 'Hi' → BT, /F1 1 Tf, Tm fontSize 0 0 -fontSize x baselineY, [<gidH> adj <gidI>] TJ, ET
  it('corrects each glyph to the layout step with TJ adjustments', …);   // letterSpacing 5 → adjustment −5000/fontSize between glyphs
  it('shifts by verticalAlign as drawText does', …);                     // height 100, verticalAlign 'middle'
  it('draws a glyph the face cannot embed as its outline', …);           // source whose embedding is null → path fill, no BT
  it('leaves out and reports a character no source can draw, keeping the rest as text', …);
    // 'A😀B' → TJ holds A and B only; skipped = [{ kind: 'glyph', detail: contains 'U+1F600' }]; no <0000> in the stream
  it('strokes a run with a stroke using text render mode 2 or 1', …);
  it('fakes bold with render mode 2 at the offset syntheticBoldOffset gives, and italic with a skewed Tm', …);
  it('draws underline and strikethrough as filled rules', …);
  it('clips to the glyphs and shades them for a gradient fill', …);      // render mode 7, then sh
  ```
- [ ] **Step 2: Run them and watch them fail.** `onto do --kind test --about "pdf text, expected red" -- npx vitest run --project=weasel-ui packages/pdf/src/textOps.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Lay out exactly as `drawText` in `packages/renderer/src/draw/text.ts` does: the same `cachedLayoutRuns` options, with the origin at `cmd.x` and `cmd.y + verticalAlignOffset(...)`. Walk `laid.lines[].glyphs` (visual order). Group consecutive glyphs by run and face, so each group is one `BT … ET`. A glyph is skipped when `!entry.inks` or its face has no gid for it. Its outline fallback uses `fonts.outline(...)` scaled by `fontSize` at `(x, baselineY)`. Read the face from `glyph.resolved.resolved`, and the fill and stroke from `cmd.runs[glyph.run]`. Decorations come from `cachedPaintRuns(laid, cmd.runs, {})`.
- [ ] **Step 4: Run the tests and see them pass.** Use the same command, plus `onto do --kind test --about "text barrel exports" -- npx vitest run --project=weasel-ui packages/text/src`. Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -m "write text commands as selectable PDF text, with outlines where a face cannot embed"`.

### Task 9: Color matrices, isolated groups, and the raster fallback

**Files:**
- Create: `packages/pdf/src/groupOps.ts`
- Modify: `packages/pdf/src/drawCommands.ts`
- Test: `packages/pdf/src/groupOps.test.ts`

**Interfaces:**
- Consumes: `opts.rasterize`, the `DrawState.colorMatrix` stack.
- Produces: `foldColor(rgba: readonly [number, number, number, number], m: number[] | null): [number, number, number, number]`, used by Tasks 3, 4 and 6 for every color they write. `writeGroup(ctx, cmd: GroupDrawCommand, state)`.

- [ ] **Step 1: Write the failing tests.**
  ```ts
  it('folds an accumulated color matrix into solid colors', …);           // grayscale matrix → equal r g b in `rg`
  it('draws an isolated group as a transparency group form', …);         // /Subtype /Form, /Group << /S /Transparency /I true >>, alpha on the Do
  it('rasterizes a group with effects through the hook and places the image', …);   // hook called with the children and their bounds, at scale 2
  it('rasterizes shader commands and non-source-over composites', …);
  it('skips and reports what needs a raster when no hook is given', …);  // skipped: [{ kind: 'command', detail: /effects/ }]
  ```
- [ ] **Step 2: Run them and watch them fail.** `onto do --kind test --about "pdf groups, expected red" -- npx vitest run --project=weasel-ui packages/pdf/src/groupOps.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The color matrix composes the same way the renderer's `foldColor` (`packages/renderer/src/draw/foldColor.ts`) reads it: a 4×5 matrix, row-major. Rasterize at 2× the page's point scale. The raster's bounds come from the commands' bounds under the current transform, clamped to the page.
- [ ] **Step 4: Run the tests and see them pass.** Use the same command. Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -m "fold color matrices, isolate groups, and rasterize what PDF cannot draw"`.

### Task 10: `exportPagesPdf` in diagram-formats, checked by reading the file back

**Files:**
- Create: `packages/diagram-formats/src/pagesPdf.ts`
- Modify: `packages/diagram-formats/src/index.ts`, `packages/diagram-formats/package.json` (depend on `@weasel-js/pdf`), root `package.json` (`pdfjs-dist` devDependency, at the newest version published at least two weeks ago, pinned exactly)
- Test: `packages/diagram-formats/src/pagesPdf.browser.test.ts`

**Interfaces:**
- Consumes: `planPixelRender`, `warmRender` and `createRasterSession` (`@weasel-js/core`), `pageBackground` (`./pageSvg`), `writePdf` and `registryFontSource` (`@weasel-js/pdf`).
- Produces:
  ```ts
  export interface ExportPagesPdfOptions { background?: string | null; title?: string }
  export function exportPagesPdf(scene: PageExportScene, pages: readonly PageRect[], opts?: ExportPagesPdfOptions):
    Promise<{ blob: Blob; skipped: readonly PdfSkip[] }>;
  ```
  Each page is planned with `sourceRect` at the page's rect and `scale` set to `PT_PER_UNIT = 0.75` (72 pt per inch over 96 units per inch). It is passed as `{ width: page.width * 0.75, height: page.height * 0.75, commands, view: viewToMat3(plan.view) }`. Before planning, `warmRender({ render: args })` runs per page, as `exportPagePng` does. `rasterize` renders through one `createRasterSession` for the whole export, disposed at the end. Its commands go in `overlay`, inside a group scaled to the raster scale, over an empty `createScene`.

- [ ] **Step 1: Write the failing browser test.** Register `registerDiagramShape()`, and Inter as `sans-serif` (`registerFont` with `inter.json?url`/`inter.png?url`, and `registerFontOutlines` with `inter.ttf?url`, as `packages/renderer/src/syntheticBold.browser.test.ts` imports them). Read the result with `pdfjs-dist` (`GlobalWorkerOptions.workerSrc` set from `pdfjs-dist/build/pdf.worker.min.mjs?url`).
  ```ts
  it('writes one page per page, each at the page size in points', async () => {
    const { scene, pages } = pageScene();
    const doc = await read((await exportPagesPdf(scene, pages)).blob);
    expect(doc.numPages).toBe(2);
    const vp = (await doc.getPage(1)).getViewport({ scale: 1 });
    expect([vp.width, vp.height]).toEqual([150, 75]);
  });
  it('holds the text row as text a reader can extract', async () => {
    const page = await (await read((await exportPagesPdf(scene, pages)).blob)).getPage(1);
    expect((await page.getTextContent()).items.map((i) => 'str' in i ? i.str : '').join('')).toContain('Start');
  });
  it('skips nothing on a plain diagram page', …);  // skipped toEqual([])
  ```
- [ ] **Step 2: Install, then run it and watch it fail.** `onto do --kind build --about "install pdfjs-dist for the pdf browser test" -- npm install`, then `onto do --kind test --about "pdf export browser test, expected red" -- npx vitest run --project=browser packages/diagram-formats/src/pagesPdf.browser.test.ts`. Expected: FAIL, `exportPagesPdf` is not exported.
- [ ] **Step 3: Implement `pagesPdf.ts`.**
- [ ] **Step 4: Run it and see it pass.** Use the same test command. Expected: PASS. If text extraction comes back empty, check the ToUnicode map before suspecting anything else.
- [ ] **Step 5: Commit** with `git commit -m "export every page of a diagram as one PDF with exportPagesPdf"`.

### Task 11: File › Export › Pages as PDF… in weaselchart

**Files:**
- Modify: `apps/chart/src/exportCommands.ts`, `apps/chart/src/exportCommands.test.tsx`

**Interfaces:**
- Consumes: `exportPagesPdf` (Task 10), `reportFileWarnings` (`@editor/index`).
- Produces: `EXPORT_ACTIONS.pdf = 'chart.export.pdf'`, labeled `Pages as PDF…`, listed first in the page run. The file is named `chart.pdf`, the base `exportChart` uses for a multi-page export. A non-empty `skipped` is passed to `reportFileWarnings('Exported', skipped.map((s) => s.detail), 'chart-export-pdf')`.

- [ ] **Step 1: Write the failing test** in `exportCommands.test.tsx`, mocking `exportPagesPdf` the way the file mocks `exportPagePng`:
  ```ts
  it('downloads every page as one PDF', async () => {
    exportAs('Pages as PDF');
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.name).toBe('chart.pdf');
    expect(pdf.mock.calls[0]![1]).toHaveLength(1);
    expect(pdf.mock.calls[0]![1][0]).toMatchObject({ id: 'page-1' });
  });
  ```
- [ ] **Step 2: Run it and watch it fail.** `onto do --kind test --about "chart pdf export menu, expected red" -- npx vitest run --project=draw apps/chart/src/exportCommands.test.tsx`. Expected: FAIL, no `Pages as PDF` row.
- [ ] **Step 3: Implement** `usePdfCommand` beside `usePngCommand`, passing `pages.placed`.
- [ ] **Step 4: Run it and see it pass.** Use the same command. Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -m "add File › Export › Pages as PDF… to weaselchart"`.

### Task 12: Land it

**Files:**
- Modify: `docs/TODO.md` (the weaselchart "Fourth arc" entry: drop PDF export from its list), `packages/pdf/README.md` (what the writer draws natively, what goes through `rasterize`, and the outline fallback), `.changeset/pdf-package.md` (wording matches what shipped)

- [ ] **Step 1: Run the whole check set on the fleet.** `onto do --kind typecheck --about "pdf branch" -- npm run typecheck`, `onto do --kind typecheck --about "pdf branch, per package" -- npm run typecheck:packages -- pdf font text renderer diagram-formats`, `onto do --kind lint --about "pdf branch" -- npm run lint`, `onto do --kind build --about "pdf branch" -- npm run build`, and `onto do --kind test --about "pdf branch consumer smoke" -- npm run test:smoke:consumer`. Expected: all green. `check:first-publish` is expected to name `@weasel-js/pdf` as NEVER PUBLISHED until the maintainer bootstraps it, and that alone isn't a failure.
- [ ] **Step 2: Run the branch on the fleet.** Commit, then run `npm run test:gate` and `npm run test:fleet`. Expected: green, with a `fleet-tree: N changed path(s) match <sha>` line in the log.
- [ ] **Step 3: Commit the docs** with `git commit -m "record PDF export in the weaselchart TODO and the pdf README"`.
- [ ] **Step 4: Report back** that `@weasel-js/pdf` needs its first publish and trusted-publisher registration by hand (`docs/releasing.md`) before the next release can publish it.
