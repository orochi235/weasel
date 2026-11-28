# cursor: saturation

Repeated blind reviews of the area `cursor` (12 files, 1346 lines) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 10.4 known defects per thousand lines, at least 5. The next defect should cost about $2.90. `skulkr scour report cursor` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        1 |   1 |        1 |   1 |   0 |          – |      – |        – | $0.16 |    $0.16 |     0.1 |
|   2 | claude |        1 |   1 |        2 |   2 |   0 |        2.5 |    0.5 |   100.0% | $0.73 |    $0.44 |     1.8 |
|   3 | claude |        2 |   2 |        4 |   4 |   0 |        8.0 |    4.0 |   100.0% | $0.80 |    $0.42 |     3.6 |
|   4 | claude |        5 |   5 |        9 |   9 |   0 |       36.0 |   27.0 |   100.0% | $0.69 |    $0.26 |     3.0 |
|   5 | claude |        2 |   1 |       10 |   8 |   2 |       22.8 |   12.8 |    59.3% | $0.74 |    $0.31 |     3.3 |
|   6 | claude |        2 |   0 |       10 |   7 |   1 |       30.4 |   20.4 |    44.1% | $0.67 |    $0.38 |     2.8 |
|   7 | claude |        2 |   1 |       11 |   7 |   2 |       21.5 |   10.5 |    35.5% | $0.76 |    $0.41 |     3.1 |
|   8 | claude |        1 |   1 |       12 |   8 |   2 |       26.0 |   14.0 |    39.3% | $0.72 |    $0.44 |     3.0 |
|   9 | claude |        2 |   0 |       12 |   6 |   4 |       16.0 |    4.0 |    24.5% | $0.64 |    $0.49 |     2.5 |
|  10 | claude |        2 |   1 |       13 |   7 |   3 |       20.4 |    7.4 |    26.6% | $0.64 |    $0.50 |     2.4 |
|  11 | claude |        2 |   1 |       14 |   7 |   4 |       19.6 |    5.6 |    24.2% | $1.08 |    $0.54 |     3.9 |
|  12 | claude |        5 |   0 |       14 |   4 |   5 |       15.5 |    1.5 |    10.2% | $0.59 |    $0.59 |     2.6 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        1 |          – |      – |        – |       – |
| claude         | Chao2     |        11 |       14 |       15.2 |    1.2 |     9.9% |       – |
| all sources    | Chao2     |        12 |       14 |       15.5 |    1.5 |    10.2% |       – |
| codex × claude | Chapman   |         – |       14 |       14.0 |    0.0 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                        | where                                                                     | first | codex | claude | severity |
|-----|-----------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Equality check ignores fallback, so a fallback-only update is dropped: current().cursor.fallback stays stale and subscribers are not notified | packages/cursor/src/paintedCursorState.ts:63                              |     1 |     1 |      2 | low      |
| D2  | brushRing draws a negative or NaN radius as the default 24px ring, and turns a negative world radius into a fixed-px CSS cursor               | packages/cursor/src/brushRing.ts:20 (brushRing)                           |     2 |     0 |      2 | low      |
| D3  | The pencil glyph's detail line extends past the ink and halo, so it shows as an unhaloed white stub                                           | packages/cursor/src/glyphs.ts:22 (GLYPHS.pencil)                          |     3 |     0 |      2 | low      |
| D4  | bakeFallback rejects valid url(…) hotspots that use a + sign, an exponent, or no space after the closing paren                                | packages/cursor/src/bake.ts:40 (IMAGE_ENTRY / bakeFallback)               |     3 |     0 |      4 | low      |
| D5  | The fit guards bound a zero-radius arc by a circle on its chord, so they refuse a turn the glyph could take                                   | packages/cursor/src/types.ts:118 (walk)                                   |     4 |     0 |      2 | low      |
| D6  | The fit guards bound an arc whose ends meet by a full circle the browser never draws                                                          | packages/cursor/src/types.ts:118 (walk)                                   |     4 |     0 |      1 | low      |
| D7  | A circular arc whose rx is written negative is refused as elliptical                                                                          | packages/cursor/src/types.ts:115 (walk)                                   |     4 |     0 |      2 | low      |
| D8  | worldCursorPx returns Infinity for a finite world radius at a large zoom                                                                      | packages/cursor/src/paint.ts:117 (worldCursorPx)                          |     4 |     0 |      3 | low      |
| D9  | bakeFallback refuses a fallback with an image-set() entry, though that is a valid cursor value                                                | packages/cursor/src/bake.ts:39 (IMAGE_ENTRY / bakeFallback)               |     4 |     0 |      4 | low      |
| D10 | A cursor sink overwrites another writer's painted override and, on release, clears it to null instead of restoring the earlier value          | packages/cursor/src/cursorSink.ts:75 (createCursorSink → writePainted)    |     5 |     0 |      4 | low      |
| D11 | bakeFallback refuses -webkit- prefixed cursor keyword aliases (e.g. -webkit-grab) that Chrome accepts                                         | packages/cursor/src/bake.ts:35 (CURSOR_KEYWORDS / bakeFallback)           |     7 |     0 |      1 | low      |
| D12 | A px-unit brushRing draws its ring line thicker as the radius grows, while the same ring in world units stays at chrome weight                | packages/cursor/src/brushRing.ts:21 (brushRing)                           |     8 |     0 |      2 | medium   |
| D13 | bakeFallback refuses a valid url(…) fallback whose unquoted URL contains a CSS escape                                                         | packages/cursor/src/bake.ts:40 (IMAGE_ENTRY, used by bakeFallback)        |    10 |     0 |      1 | low      |
| D14 | Painted cursor state keeps a stale pointer position while inactive, so a reactivated painted cursor draws at the old pointer position         | packages/cursor/src/paintedCursorState.ts:86 (setPointer), :101 (current) |    11 |     0 |      1 | low      |
