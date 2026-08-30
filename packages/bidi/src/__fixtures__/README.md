# Unicode Bidirectional Algorithm conformance fixtures

Unicode's own test data for UAX #9, plus parsers for it. Read this if you are
writing or debugging the algorithm in `packages/bidi/src/`.

**Unicode 16.0.0**, from <https://www.unicode.org/Public/16.0.0/ucd/>:

| File | Source | Cases |
| --- | --- | --- |
| `BidiCharacterTest.txt.gz` | [`BidiCharacterTest.txt`](https://www.unicode.org/Public/16.0.0/ucd/BidiCharacterTest.txt) | 91,707 |
| `BidiTest.txt.gz` | [`BidiTest.txt`](https://www.unicode.org/Public/16.0.0/ucd/BidiTest.txt) | 490,846 |

Both are the **complete upstream files** — nothing is subsetted, filtered, or
reordered. They are stored gzipped only because they are 6.9 MB and 8.0 MB
uncompressed, against a repo whose largest tracked file is 330 KB; gzipped they
are 400 KB and 1.3 MB. `gzip -9 -n` is deterministic (`-n` drops the embedded
name and mtime), so re-compressing the same download reproduces the same bytes.

To regenerate:

```sh
curl -sSO https://www.unicode.org/Public/16.0.0/ucd/BidiCharacterTest.txt
curl -sSO https://www.unicode.org/Public/16.0.0/ucd/BidiTest.txt
gzip -9 -n BidiCharacterTest.txt BidiTest.txt
```

To read one by hand: `gzcat BidiTest.txt.gz | less`, or `zgrep` it. The full
column semantics are in each file's own header comment.

These files are test fixtures and must not ship in the published tarball.

## Using them

`parseConformance.ts` exports pure parsers over the file text
(`parseBidiCharacterTest`, `parseBidiTest`) and loaders that read and decompress
the fixtures beside them (`loadBidiCharacterTest`, `loadBidiTest`). It contains
no algorithm — only the parse.

## Traps in the two formats

**`x` in a levels column means "removed from the visual output" by rule X9, not
"level zero".** It parses to `null`, and the entry is kept so `levels` stays
index-aligned with the input. `visualOrder` omits those indices, so
`visualOrder.length` is normally shorter than `levels.length`.

**`BidiTest.txt` carries state across lines.** `@Levels:` and `@Reorder:` each
apply to every following data line until the next line *of that same kind* — they
are tracked independently, so a new `@Levels` does not reset the `@Reorder` in
force. Parsing a data line without carrying both forward yields silently wrong
expectations rather than an error. `@Reorder:` with an empty value is legal (4
occurrences) and means an empty visual order: every character was removed.

**`BidiTest.txt` has no code points and no expected paragraph level.** Its input
is `Bidi_Class` names, and its `paragraphDirections` is a hex *bitset* of the
directions the case applies to (1 = auto-LTR, 2 = LTR, 4 = RTL) — one line is up
to three test runs. `BidiCharacterTest.txt`'s field 1 is a different thing: a
single direction, 0 = LTR, 1 = RTL, 2 = auto.

Because `parseBidiTest` shares one frozen `levels`/`visualOrder` array across
every case in a block, those two fields are `readonly`. Copy before mutating.
