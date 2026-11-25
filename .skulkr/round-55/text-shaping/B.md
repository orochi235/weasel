I couldn't write `.skulk/out/findings.md` because permission was denied, so the whole document is below.

Note: this checkout's HEAD is `830b463cc1`, not the frozen `bfc55709b4`, so I reviewed the tree as it is checked out.

## A non-ASCII feature setting throws "Expected ASCII text" instead of the documented refusal, and leaks HarfBuzz stack and heap on every call
- where: packages/text-shaping/src/shaper.ts:117 (HarfBuzzShaper.#feature)
- scenario: `shape(face, 'abc', ['smcp\u200B'])`, or a `'“liga”'` pasted from CSS with curly quotes → `hb.Feature.fromString` calls `stackSave`, `stackAlloc(16)`, then `string_to_ascii_ptr`, which `malloc`s and throws `Error("Expected ASCII text")` before `stackRestore` and `free` run. `#feature` never reaches its own `weasel shape: "…" is not an OpenType feature setting` error, so the caller gets an undocumented message. Nothing is cached for an invalid tag, so every retry (every layout) leaks 16 bytes of the wasm stack plus the malloc. The stack pointer drifts until HarfBuzz overflows. It should check the tag for non-ASCII itself and throw the documented error before calling into HarfBuzz.
- evidence: read (vendor/harfbuzzjs/index.js `Feature.fromString` and `string_to_ascii_ptr`)
- severity: medium

## A non-ASCII `lang` makes `shape` throw mid-layout and leaks HarfBuzz heap
- where: packages/text-shaping/src/shaper.ts:156 (HarfBuzzShaper.#piece)
- scenario: a run or style with `lang: 'sr‑Latn'` (U+2011 non-breaking hyphen), or any other non-ASCII string, reaches `shape` unvalidated: text's `shapedRuns.ts:61` passes `run.lang` straight through. `buffer.setLanguage` calls `string_to_ascii_ptr`, which throws `Expected ASCII text` after a `malloc` that is never freed, and the whole text layout throws. The contract describes `language` as a BCP 47 tag that selects forms, with no failure mode. An unreadable tag should be treated as absent, or refused with a documented error, before it reaches HarfBuzz.
- evidence: read
- severity: medium

## Script pieces don't pair the canonically equivalent angle brackets, though bidi does
- where: packages/text-shaping/src/scripts.ts:106 (scriptPieces)
- scenario: `'abc 〈שלום〉 def'` written with U+2329 to open and U+3009 to close. The two are canonical equivalents, and the PBT fixture generates both. `open[k].close !== cp` never matches, so the `〉` stays in the Hebrew piece and is shaped RTL and mirrored, where UAX #24 / BD16 pair it with the Latin opener. `@weasel-js/bidi`'s `canonicalBracket` (`implicit.ts:24`) already answers the same pairing question the other way, so the two packages disagree.
- evidence: read
- severity: low

## `glyphD` throws a RangeError for an infinite offset
- where: packages/text-shaping/src/shaper.ts:86 (fmt)
- scenario: `glyphD(face, gid, Infinity)`, for example from a pen position that overflowed upstream. `scaled` isn't finite, so `r = Infinity`; `Math.abs(r) < 1e21` is false, and `BigInt(Infinity)` throws `RangeError`. A NaN offset in the same call returns a path containing `NaN` instead. The two non-finite cases get two different answers, and one of them is a throw from a formatter.
- evidence: read
- severity: low

## The parsed-feature cache has no bound
- where: packages/text-shaping/src/shaper.ts:92 (HarfBuzzShaper.#features)
- scenario: features come from document styles (`fontFeatures`), and a setting can carry a value or a range (`aalt=2`, `kern[3:5]`). An editor that exposes feature settings, or a document with many distinct ranged settings, adds one entry per distinct string to a per-process Map that is never pruned. The per-face shape cache next to it is capped at 512.
- evidence: read
- severity: low

## Node detection disagrees with harfbuzzjs's own in an Electron renderer
- where: packages/text-shaping/src/shaper.ts:246 (wasmLocation)
- scenario: in an Electron renderer with `nodeIntegration`, `process.versions.node` is set, so `wasmLocation` returns `import.meta.resolve(...)`. Under a vite bundle that is either undefined (a TypeError inside `locateFile`) or a `file:` URL. The vendored `harfbuzz.js` doesn't count `process.type == 'renderer'` as Node, so it treats the renderer as web and `fetch`es that `file:` URL. The fetch fails from an http-served renderer, and `loadShaper` rejects where `wasmUrl` would have worked. The two "is this Node" checks should be one.
- evidence: read (the Electron runtime behavior is inferred, not run)
- severity: low

## Files read
packages/text-shaping/src/__fixtures__/fonts.ts
packages/text-shaping/src/index.ts
packages/text-shaping/src/pbt.fixture.ts
packages/text-shaping/src/scripts.ts
packages/text-shaping/src/shaper.ts

<!-- done: 6 findings, files read: 5 -->