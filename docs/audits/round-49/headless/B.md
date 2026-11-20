I couldn't write `.skulk/out/findings.md` because the write permission was refused, so the whole findings document is below instead.

# Audit round 49: area `headless` (blind reviewer)

## sceneToWire decodes a live Scene's `toJSON()` as if it were encoded, so node data shaped like a codec tag changes type or value on the way to the page
- where: packages/headless/src/protocol.ts:50 (sceneToWire)
- scenario: `scene.toJSON()` returns the decoded in-memory snapshot. `encodeSnapshot` on its own would encode that correctly, because its replacer wraps any consumer value the decoder would misread in `{ "__raw": … }`. `sceneToWire` runs `decodeSnapshot` over it first instead, so consumer data gets reinterpreted before it is encoded. Examples for a node's `data` in a live scene:
  - `{ coords: [0.1, 16777217] }` becomes a `Float32Array` through decodeWithin's legacy-path branch. Precision is lost (16777217 → 16777216) and a plain array becomes a typed one.
  - `{ commands: [1, 2] }` becomes a `Uint8Array`.
  - `{ tag: { __num: 'NaN' } }` becomes `NaN`.
  - `{ __ta: 'Float64Array', data: [1] }` becomes a typed array.
  - `{ __raw: { a: 1 } }` loses its wrapper.

  The page then renders from the altered data, so a painter or registry function reading those fields sees a different value than a browser render of the same live scene would. The 2026-11-10 ruling in docs/unruled.md (around line 280) accepts the read-back for a *snapshot* passed in, because a snapshot could be either encoded or decoded. A live `Scene` is not ambiguous: its `toJSON()` is always the decoded form, so it should go through `encodeSnapshot` without the decode.
- evidence: read (codec.ts decode/decodeWithin/untagNumber; geom untagTypedArray/isRawWrapper)
- severity: medium

## `difference` compares only `a.length` bytes and goes `NaN` on a length mismatch, so a short or empty node raster can read as identical
- where: packages/headless/src/testing/compareRaster.ts:14 (difference)
- scenario: the loop runs over `a.length` only.
  - `a` shorter than `b.data` (for example a node render that came back 0×0 or cropped): the bytes of `b` past `a.length` are never compared. An empty `a` returns `{ pixels: 0, maxStep: 0 }`, which reads as identical.
  - `a` longer than `b.data`: `b.data[i]` is `undefined`, so `step` is `NaN`. `if (step)` is false, so those pixels are not counted, and `Math.max(maxStep, NaN)` makes `maxStep` `NaN`.

  `registered.browser.test.ts:21` calls it without the separate `data.length` check that `headless.browser.test.ts` adds, and only its width/height check keeps it safe. The helper should refuse a length mismatch, or count it, itself.
- evidence: read
- severity: low

## The page's `toBase64` builds a binary string the size of the raster, so a large render fails with V8's "Invalid string length" instead of a usable error
- where: packages/headless/src/page.ts:17 (toBase64), :43
- scenario: `renderSceneToPixels` accepts any output its drawing buffer can hold; renderSceneToPixels.ts:251 refuses only a render past the buffer. Take an `rgba` render of about 11 600 × 11 600 px (≈ 537 MB), which a GPU with a 16384 max buffer can reach. Concatenating `binary` then goes past V8's maximum string length (2^29 − 24 chars) and the page throws `RangeError: Invalid string length`. Node sees an opaque evaluate rejection, after the whole render has already run. Neither `readPageRequest` nor the host bounds the output size or names the limit. The base64, which is 4/3 larger, also has to fit in one string and one CDP message.
- evidence: read (the limit comes from V8's documented maximum string length; not run)
- severity: low

## Files read
packages/headless/src/defaultPage.ts
packages/headless/src/host.ts
packages/headless/src/index.ts
packages/headless/src/page.ts
packages/headless/src/pageLoad.ts
packages/headless/src/protocol.ts
packages/headless/src/testing/compareRaster.ts
packages/headless/src/testing/fixtureScene.ts
packages/headless/src/testing/protocol.ts
packages/headless/src/testing/registeredPage.ts
packages/headless/src/testing/registeredScene.ts

<!-- done: 3 findings, files read: 11 -->